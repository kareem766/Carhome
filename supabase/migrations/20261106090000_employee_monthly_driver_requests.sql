-- Employee monthly-with-driver requests: isolated from the existing company rental workflow.
create table if not exists public.employee_service_settings (
  id boolean primary key default true check (id),
  request_fee_enabled boolean not null default false,
  request_fee_egp numeric(12,2) not null default 0 check (request_fee_egp >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.employee_service_settings (id, request_fee_enabled, request_fee_egp)
values (true, false, 0) on conflict (id) do nothing;
alter table public.employee_service_settings enable row level security;
create policy "employee service settings admins manage" on public.employee_service_settings
for all to authenticated using (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())));
create policy "employee service settings authenticated read" on public.employee_service_settings
for select to authenticated using (true);

create table if not exists public.employee_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  employment_type text not null check (employment_type in ('independent','company_member')),
  organization_id uuid references public.organizations(id) on delete set null,
  account_status text not null default 'active' check (account_status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_company_link_consistency check (
    (employment_type = 'independent' and organization_id is null) or
    (employment_type = 'company_member' and organization_id is not null)
  )
);
create index if not exists employee_accounts_organization_idx on public.employee_accounts(organization_id) where organization_id is not null;
alter table public.employee_accounts enable row level security;
create policy "employees read own employee account" on public.employee_accounts
for select to authenticated using (user_id = (select auth.uid()));
create policy "company owners and admins read employee accounts" on public.employee_accounts
for select to authenticated using (
  exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()))
  or exists (select 1 from public.organization_memberships m where m.organization_id = employee_accounts.organization_id and m.user_id = (select auth.uid()) and m.role = 'owner')
);

create or replace function app_private.register_independent_employee_account()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_user_meta_data ->> 'organization_type' = 'employee'
     and coalesce(new.raw_user_meta_data ->> 'employment_type','independent') = 'independent' then
    insert into public.employee_accounts(user_id, employment_type, account_status)
    values (new.id, 'independent', 'active')
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists auth_user_register_independent_employee on auth.users;
create trigger auth_user_register_independent_employee
after insert on auth.users for each row execute function app_private.register_independent_employee_account();

create or replace function app_private.register_company_employee_account()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role in ('member','manager') and exists (
    select 1 from public.organizations o where o.id = new.organization_id and o.organization_type = 'company'
  ) then
    insert into public.employee_accounts(user_id, employment_type, organization_id, account_status)
    values (new.user_id, 'company_member', new.organization_id, 'active')
    on conflict (user_id) do update set
      employment_type = 'company_member',
      organization_id = excluded.organization_id,
      account_status = 'active',
      updated_at = now();
  end if;
  return new;
end;
$$;
drop trigger if exists organization_membership_register_employee on public.organization_memberships;
create trigger organization_membership_register_employee
after insert or update of role, organization_id on public.organization_memberships
for each row execute function app_private.register_company_employee_account();

create table if not exists public.employee_rental_requests (
  id uuid primary key default gen_random_uuid(),
  employee_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 160),
  vehicle_type text not null check (char_length(btrim(vehicle_type)) between 2 and 80),
  seats integer not null default 4 check (seats between 1 and 60),
  governorate text not null check (char_length(btrim(governorate)) between 2 and 80),
  pickup_address text not null check (char_length(btrim(pickup_address)) between 3 and 300),
  duration_months integer not null check (duration_months in (1,3,6,12)),
  start_date date not null,
  work_days_per_week integer not null check (work_days_per_week between 1 and 7),
  daily_hours numeric(4,1) not null check (daily_hours between 1 and 24),
  budget_min_egp numeric(12,2) check (budget_min_egp is null or budget_min_egp >= 0),
  budget_max_egp numeric(12,2) check (budget_max_egp is null or budget_max_egp >= 0),
  details text check (details is null or char_length(details) <= 2000),
  with_driver boolean not null default true check (with_driver),
  status text not null default 'pending_review' check (status in ('pending_review','open','rejected','closed','cancelled')),
  admin_notes text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  fee_enabled_snapshot boolean not null default false,
  fee_amount_egp numeric(12,2) not null default 0 check (fee_amount_egp >= 0),
  fee_status text not null default 'not_required' check (fee_status in ('not_required','not_configured','pending','paid','waived','refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (budget_min_egp is null or budget_max_egp is null or budget_max_egp >= budget_min_egp)
);
create index if not exists employee_requests_owner_created_idx on public.employee_rental_requests(employee_user_id, created_at desc);
create index if not exists employee_requests_provider_feed_idx on public.employee_rental_requests(status, governorate, vehicle_type, created_at desc);
alter table public.employee_rental_requests enable row level security;
create policy "employees create own pending requests" on public.employee_rental_requests
for insert to authenticated with check (
  employee_user_id = (select auth.uid()) and status = 'pending_review' and with_driver = true
  and exists (select 1 from public.employee_accounts e where e.user_id = (select auth.uid()) and e.account_status = 'active')
);
create policy "employees read own requests" on public.employee_rental_requests
for select to authenticated using (
  employee_user_id = (select auth.uid())
  or exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()))
  or (status = 'open' and exists (
    select 1 from public.organization_memberships m join public.organizations o on o.id = m.organization_id
    where m.user_id = (select auth.uid()) and o.organization_type in ('individual_owner','fleet_supplier') and o.approval_status = 'approved'
  ))
);
create policy "admins manage employee requests" on public.employee_rental_requests
for all to authenticated using (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())));
create policy "employees update own pending requests" on public.employee_rental_requests
for update to authenticated using (employee_user_id = (select auth.uid()) and status = 'pending_review')
with check (employee_user_id = (select auth.uid()) and status = 'pending_review');

create table if not exists public.employee_rental_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.employee_rental_requests(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  vehicle_id uuid not null references public.vehicles(id),
  created_by uuid not null references auth.users(id),
  monthly_price_egp numeric(12,2) not null check (monthly_price_egp > 0),
  driver_included boolean not null default true check (driver_included),
  driver_notes text check (driver_notes is null or char_length(driver_notes) <= 1000),
  message text check (message is null or char_length(message) <= 2000),
  status text not null default 'submitted' check (status in ('submitted','accepted','rejected','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(request_id, vehicle_id)
);
create index if not exists employee_offers_request_idx on public.employee_rental_offers(request_id, created_at desc);
create index if not exists employee_offers_provider_idx on public.employee_rental_offers(organization_id, created_at desc);
alter table public.employee_rental_offers enable row level security;
create policy "approved providers submit offers for open employee requests" on public.employee_rental_offers
for insert to authenticated with check (
  created_by = (select auth.uid()) and status = 'submitted' and driver_included = true
  and exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    join public.vehicles v on v.organization_id = o.id
    join public.employee_rental_requests r on r.id = employee_rental_offers.request_id
    where m.user_id = (select auth.uid())
      and m.organization_id = employee_rental_offers.organization_id
      and v.id = employee_rental_offers.vehicle_id
      and o.organization_type in ('individual_owner','fleet_supplier')
      and o.approval_status = 'approved'
      and v.review_status = 'approved'
      and v.with_driver = true
      and r.status = 'open'
      and r.governorate = v.governorate
  )
);
create policy "employee and provider read related offers" on public.employee_rental_offers
for select to authenticated using (
  created_by = (select auth.uid())
  or exists (select 1 from public.employee_rental_requests r where r.id = employee_rental_offers.request_id and r.employee_user_id = (select auth.uid()))
  or exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()))
);
create policy "providers update own employee offers" on public.employee_rental_offers
for update to authenticated using (
  created_by = (select auth.uid()) and exists (select 1 from public.organization_memberships m where m.organization_id = employee_rental_offers.organization_id and m.user_id = (select auth.uid()))
) with check (
  created_by = (select auth.uid()) and exists (select 1 from public.organization_memberships m where m.organization_id = employee_rental_offers.organization_id and m.user_id = (select auth.uid()))
);
create policy "admins manage employee offers" on public.employee_rental_offers
for all to authenticated using (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())));

comment on table public.employee_service_settings is 'Employee request pricing configuration. Fee collection is intentionally disabled until a complete payment/review workflow is released.';
comment on column public.employee_service_settings.request_fee_enabled is 'Keep false until employee request payment flow is implemented and tested.';
comment on table public.employee_rental_requests is 'Independent employee monthly-with-driver requests; separate from company rental_requests.';

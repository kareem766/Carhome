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


create or replace function app_private.suspend_employee_after_company_membership_removal()
returns trigger language plpgsql security definer set search_path = '' as $employee_fn$
begin
  if old.role in ('member','manager') and exists (
    select 1 from public.organizations o where o.id = old.organization_id and o.organization_type = 'company'
  ) then
    update public.employee_accounts e
    set employment_type = 'independent', organization_id = null, account_status = 'suspended', updated_at = now()
    where e.user_id = old.user_id and e.employment_type = 'company_member' and e.organization_id = old.organization_id;
  end if;
  return old;
end;
$employee_fn$;
drop trigger if exists organization_membership_suspend_employee on public.organization_memberships;
create trigger organization_membership_suspend_employee
after delete on public.organization_memberships
for each row execute function app_private.suspend_employee_after_company_membership_removal();

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

create or replace function app_private.guard_employee_request_fee()
returns trigger language plpgsql security definer set search_path = '' as $employee_fn$
declare
  fee_enabled boolean;
  fee_amount numeric(12,2);
begin
  select coalesce(request_fee_enabled,false), coalesce(request_fee_egp,0)
    into fee_enabled, fee_amount
  from public.employee_service_settings where id = true;
  if new.start_date < current_date then
    raise exception 'Employee request start date cannot be in the past.' using errcode = '22007';
  end if;
  if fee_enabled then
    raise exception 'Employee request fee payment workflow is not enabled yet; request submission is temporarily paused.'
      using errcode = '55000';
  end if;
  new.fee_enabled_snapshot := false;
  new.fee_amount_egp := 0;
  new.fee_status := 'not_required';
  return new;
end;
$employee_fn$;
drop trigger if exists employee_request_fee_guard on public.employee_rental_requests;
create trigger employee_request_fee_guard
before insert on public.employee_rental_requests
for each row execute function app_private.guard_employee_request_fee();

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

drop policy if exists "employees read own requests" on public.employee_rental_requests;
create policy "employees and eligible providers read employee requests" on public.employee_rental_requests
for select to authenticated using (
  employee_user_id = (select auth.uid())
  or exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()))
  or (status = 'open' and exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    join public.vehicles v on v.organization_id = m.organization_id
    where m.user_id = (select auth.uid())
      and o.organization_type in ('individual_owner','fleet_supplier')
      and o.approval_status = 'approved'
      and v.review_status = 'approved'
      and v.with_driver = true
      and lower(btrim(v.vehicle_type)) = lower(btrim(employee_rental_requests.vehicle_type))
      and v.seats >= employee_rental_requests.seats
      and v.governorate = employee_rental_requests.governorate
      and (o.organization_type = 'fleet_supplier' or (v.payment_status in ('verified','waived') and (v.registration_expires_at is null or v.registration_expires_at > now())))
  ))
);
drop policy if exists "employees update own pending requests" on public.employee_rental_requests;

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
      and lower(btrim(v.vehicle_type)) = lower(btrim(r.vehicle_type))
      and v.seats >= r.seats
      and (o.organization_type = 'fleet_supplier' or (v.payment_status in ('verified','waived') and (v.registration_expires_at is null or v.registration_expires_at > now())))
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
drop policy if exists "providers update own employee offers" on public.employee_rental_offers;
create policy "admins manage employee offers" on public.employee_rental_offers
for all to authenticated using (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())));


create or replace function app_private.notify_employee_request_events()
returns trigger language plpgsql security definer set search_path = '' as $employee_fn$
declare
  admin_user record;
begin
  if tg_op = 'INSERT' then
    for admin_user in select a.user_id from public.platform_admins a loop
      insert into public.platform_notifications(user_id,title,body,notification_type,action_url,created_by)
      values (admin_user.user_id,'طلب موظف جديد للمراجعة','يوجد طلب سيارة شهري بسائق جديد ينتظر مراجعة الإدارة.','general','/workspace/admin/employee-requests',new.employee_user_id);
    end loop;
  elsif tg_op = 'UPDATE' and old.status = 'pending_review' and new.status in ('open','rejected') then
    insert into public.platform_notifications(user_id,title,body,notification_type,action_url,created_by)
    values (
      new.employee_user_id,
      case when new.status = 'open' then 'تم اعتماد طلب السيارة' else 'لم تتم الموافقة على طلب السيارة' end,
      case when new.status = 'open' then 'تمت مراجعة طلبك ونشره لملاك السيارات وموردي الأساطيل.' else coalesce(new.admin_notes,'يرجى مراجعة تفاصيل الطلب أو التواصل مع الدعم.') end,
      'general',
      '/workspace/employee?request=' || new.id::text,
      new.reviewed_by
    );
  end if;
  return new;
end;
$employee_fn$;
drop trigger if exists employee_request_notifications on public.employee_rental_requests;
create trigger employee_request_notifications
after insert or update of status on public.employee_rental_requests
for each row execute function app_private.notify_employee_request_events();


create or replace function public.employee_respond_to_offer(p_offer_id uuid, p_accept boolean)
returns boolean language plpgsql security definer set search_path = '' as $employee_fn$
declare
  v_request_id uuid;
  v_employee_user_id uuid;
begin
  select o.request_id, r.employee_user_id
    into v_request_id, v_employee_user_id
  from public.employee_rental_offers o
  join public.employee_rental_requests r on r.id = o.request_id
  where o.id = p_offer_id and r.status = 'open'
  for update of r;
  if v_request_id is null or v_employee_user_id <> (select auth.uid()) then
    raise exception 'You are not allowed to respond to this employee offer.' using errcode = '42501';
  end if;
  if p_accept then
    update public.employee_rental_offers set status = 'accepted', updated_at = now()
    where id = p_offer_id and status = 'submitted';
    if not found then raise exception 'This offer is no longer available.' using errcode = '55000'; end if;
    update public.employee_rental_requests set status = 'closed', updated_at = now()
    where id = v_request_id and employee_user_id = (select auth.uid());
    update public.employee_rental_offers set status = 'rejected', updated_at = now()
    where request_id = v_request_id and id <> p_offer_id and status = 'submitted';
  else
    update public.employee_rental_offers set status = 'rejected', updated_at = now()
    where id = p_offer_id and status = 'submitted';
    if not found then raise exception 'This offer is no longer available.' using errcode = '55000'; end if;
  end if;
  return true;
end;
$employee_fn$;
revoke all on function public.employee_respond_to_offer(uuid,boolean) from public, anon;
grant execute on function public.employee_respond_to_offer(uuid,boolean) to authenticated;

create or replace function app_private.notify_employee_offer_events()
returns trigger language plpgsql security definer set search_path = '' as $employee_fn$
declare
  v_employee_user_id uuid;
  member record;
begin
  if tg_op = 'INSERT' then
    select r.employee_user_id into v_employee_user_id
    from public.employee_rental_requests r where r.id = new.request_id;
    insert into public.platform_notifications(user_id,title,body,notification_type,action_url,created_by)
    values (v_employee_user_id,'وصلك عرض جديد لطلب سيارتك','أرسل أحد ملاك السيارات أو موردي الأساطيل عرضًا شهريًا شامل السائق.','general','/workspace/employee?request=' || new.request_id::text,new.created_by);
  elsif tg_op = 'UPDATE' and old.status = 'submitted' and new.status in ('accepted','rejected') then
    for member in select m.user_id from public.organization_memberships m where m.organization_id = new.organization_id loop
      insert into public.platform_notifications(user_id,title,body,notification_type,action_url,created_by)
      values (member.user_id,
        case when new.status = 'accepted' then 'تم اختيار عرضك' else 'تم إغلاق طلب الموظف' end,
        case when new.status = 'accepted' then 'اختار الموظف عرضك المقدم للسيارة الشهرية بالسائق.' else 'تم إغلاق الطلب أو اختيار عرض آخر.' end,
        'general','/workspace/provider-employee-requests',new.created_by);
    end loop;
  end if;
  return new;
end;
$employee_fn$;
drop trigger if exists employee_offer_notifications on public.employee_rental_offers;
create trigger employee_offer_notifications
after insert or update of status on public.employee_rental_offers
for each row execute function app_private.notify_employee_offer_events();

comment on table public.employee_service_settings is 'Employee request pricing configuration. Fee collection is intentionally disabled until a complete payment/review workflow is released.';
comment on column public.employee_service_settings.request_fee_enabled is 'Keep false until employee request payment flow is implemented and tested.';
comment on table public.employee_rental_requests is 'Independent employee monthly-with-driver requests; separate from company rental_requests.';

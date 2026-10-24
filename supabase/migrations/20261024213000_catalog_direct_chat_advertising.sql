-- Carhome customer experience: direct vehicle conversations and configurable advertising promotions.
alter table public.conversations alter column request_id drop not null;
alter table public.conversations add column if not exists vehicle_id uuid references public.vehicles(id) on delete set null;
create index if not exists conversations_vehicle_participants_idx
  on public.conversations(vehicle_id, company_organization_id, provider_organization_id);

alter table public.conversations drop constraint if exists conversations_request_or_vehicle_required;
alter table public.conversations add constraint conversations_request_or_vehicle_required
  check (request_id is not null or vehicle_id is not null);

drop policy if exists "companies can view approved vehicles" on public.vehicles;
create policy "organization members can view approved vehicles"
on public.vehicles for select to authenticated
using (
  review_status = 'approved'
  and exists (
    select 1 from public.organization_memberships m
    where m.organization_id = vehicles.organization_id and m.user_id = auth.uid()
  )
  and exists (
    select 1 from public.organizations provider
    where provider.id = vehicles.organization_id
      and (
        provider.organization_type = 'fleet_supplier'
        or vehicles.payment_status in ('verified','waived')
      )
  )
);

drop policy if exists "vehicle_images_select_authorized" on public.vehicle_images;
create policy "vehicle_images_select_authorized"
on public.vehicle_images for select to authenticated
using (
  exists (
    select 1 from public.organization_memberships own_membership
    where own_membership.organization_id = vehicle_images.organization_id
      and own_membership.user_id = auth.uid()
  )
  or exists (select 1 from public.platform_admins a where a.user_id = auth.uid())
  or exists (
    select 1 from public.vehicles v
    join public.organizations provider on provider.id = v.organization_id
    join public.organization_memberships viewer on viewer.user_id = auth.uid()
    where v.id = vehicle_images.vehicle_id
      and v.organization_id = vehicle_images.organization_id
      and v.review_status = 'approved'
      and (provider.organization_type = 'fleet_supplier' or v.payment_status in ('verified','waived'))
  )
);

drop policy if exists "company members can start direct vehicle conversations" on public.conversations;
create policy "company members can start direct vehicle conversations"
on public.conversations for insert to authenticated
with check (
  request_id is null
  and vehicle_id is not null
  and created_by = auth.uid()
  and status = 'open'
  and exists (
    select 1 from public.organization_memberships m
    join public.organizations company on company.id = m.organization_id
    where m.user_id = auth.uid()
      and m.organization_id = conversations.company_organization_id
      and company.organization_type = 'company'
  )
  and exists (
    select 1 from public.vehicles v
    join public.organizations provider on provider.id = v.organization_id
    where v.id = conversations.vehicle_id
      and v.organization_id = conversations.provider_organization_id
      and v.review_status = 'approved'
      and (provider.organization_type = 'fleet_supplier' or v.payment_status in ('verified','waived'))
      and v.organization_id <> conversations.company_organization_id
  )
);

create table if not exists public.advertising_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  duration_days integer not null check (duration_days between 1 and 365),
  price_egp numeric(12,2) not null check (price_egp >= 0),
  features jsonb not null default '[]'::jsonb check (jsonb_typeof(features) = 'array'),
  display_order integer not null default 0,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.advertising_plans enable row level security;
drop policy if exists "anyone can read active advertising plans" on public.advertising_plans;
create policy "anyone can read active advertising plans"
on public.advertising_plans for select to anon, authenticated using (is_active = true);
drop policy if exists "platform admins can manage advertising plans" on public.advertising_plans;
create policy "platform admins can manage advertising plans"
on public.advertising_plans for all to authenticated
using (exists (select 1 from public.platform_admins a where a.user_id = auth.uid()))
with check (exists (select 1 from public.platform_admins a where a.user_id = auth.uid()));
grant select on public.advertising_plans to anon, authenticated;
grant insert, update, delete on public.advertising_plans to authenticated;

create table if not exists public.vehicle_promotions (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  advertising_plan_id uuid not null references public.advertising_plans(id) on delete restrict,
  status text not null default 'pending_review' check (status in ('pending_review','approved','rejected','expired','cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  payment_status text not null default 'pending' check (payment_status in ('pending','submitted','verified','rejected','waived')),
  payment_reference text,
  created_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_promotions_dates_valid check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index if not exists vehicle_promotions_active_idx on public.vehicle_promotions(status, starts_at, ends_at);
create index if not exists vehicle_promotions_org_idx on public.vehicle_promotions(organization_id, created_at desc);
alter table public.vehicle_promotions enable row level security;
drop policy if exists "vehicle owners can read their promotions" on public.vehicle_promotions;
create policy "vehicle owners can read their promotions"
on public.vehicle_promotions for select to authenticated
using (
  exists (select 1 from public.organization_memberships m where m.organization_id = vehicle_promotions.organization_id and m.user_id = auth.uid())
  or exists (select 1 from public.platform_admins a where a.user_id = auth.uid())
);
drop policy if exists "vehicle owners can request promotions" on public.vehicle_promotions;
create policy "vehicle owners can request promotions"
on public.vehicle_promotions for insert to authenticated
with check (
  created_by = auth.uid()
  and status = 'pending_review'
  and payment_status = 'pending'
  and starts_at is null and ends_at is null
  and exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    join public.vehicles v on v.organization_id = m.organization_id
    where m.user_id = auth.uid()
      and m.organization_id = vehicle_promotions.organization_id
      and v.id = vehicle_promotions.vehicle_id
      and o.organization_type in ('individual_owner','fleet_supplier')
      and v.review_status = 'approved'
  )
  and exists (select 1 from public.advertising_plans p where p.id = vehicle_promotions.advertising_plan_id and p.is_active = true)
);
drop policy if exists "platform admins can manage vehicle promotions" on public.vehicle_promotions;
create policy "platform admins can manage vehicle promotions"
on public.vehicle_promotions for all to authenticated
using (exists (select 1 from public.platform_admins a where a.user_id = auth.uid()))
with check (exists (select 1 from public.platform_admins a where a.user_id = auth.uid()));
grant select, insert on public.vehicle_promotions to authenticated;
grant update, delete on public.vehicle_promotions to authenticated;

drop policy if exists "users can view active vehicle promotions" on public.vehicle_promotions;
create policy "users can view active vehicle promotions"
on public.vehicle_promotions for select to authenticated
using (
  status = 'approved'
  and payment_status in ('verified','waived')
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
);

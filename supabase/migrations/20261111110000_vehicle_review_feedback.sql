-- Store private, actionable vehicle review feedback for suppliers and owners.
-- Kept separate from public vehicle data so review notes are not exposed in the company catalog.

create table if not exists public.vehicle_review_feedback (
  vehicle_id uuid primary key references public.vehicles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  review_note text not null check (char_length(btrim(review_note)) between 1 and 1000),
  reviewed_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists vehicle_review_feedback_organization_idx
  on public.vehicle_review_feedback (organization_id, updated_at desc);

alter table public.vehicle_review_feedback enable row level security;
grant select, insert, update on public.vehicle_review_feedback to authenticated;

drop policy if exists "Vehicle review feedback visible to owning supplier and admins" on public.vehicle_review_feedback;
create policy "Vehicle review feedback visible to owning supplier and admins"
on public.vehicle_review_feedback for select to authenticated
using (
  exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()))
  or exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = vehicle_review_feedback.organization_id
      and m.user_id = (select auth.uid())
      and o.organization_type in ('fleet_supplier', 'individual_owner')
  )
);

drop policy if exists "Platform admins create vehicle review feedback" on public.vehicle_review_feedback;
create policy "Platform admins create vehicle review feedback"
on public.vehicle_review_feedback for insert to authenticated
with check (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())));

drop policy if exists "Platform admins update vehicle review feedback" on public.vehicle_review_feedback;
create policy "Platform admins update vehicle review feedback"
on public.vehicle_review_feedback for update to authenticated
using (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())));

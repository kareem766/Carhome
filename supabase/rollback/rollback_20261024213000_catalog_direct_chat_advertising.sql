-- Rollback for 20261024213000_catalog_direct_chat_advertising.sql
-- WARNING: removes direct-to-vehicle conversations created by this migration.
drop policy if exists "company members can start direct vehicle conversations" on public.conversations;
delete from public.conversations where vehicle_id is not null;
alter table public.conversations drop constraint if exists conversations_request_or_vehicle_required;
alter table public.conversations drop column if exists vehicle_id;
alter table public.conversations alter column request_id set not null;

drop policy if exists "organization members can view approved vehicles" on public.vehicles;
create policy "companies can view approved vehicles" on public.vehicles for select to authenticated
using (
  review_status = 'approved'
  and exists (
    select 1 from public.organizations vo
    where vo.id = vehicles.organization_id
      and (vo.organization_type = 'fleet_supplier' or vehicles.payment_status in ('verified','waived'))
  )
  and exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where m.user_id = auth.uid() and o.organization_type = 'company'
  )
);

drop policy if exists "vehicle_images_select_authorized" on public.vehicle_images;
create policy "vehicle_images_select_authorized" on public.vehicle_images for select to authenticated
using (
  exists (select 1 from public.organization_memberships m where m.organization_id = vehicle_images.organization_id and m.user_id = auth.uid())
  or exists (select 1 from public.platform_admins a where a.user_id = auth.uid())
  or (
    exists (
      select 1 from public.organization_memberships viewer_membership
      join public.organizations viewer_org on viewer_org.id = viewer_membership.organization_id
      where viewer_membership.user_id = auth.uid() and viewer_org.organization_type = 'company'
    )
    and exists (
      select 1 from public.vehicles v
      join public.organizations vehicle_org on vehicle_org.id = v.organization_id
      where v.id = vehicle_images.vehicle_id and v.organization_id = vehicle_images.organization_id
        and v.review_status = 'approved'
        and (vehicle_org.organization_type = 'fleet_supplier' or v.payment_status in ('verified','waived'))
    )
  )
);

drop table if exists public.vehicle_promotions;
drop table if exists public.advertising_plans;

-- Restrict vehicle image metadata and private object reads to the same visibility rules as vehicles.
-- Admins must still be able to review pending submissions.
drop policy if exists vehicle_images_select_authorized on public.vehicle_images;
create policy vehicle_images_select_authorized
on public.vehicle_images
for select to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    where m.organization_id = vehicle_images.organization_id
      and m.user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.platform_admins a
    where a.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.vehicles v
    join public.organizations o on o.id = v.organization_id
    where v.id = vehicle_images.vehicle_id
      and v.organization_id = vehicle_images.organization_id
      and v.review_status = 'approved'
      and (
        o.organization_type = 'fleet_supplier'
        or v.payment_status in ('verified', 'waived')
      )
  )
);

drop policy if exists vehicle_images_update_owner on public.vehicle_images;
create policy vehicle_images_update_owner
on public.vehicle_images
for update to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.organization_memberships m
    where m.organization_id = vehicle_images.organization_id
      and m.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.vehicles v
    where v.id = vehicle_images.vehicle_id
      and v.organization_id = vehicle_images.organization_id
      and v.created_by = (select auth.uid())
  )
)
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.organization_memberships m
    where m.organization_id = vehicle_images.organization_id
      and m.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.vehicles v
    where v.id = vehicle_images.vehicle_id
      and v.organization_id = vehicle_images.organization_id
      and v.created_by = (select auth.uid())
  )
);

drop policy if exists vehicle_images_storage_select_authorized on storage.objects;
create policy vehicle_images_storage_select_authorized
on storage.objects
for select to authenticated
using (
  bucket_id = 'vehicle-images'
  and (
    exists (
      select 1 from public.organization_memberships m
      where m.user_id = (select auth.uid())
        and m.organization_id::text = (storage.foldername(objects.name))[1]
    )
    or exists (
      select 1 from public.platform_admins a
      where a.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.vehicle_images vi
      join public.vehicles v on v.id = vi.vehicle_id
      join public.organizations o on o.id = v.organization_id
      where vi.storage_path = objects.name
        and v.organization_id::text = (storage.foldername(objects.name))[1]
        and v.id::text = (storage.foldername(objects.name))[2]
        and v.review_status = 'approved'
        and (
          o.organization_type = 'fleet_supplier'
          or v.payment_status in ('verified', 'waived')
        )
    )
  )
);

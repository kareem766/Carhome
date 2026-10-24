-- Restore the policies as they existed before 20261024001100_vehicle_image_visibility.
drop policy if exists vehicle_images_select_authorized on public.vehicle_images;
create policy vehicle_images_select_authorized
on public.vehicle_images for select to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    where m.organization_id = vehicle_images.organization_id
      and m.user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.vehicles v
    where v.id = vehicle_images.vehicle_id
      and v.review_status = 'approved'
  )
);

drop policy if exists vehicle_images_update_owner on public.vehicle_images;
create policy vehicle_images_update_owner
on public.vehicle_images for update to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.organization_memberships m
    where m.organization_id = vehicle_images.organization_id
      and m.user_id = (select auth.uid())
  )
)
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.organization_memberships m
    where m.organization_id = vehicle_images.organization_id
      and m.user_id = (select auth.uid())
  )
);

drop policy if exists vehicle_images_storage_select_authorized on storage.objects;
create policy vehicle_images_storage_select_authorized
on storage.objects for select to authenticated
using (
  bucket_id = 'vehicle-images'
  and (
    exists (
      select 1 from public.organization_memberships m
      where m.user_id = (select auth.uid())
        and m.organization_id::text = (storage.foldername(objects.name))[1]
    )
    or exists (
      select 1
      from public.vehicle_images vi
      join public.vehicles v on v.id = vi.vehicle_id
      where vi.storage_path = objects.name
        and v.review_status = 'approved'
    )
  )
);

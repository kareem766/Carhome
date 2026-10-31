-- Allow verified platform administrators to remove vehicle photos when deleting a vehicle.
-- Vehicle row deletion remains protected by the platform_admins RLS policy on public.vehicles.
drop policy if exists platform_admins_delete_vehicle_images_storage on storage.objects;
create policy platform_admins_delete_vehicle_images_storage
on storage.objects for delete to authenticated
using (
  bucket_id = 'vehicle-images'
  and exists (
    select 1
    from public.platform_admins a
    where a.user_id = (select auth.uid())
  )
);

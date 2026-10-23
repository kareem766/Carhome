-- Rollback for 20261024000100_vehicle_images.sql
drop policy if exists vehicle_images_storage_select_authorized on storage.objects;
drop policy if exists vehicle_images_storage_insert_owner on storage.objects;
drop policy if exists vehicle_images_storage_delete_owner on storage.objects;
delete from storage.objects where bucket_id = 'vehicle-images';
delete from storage.buckets where id = 'vehicle-images';
drop table if exists public.vehicle_images cascade;

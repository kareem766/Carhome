-- Carhome: secure vehicle photo storage and metadata.
-- Rollback: supabase/rollback/rollback_vehicle_images.sql

create table if not exists public.vehicle_images (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  storage_path text not null unique,
  alt_text text not null default 'صورة السيارة',
  sort_order integer not null default 0 check (sort_order between 0 and 7),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists vehicle_images_vehicle_sort_idx
  on public.vehicle_images(vehicle_id, sort_order);

alter table public.vehicle_images enable row level security;
grant select, insert, update, delete on public.vehicle_images to authenticated;

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

drop policy if exists vehicle_images_insert_owner on public.vehicle_images;
create policy vehicle_images_insert_owner
on public.vehicle_images for insert to authenticated
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

drop policy if exists vehicle_images_delete_owner on public.vehicle_images;
create policy vehicle_images_delete_owner
on public.vehicle_images for delete to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.organization_memberships m
    where m.organization_id = vehicle_images.organization_id
      and m.user_id = (select auth.uid())
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vehicle-images', 'vehicle-images', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = 8388608,
    allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists vehicle_images_storage_select_authorized on storage.objects;
create policy vehicle_images_storage_select_authorized
on storage.objects for select to authenticated
using (
  bucket_id = 'vehicle-images'
  and (
    exists (
      select 1 from public.organization_memberships m
      where m.user_id = (select auth.uid())
        and m.organization_id::text = (storage.foldername(name))[1]
    )
    or exists (
      select 1
      from public.vehicle_images vi
      join public.vehicles v on v.id = vi.vehicle_id
      where vi.storage_path = storage.objects.name
        and v.review_status = 'approved'
    )
  )
);

drop policy if exists vehicle_images_storage_insert_owner on storage.objects;
create policy vehicle_images_storage_insert_owner
on storage.objects for insert to authenticated
with check (
  bucket_id = 'vehicle-images'
  and exists (
    select 1
    from public.vehicles v
    join public.organization_memberships m on m.organization_id = v.organization_id
    where v.id::text = (storage.foldername(name))[2]
      and v.organization_id::text = (storage.foldername(name))[1]
      and m.user_id = (select auth.uid())
      and v.created_by = (select auth.uid())
  )
);

drop policy if exists vehicle_images_storage_delete_owner on storage.objects;
create policy vehicle_images_storage_delete_owner
on storage.objects for delete to authenticated
using (
  bucket_id = 'vehicle-images'
  and exists (
    select 1
    from public.vehicles v
    join public.organization_memberships m on m.organization_id = v.organization_id
    where v.id::text = (storage.foldername(name))[2]
      and v.organization_id::text = (storage.foldername(name))[1]
      and m.user_id = (select auth.uid())
      and v.created_by = (select auth.uid())
  )
);

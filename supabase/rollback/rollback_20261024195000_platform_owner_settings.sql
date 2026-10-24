drop policy if exists "platform admins delete assets" on storage.objects;
drop policy if exists "platform admins update assets" on storage.objects;
drop policy if exists "platform admins upload assets" on storage.objects;
drop policy if exists "platform assets public read" on storage.objects;
delete from storage.objects where bucket_id = 'platform-assets';
delete from storage.buckets where id = 'platform-assets';
drop policy if exists "platform admins update platform settings" on public.platform_settings;
drop policy if exists "platform settings are publicly readable" on public.platform_settings;
drop table if exists public.platform_settings;

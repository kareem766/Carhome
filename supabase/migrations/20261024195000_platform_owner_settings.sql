create table if not exists public.platform_settings (
  id boolean primary key default true check (id = true),
  platform_name text not null default 'Carhome' check (char_length(platform_name) between 1 and 100),
  tagline text not null default 'تأجير السيارات للشركات' check (char_length(tagline) <= 180),
  description text not null default 'منصة تجمع الشركات وملاك السيارات وموردي الأساطيل لتسهيل التأجير طويل الأجل.' check (char_length(description) <= 1200),
  logo_url text,
  favicon_url text,
  support_email text,
  support_phone text,
  website_url text,
  address text,
  footer_text text not null default 'جميع الحقوق محفوظة.' check (char_length(footer_text) <= 300),
  announcement_text text check (char_length(announcement_text) <= 500),
  primary_color text not null default '#1d4ed8' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null default '#0f172a' check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  registration_enabled boolean not null default true,
  owner_registration_enabled boolean not null default true,
  company_registration_enabled boolean not null default true,
  supplier_registration_enabled boolean not null default true,
  maintenance_mode boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.platform_settings (id) values (true)
on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

drop policy if exists "platform settings are publicly readable" on public.platform_settings;
create policy "platform settings are publicly readable"
on public.platform_settings for select to anon, authenticated
using (true);

drop policy if exists "platform admins update platform settings" on public.platform_settings;
create policy "platform admins update platform settings"
on public.platform_settings for update to authenticated
using (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())));

grant select on public.platform_settings to anon, authenticated;
grant update on public.platform_settings to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('platform-assets', 'platform-assets', true, 2097152, array['image/png','image/jpeg','image/webp','image/svg+xml','image/x-icon'])
on conflict (id) do update set public = true, file_size_limit = 2097152,
  allowed_mime_types = array['image/png','image/jpeg','image/webp','image/svg+xml','image/x-icon'];

drop policy if exists "platform assets public read" on storage.objects;
create policy "platform assets public read" on storage.objects
for select to anon, authenticated using (bucket_id = 'platform-assets');

drop policy if exists "platform admins upload assets" on storage.objects;
create policy "platform admins upload assets" on storage.objects
for insert to authenticated with check (
  bucket_id = 'platform-assets'
  and exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()))
);

drop policy if exists "platform admins update assets" on storage.objects;
create policy "platform admins update assets" on storage.objects
for update to authenticated using (
  bucket_id = 'platform-assets'
  and exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()))
) with check (
  bucket_id = 'platform-assets'
  and exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()))
);

drop policy if exists "platform admins delete assets" on storage.objects;
create policy "platform admins delete assets" on storage.objects
for delete to authenticated using (
  bucket_id = 'platform-assets'
  and exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()))
);

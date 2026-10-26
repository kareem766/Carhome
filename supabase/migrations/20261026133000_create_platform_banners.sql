create table if not exists public.platform_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  body text not null default '',
  image_url text,
  button_label text,
  button_url text,
  enabled boolean not null default false,
  duration_seconds integer not null default 5 check (duration_seconds between 1 and 30),
  starts_at timestamptz,
  ends_at timestamptz,
  display_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_banners_valid_schedule check (starts_at is null or ends_at is null or ends_at > starts_at)
);

alter table public.platform_banners enable row level security;

drop policy if exists "Public can read active platform banners" on public.platform_banners;
create policy "Public can read active platform banners"
on public.platform_banners for select to anon, authenticated
using (enabled = true and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));

drop policy if exists "Platform admins manage platform banners" on public.platform_banners;
create policy "Platform admins manage platform banners"
on public.platform_banners for all to authenticated
using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()))
with check (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));

create index if not exists platform_banners_enabled_schedule_idx on public.platform_banners (enabled, display_order, starts_at, ends_at);

create table if not exists public.platform_promo_slides (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  image_url text not null,
  click_url text,
  audience_roles text[] not null default array['individual_owner','fleet_supplier','employee']::text[],
  enabled boolean not null default false,
  display_order integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_promo_slides_audience_roles_check
    check (cardinality(audience_roles) > 0 and audience_roles <@ array['individual_owner','fleet_supplier','employee']::text[]),
  constraint platform_promo_slides_dates_check
    check (starts_at is null or ends_at is null or ends_at > starts_at)
);

alter table public.platform_promo_slides enable row level security;
grant select, insert, update, delete on public.platform_promo_slides to authenticated;

drop policy if exists "Authenticated users read active promo slides" on public.platform_promo_slides;
create policy "Authenticated users read active promo slides"
on public.platform_promo_slides for select to authenticated
using (enabled = true and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));

drop policy if exists "Platform admins manage promo slides" on public.platform_promo_slides;
create policy "Platform admins manage promo slides"
on public.platform_promo_slides for all to authenticated
using (exists (select 1 from public.platform_admins pa where pa.user_id = (select auth.uid())))
with check (exists (select 1 from public.platform_admins pa where pa.user_id = (select auth.uid())));

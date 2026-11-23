create table if not exists public.platform_homepage_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_url text not null,
  click_url text,
  audience_roles text[] not null default array['individual_owner','fleet_supplier']::text[],
  enabled boolean not null default true,
  display_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_homepage_banners_audience_roles_check check (
    cardinality(audience_roles) > 0 and audience_roles <@ array[
      'individual_owner','fleet_supplier','employee','company','company_employee'
    ]::text[]
  )
);
create index if not exists platform_homepage_banners_enabled_order_idx
  on public.platform_homepage_banners (enabled, display_order, created_at desc);
alter table public.platform_homepage_banners enable row level security;
drop policy if exists "enabled homepage banners visible to signed-in accounts" on public.platform_homepage_banners;
drop policy if exists "homepage banners visible to matching signed-in accounts" on public.platform_homepage_banners;
create policy "homepage banners visible to matching signed-in accounts"
  on public.platform_homepage_banners for select to authenticated
  using (
    enabled = true
    and (
      exists (
        select 1 from public.organizations o
        where o.created_by = (select auth.uid())
          and o.approval_status = 'approved'
          and o.organization_type::text = any(platform_homepage_banners.audience_roles)
      )
      or (
        platform_homepage_banners.audience_roles @> array['employee']::text[]
        and exists (
          select 1 from public.employee_accounts ea
          where ea.user_id = (select auth.uid())
            and ea.employment_type = 'independent'
            and ea.account_status = 'active'
        )
      )
      or (
        platform_homepage_banners.audience_roles @> array['company_employee']::text[]
        and exists (
          select 1 from public.employee_accounts ea
          where ea.user_id = (select auth.uid())
            and ea.employment_type = 'company_member'
            and ea.account_status = 'active'
        )
      )
    )
  );
drop policy if exists "platform admins manage homepage banners" on public.platform_homepage_banners;
create policy "platform admins manage homepage banners"
  on public.platform_homepage_banners for all to authenticated
  using (exists (select 1 from public.platform_admins pa where pa.user_id = (select auth.uid())))
  with check (exists (select 1 from public.platform_admins pa where pa.user_id = (select auth.uid())));
revoke all on public.platform_homepage_banners from public, anon;
grant select, insert, update, delete on public.platform_homepage_banners to authenticated;

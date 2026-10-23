-- Carhome Phase 1 / Step 1.2
-- Identity and organization foundation.
-- Apply only to the dedicated Carhome Supabase project.
-- All exposed tables have RLS enabled and policies scoped to auth.uid().

begin;

create type public.organization_type as enum (
  'individual_owner',
  'fleet_supplier',
  'company'
);

create type public.organization_member_role as enum (
  'owner',
  'manager',
  'member'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 120),
  avatar_path text,
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 180),
  organization_type public.organization_type not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  city text check (city is null or char_length(btrim(city)) between 2 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_member_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organizations_created_by_idx
  on public.organizations (created_by);

create index organization_memberships_user_id_idx
  on public.organization_memberships (user_id);

create index organization_memberships_organization_id_idx
  on public.organization_memberships (organization_id);

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "organizations_select_created_or_member"
  on public.organizations
  for select
  to authenticated
  using (
    created_by = (select auth.uid())
    or id in (
      select organization_id
      from public.organization_memberships
      where user_id = (select auth.uid())
    )
  );

create policy "organizations_insert_self"
  on public.organizations
  for insert
  to authenticated
  with check (created_by = (select auth.uid()));

create policy "organizations_update_creator"
  on public.organizations
  for update
  to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

create policy "organization_memberships_select_own"
  on public.organization_memberships
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "organization_memberships_insert_initial_owner"
  on public.organization_memberships
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and role = 'owner'
    and exists (
      select 1
      from public.organizations o
      where o.id = organization_memberships.organization_id
        and o.created_by = (select auth.uid())
    )
  );

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.organizations to authenticated;
grant select, insert on public.organization_memberships to authenticated;

comment on table public.profiles is
  'Private profile fields for the authenticated user; no authorization roles are stored here.';
comment on table public.organizations is
  'Companies, fleet suppliers, or individual-owner workspaces on Carhome.';
comment on table public.organization_memberships is
  'Membership links; the initial client policy only permits self-creation as the workspace owner.';

commit;

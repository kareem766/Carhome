-- Carhome Phase 1 / Step 1.2 rollback.
-- Destructive: removes the identity/organization tables and their data.
-- Use only if this migration must be reversed and no retained data depends on it.

begin;

drop policy if exists "organization_memberships_insert_initial_owner" on public.organization_memberships;
drop policy if exists "organization_memberships_select_own" on public.organization_memberships;
drop policy if exists "organizations_update_creator" on public.organizations;
drop policy if exists "organizations_insert_self" on public.organizations;
drop policy if exists "organizations_select_created_or_member" on public.organizations;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;

drop table if exists public.organization_memberships;
drop table if exists public.organizations;
drop table if exists public.profiles;

drop type if exists public.organization_member_role;
drop type if exists public.organization_type;

commit;

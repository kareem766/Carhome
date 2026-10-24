-- Remove only the organization-admin policy introduced by migration 00700.
drop policy if exists "platform admins manage organizations" on public.organizations;

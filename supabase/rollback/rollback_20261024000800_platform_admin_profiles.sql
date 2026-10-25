-- Roll back platform-admin access to profiles while preserving user-owned policies.
drop policy if exists "platform admins update profiles" on public.profiles;
drop policy if exists "platform admins read profiles" on public.profiles;

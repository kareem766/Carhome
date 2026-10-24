-- Allow platform admins to read and update profile records for support operations.
-- Does not grant access to auth.users or allow account deletion.
alter table public.profiles enable row level security;

drop policy if exists "platform admins read profiles" on public.profiles;
create policy "platform admins read profiles"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1 from public.platform_admins a
    where a.user_id = (select auth.uid())
  )
);

drop policy if exists "platform admins update profiles" on public.profiles;
create policy "platform admins update profiles"
on public.profiles
for update
to authenticated
using (
  exists (
    select 1 from public.platform_admins a
    where a.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.platform_admins a
    where a.user_id = (select auth.uid())
  )
);

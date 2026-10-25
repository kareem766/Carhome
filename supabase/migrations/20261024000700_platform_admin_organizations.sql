-- Grant platform administrators CRUD access to organization records only.
-- Other tables receive separate reviewed migrations.
alter table public.organizations enable row level security;

drop policy if exists "platform admins manage organizations" on public.organizations;
create policy "platform admins manage organizations"
on public.organizations
for all
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

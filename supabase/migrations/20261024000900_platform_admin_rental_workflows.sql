alter table public.rental_requests enable row level security;
drop policy if exists "platform admins manage rental requests" on public.rental_requests;
create policy "platform admins manage rental requests"
on public.rental_requests for all to authenticated
using (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())));

alter table public.rental_offers enable row level security;
drop policy if exists "platform admins manage rental offers" on public.rental_offers;
create policy "platform admins manage rental offers"
on public.rental_offers for all to authenticated
using (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())));
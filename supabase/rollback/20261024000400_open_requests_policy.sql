-- Rollback for 20261024000400_open_requests_policy.sql
drop policy if exists "members can read own or open requests" on public.rental_requests;
create policy "company members can read their own rental requests"
  on public.rental_requests for select to authenticated
  using (exists (select 1 from public.organization_memberships m where m.organization_id = rental_requests.organization_id and m.user_id = auth.uid()));

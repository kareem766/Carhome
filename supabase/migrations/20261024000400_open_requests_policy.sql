-- Allow fleet suppliers and individual owners to discover open company requests.
-- Reviewed migration only: do not apply to shared/production without explicit approval.
drop policy if exists "company members can read their own rental requests" on public.rental_requests;
create policy "members can read own or open requests"
  on public.rental_requests for select to authenticated
  using (
    exists (select 1 from public.organization_memberships m where m.organization_id = rental_requests.organization_id and m.user_id = auth.uid())
    or (
      status = 'open'
      and exists (
        select 1 from public.organization_memberships m
        join public.organizations o on o.id = m.organization_id
        where m.user_id = auth.uid()
          and o.organization_type in ('individual_owner','fleet_supplier')
      )
    )
  );

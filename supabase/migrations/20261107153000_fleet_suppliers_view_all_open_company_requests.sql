create policy "approved fleet suppliers can view all open company rental requests"
on public.rental_requests
for select
to authenticated
using (
  status = 'open'
  and exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where m.user_id = (select auth.uid())
      and o.organization_type = 'fleet_supplier'
      and o.approval_status = 'approved'
  )
);

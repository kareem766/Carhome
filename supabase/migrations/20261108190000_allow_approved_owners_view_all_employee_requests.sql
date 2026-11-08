-- Allow approved individual vehicle owners to review every published employee request.
-- Offer submission remains protected by the existing vehicle-eligibility INSERT policy.
drop policy if exists "employees and eligible providers read employee requests"
on public.employee_rental_requests;

create policy "employees and approved providers read employee requests"
on public.employee_rental_requests
for select
to authenticated
using (
  employee_user_id = (select auth.uid())
  or exists (
    select 1 from public.platform_admins a
    where a.user_id = (select auth.uid())
  )
  or (
    status = 'open'
    and exists (
      select 1
      from public.organization_memberships m
      join public.organizations o on o.id = m.organization_id
      where m.user_id = (select auth.uid())
        and o.organization_type in (
          'individual_owner'::public.organization_type,
          'fleet_supplier'::public.organization_type
        )
        and o.approval_status = 'approved'
    )
  )
);

notify pgrst, 'reload schema';

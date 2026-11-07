-- Show all published employee requests to approved fleet suppliers.
-- Keep individual-owner visibility eligibility-based and preserve offer INSERT RLS unchanged.
drop policy if exists "employees and eligible providers read employee requests"
on public.employee_rental_requests;

create policy "employees and eligible providers read employee requests"
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
        and o.organization_type = 'fleet_supplier'::public.organization_type
        and o.approval_status = 'approved'
    )
  )
  or (
    status = 'open'
    and exists (
      select 1
      from public.organization_memberships m
      join public.organizations o on o.id = m.organization_id
      join public.vehicles v on v.organization_id = m.organization_id
      where m.user_id = (select auth.uid())
        and o.organization_type = 'individual_owner'::public.organization_type
        and o.approval_status = 'approved'
        and v.review_status = 'approved'
        and v.with_driver = true
        and v.payment_status in ('verified', 'waived')
        and (v.license_expiry_date is null or v.license_expiry_date >= current_date)
        and (v.registration_expires_at is null or v.registration_expires_at > now())
        and (
          employee_rental_requests.vehicle_type = 'أخرى'
          or lower(btrim(v.vehicle_type)) = lower(btrim(employee_rental_requests.vehicle_type))
          or (employee_rental_requests.vehicle_type = 'فان / ميكروباص' and v.vehicle_type in ('فان', 'ميكروباص'))
        )
        and v.seats >= employee_rental_requests.seats
        and v.governorate = employee_rental_requests.governorate
    )
  )
);

notify pgrst, 'reload schema';

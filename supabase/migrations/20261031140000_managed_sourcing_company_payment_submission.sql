grant update (payment_reference, payment_submitted_at) on public.managed_sourcing_requests to authenticated;
drop policy if exists "managed sourcing company submits payment reference" on public.managed_sourcing_requests;
create policy "managed sourcing company submits payment reference"
on public.managed_sourcing_requests for update to authenticated
using (
  status = 'awaiting_payment'
  and payment_status = 'awaiting_payment'
  and exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = managed_sourcing_requests.company_organization_id
      and m.user_id = (select auth.uid())
      and o.organization_type = 'company'
  )
)
with check (
  status = 'awaiting_payment'
  and payment_status = 'awaiting_payment'
  and payment_reference is not null
  and char_length(btrim(payment_reference)) between 3 and 120
  and payment_submitted_at is not null
  and exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = managed_sourcing_requests.company_organization_id
      and m.user_id = (select auth.uid())
      and o.organization_type = 'company'
  )
);
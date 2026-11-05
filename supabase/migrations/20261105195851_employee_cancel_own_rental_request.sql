revoke all on table public.employee_rental_requests from anon, authenticated;
grant select, insert, update on table public.employee_rental_requests to authenticated;

create policy "employees cancel own pending or open requests"
on public.employee_rental_requests
for update
to authenticated
using (
  employee_user_id = (select auth.uid())
  and status in ('pending_review', 'open')
)
with check (
  employee_user_id = (select auth.uid())
  and status = 'cancelled'
);

-- Allow trusted database-trigger updates to vehicle workflow statuses while
-- keeping direct client updates restricted to platform administrators.
--
-- The vehicle payment-submission notification trigger advances a newly paid
-- registration from pending_payment to pending_review. That nested UPDATE
-- runs with the submitting user's auth.uid(), so the original guard incorrectly
-- rejected this internal workflow transition.

create or replace function public.prevent_client_vehicle_admin_field_changes()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is not null
     and not exists (
       select 1
       from public.platform_admins a
       where a.user_id = auth.uid()
     )
     and pg_trigger_depth() <= 1
     and (
       new.review_status is distinct from old.review_status
       or new.payment_status is distinct from old.payment_status
     ) then
    raise exception 'Only platform administrators can change vehicle review or payment status';
  end if;

  return new;
end;
$function$;

comment on function public.prevent_client_vehicle_admin_field_changes() is
  'Blocks direct client changes to vehicle review/payment statuses. Allows nested database-trigger workflow updates; direct client updates remain admin-only.';

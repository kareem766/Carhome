-- The public payment RPC only returns the two approved public transfer destinations.
-- Run it as the caller against the dedicated safe settings table, not the admin settings table.
create or replace function public.get_public_payment_details()
returns table(instapay_number text, vodafone_cash_number text)
language sql
stable
security invoker
set search_path = ''
as $function$
  select ps.instapay_number, ps.vodafone_cash_number
  from public.platform_public_settings ps
  where ps.id = true
  limit 1;
$function$;

revoke all on function public.get_public_payment_details() from public;
grant execute on function public.get_public_payment_details() to anon, authenticated;

-- Cover foreign-key lookups used by review, employee, notifications, and offer workflows.
create index if not exists idx_discount_codes_created_by on public.discount_codes (created_by);
create index if not exists idx_employee_rental_offers_created_by on public.employee_rental_offers (created_by);
create index if not exists idx_employee_rental_offers_vehicle_id on public.employee_rental_offers (vehicle_id);
create index if not exists idx_employee_rental_requests_reviewed_by on public.employee_rental_requests (reviewed_by);
create index if not exists idx_employee_service_settings_updated_by on public.employee_service_settings (updated_by);
create index if not exists idx_managed_sourcing_subscriptions_reviewed_by on public.managed_sourcing_subscriptions (reviewed_by);
create index if not exists idx_notification_delivery_outbox_user_id on public.notification_delivery_outbox (user_id);
create index if not exists idx_organization_invitations_accepted_by on public.organization_invitations (accepted_by);
create index if not exists idx_organization_invitations_invited_by on public.organization_invitations (invited_by);
create index if not exists idx_service_provider_submissions_reviewed_by on public.service_provider_submissions (reviewed_by);
create index if not exists idx_service_provider_submissions_submitted_by on public.service_provider_submissions (submitted_by);
create index if not exists idx_support_ticket_messages_sender_user_id on public.support_ticket_messages (sender_user_id);
create index if not exists idx_vehicle_offers_conversation_id on public.vehicle_offers (conversation_id);
create index if not exists idx_vehicle_offers_created_by on public.vehicle_offers (created_by);
create index if not exists idx_vehicle_offers_vehicle_id on public.vehicle_offers (vehicle_id);

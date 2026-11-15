-- Trigger-only function: do not expose direct execution to API roles.
revoke all on function public.notify_employee_offer_message_participant()
  from public, anon, authenticated;

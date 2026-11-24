-- Atomic, idempotent ingestion of provider-verified payment events.
-- Staged in GitHub only; do not apply until the payment-core migration is approved.
create or replace function public.process_verified_payment_webhook(
  p_provider_code text,
  p_provider_event_id text,
  p_event_type text,
  p_payload_sha256 text,
  p_provider_reference text,
  p_amount numeric,
  p_currency text,
  p_outcome text,
  p_error_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_enabled boolean;
  v_attempt_id uuid;
  v_payment_id uuid;
  v_payment_status text;
  v_amount_due numeric(12,2);
  v_event_id uuid;
  v_event_status text;
  v_event_error text;
begin
  if p_provider_code not in ('paymob', 'fawry')
     or p_provider_event_id is null or length(p_provider_event_id) < 1
     or length(p_provider_event_id) > 200
     or p_provider_reference is null or length(p_provider_reference) < 1
     or length(p_provider_reference) > 200
     or p_payload_sha256 !~ '^[0-9a-f]{64}$'
     or p_currency <> 'EGP'
     or p_amount is null or p_amount < 0
     or p_outcome not in ('succeeded', 'failed', 'pending') then
    return jsonb_build_object('accepted', false, 'reason', 'invalid_event');
  end if;

  select g.is_enabled into v_enabled
  from public.payment_gateways g
  where g.provider_code = p_provider_code;

  if coalesce(v_enabled, false) is not true then
    return jsonb_build_object('accepted', false, 'reason', 'gateway_disabled');
  end if;

  select a.id, p.id, p.status, p.amount_due
    into v_attempt_id, v_payment_id, v_payment_status, v_amount_due
  from public.payment_attempts a
  join public.payments p on p.id = a.payment_id
  where a.provider_code = p_provider_code
    and a.provider_reference = p_provider_reference
    and p.provider_code = p_provider_code
  for update of a, p;

  if v_attempt_id is null then
    return jsonb_build_object('accepted', false, 'reason', 'payment_attempt_not_found');
  end if;

  insert into public.payment_webhook_events (
    provider_code, provider_event_id, event_type, payload_sha256,
    processing_status, payment_id
  ) values (
    p_provider_code, p_provider_event_id, left(p_event_type, 100), p_payload_sha256,
    'received', v_payment_id
  )
  on conflict (provider_code, provider_event_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select e.processing_status, e.error_code
      into v_event_status, v_event_error
    from public.payment_webhook_events e
    where e.provider_code = p_provider_code
      and e.provider_event_id = p_provider_event_id;

    if v_event_status = 'failed' then
      return jsonb_build_object(
        'accepted', false,
        'reason', coalesce(v_event_error, 'event_processing_failed'),
        'duplicate', true
      );
    end if;
    return jsonb_build_object('accepted', true, 'duplicate', true);
  end if;

  if round(p_amount, 2) <> v_amount_due then
    update public.payment_webhook_events
      set processing_status = 'failed', error_code = 'amount_mismatch', processed_at = now()
      where id = v_event_id;
    return jsonb_build_object('accepted', false, 'reason', 'amount_mismatch');
  end if;

  if v_payment_status in ('cancelled', 'expired', 'refunded', 'partially_refunded') then
    update public.payment_webhook_events
      set processing_status = 'ignored', error_code = 'payment_not_payable', processed_at = now()
      where id = v_event_id;
    return jsonb_build_object('accepted', true, 'ignored', true);
  end if;

  if v_payment_status = 'paid' then
    update public.payment_webhook_events
      set processing_status = 'processed', processed_at = now()
      where id = v_event_id;
    return jsonb_build_object('accepted', true, 'already_paid', true);
  end if;

  if p_outcome = 'succeeded' then
    update public.payment_attempts
      set status = 'succeeded', completed_at = coalesce(completed_at, now()), updated_at = now()
      where id = v_attempt_id;
    update public.payments
      set status = 'paid', paid_at = coalesce(paid_at, now()),
          failure_code = null, failure_message = null, updated_at = now()
      where id = v_payment_id;
  elsif p_outcome = 'failed' then
    update public.payment_attempts
      set status = 'failed', failure_code = left(p_error_code, 100),
          completed_at = coalesce(completed_at, now()), updated_at = now()
      where id = v_attempt_id;
    update public.payments
      set status = 'failed', failure_code = left(p_error_code, 100),
          updated_at = now()
      where id = v_payment_id and status <> 'paid';
  else
    update public.payment_attempts
      set status = 'pending', updated_at = now()
      where id = v_attempt_id and status not in ('succeeded', 'failed', 'cancelled', 'expired');
    update public.payments
      set status = 'pending', updated_at = now()
      where id = v_payment_id and status not in ('paid', 'cancelled', 'expired', 'refunded', 'partially_refunded');
  end if;

  update public.payment_webhook_events
    set processing_status = 'processed', processed_at = now()
    where id = v_event_id;

  return jsonb_build_object('accepted', true, 'duplicate', false, 'payment_id', v_payment_id);
end;
$$;

revoke all on function public.process_verified_payment_webhook(
  text, text, text, text, text, numeric, text, text, text
) from public, anon, authenticated;
grant execute on function public.process_verified_payment_webhook(
  text, text, text, text, text, numeric, text, text, text
) to service_role;

comment on function public.process_verified_payment_webhook(
  text, text, text, text, text, numeric, text, text, text
) is 'Service-role-only atomic webhook ingestion. Marks the canonical payment ledger only; it never activates a service entitlement.';

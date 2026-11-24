# Unified payment core

## Scope
The unified payment center is an adapter layer over existing My Car service workflows. It does not replace or delete historical manual-transfer records.

## Initial providers
- `paymob`
- `fawry`

Both are seeded disabled in `payment_gateways`. No credentials are stored in PostgreSQL. Provider secrets belong in Supabase Edge Function secrets only.

## Canonical records
- `payments`: one logical charge for one service entitlement, with explicit original amount, discount, previously paid credit, and final amount due.
- `payment_attempts`: one row per provider checkout/retry. Its `provider_reference` must be the exact merchant correlation reference sent to the provider (Paymob order ID or Fawry merchantRefNumber).
- `payment_webhook_events`: provider event idempotency and processing audit; stores only a SHA-256 payload digest and minimal event metadata.
- `payment_gateways`: safe, non-secret routing configuration.

## Webhook receiver
The staged `payments-webhook` Edge Function accepts POST JSON only, limits the body to 64 KiB, verifies the provider signature before parsing the event into a canonical payment event, and calls the service-role-only `process_verified_payment_webhook` database function.

- Paymob is selected by the presence of the `hmac` query parameter; HMAC-SHA512 and the configured integration ID are checked. Correlation uses `obj.order.id`; the transaction `obj.id` is the event ID.
- Fawry Notification V2 uses `messageSignature` SHA-256 verification. Correlation uses `merchantRefNumber`; the callback `requestId` is the event ID so later status updates for the same order are not mistaken for duplicates. The canonical charge is compared with `orderAmount` (excluding Fawry fees); `paymentAmount` may be higher because it can include fees and must not be less than `orderAmount`.
- The database function locks the payment attempt and canonical payment, validates provider, EGP amount and enabled gateway, deduplicates the provider event, and updates the attempt/payment ledger in one transaction.
- The RPC is executable only by `service_role`; it is not a browser API.
- The endpoint does not store raw callback payloads or card data, and does not activate a vehicle, subscription, or advertisement. Service-specific entitlement settlement and existing admin review gates remain a later integration step.

The function is configured with `verify_jwt = false` because provider servers do not send a Supabase user JWT. This is safe only because provider signature verification is mandatory and missing secrets fail closed. The provider gateway must also be enabled in the database before events can be accepted.

## Safety invariants
1. A browser redirect never proves payment success.
2. Only a verified provider callback/webhook or a trusted server-side provider status query can mark a payment paid.
3. The amount and service purpose are calculated server-side from the authoritative service record and pricing configuration.
4. Repeated callbacks are idempotent; unique provider event IDs and provider references prevent duplicate processing.
5. Existing manual transfer flows and historical records remain available during rollout.
6. No card number, CVV, API secret, HMAC secret, or raw webhook payload is stored in these tables.

## Data API exposure
Supabase changed the default behavior for newly created public tables: they are not automatically exposed through the Data API. The webhook uses a narrowly scoped Postgres RPC through the service role; browser roles remain restricted by SQL grants and RLS. Table exposure alone must never be treated as authorization.

## Rollout sequence
1. Apply and verify the schema and webhook RPC migrations in a controlled Supabase migration window.
2. Add merchant test credentials directly as Supabase Edge Function secrets; never send them through chat or commit them.
3. Deploy the webhook to a non-production/test environment and register its URL with each provider.
4. Implement authenticated payment-intent creation and provider-specific adapters that save the exact merchant correlation reference in `payment_attempts.provider_reference`.
5. Integrate one service at a time, preserving admin review gates.
6. Test sandbox success, failure, cancellation, expiry, duplicate callback, amount mismatch, delayed callback, and refund.
7. Enable a provider only after merchant credentials and explicit production approval are supplied.

## Legacy service mapping (to be confirmed against each UI submission path)
- Vehicle registration/renewal: `vehicle_payment_submissions` + `vehicles`.
- Company plans: `company_subscriptions`.
- Advertising: `vehicle_promotions`.
- Managed sourcing: `managed_sourcing_requests` and `managed_sourcing_subscriptions`.
- Discounts: existing `discount_code_redemptions` remains authoritative for eligibility/redemption.

The first migration creates the ledger only. The second adds atomic webhook ingestion. Neither migration has been applied to production; no provider is enabled and no service entitlement is activated by the webhook.

## Authenticated checkout intent API
The staged `create-payment-intent` Edge Function is the authenticated entry point for starting a hosted checkout. It accepts only a service purpose, source entity UUID, provider code, idempotency key, and (for vehicle registration) period/coupon inputs. It never accepts an amount from the browser.

Example request:
```json
{
  "purpose": "company_subscription",
  "entity_id": "SOURCE-ROW-UUID",
  "provider": "paymob",
  "idempotency_key": "client-generated-unique-operation-key"
}
```

The server resolves the signed-in user from the Supabase JWT, verifies source-row ownership/membership inside a service-role-only SQL RPC, calculates the final amount from the authoritative service row/settings, and creates a canonical payment plus provider attempt. Paymob uses the Egypt Intention API and returns a hosted Unified Checkout URL. The API response contains only the checkout URL, payment/attempt IDs, amount, and currency; it never returns the Paymob secret key.

Supported source records:
- Vehicle registration: a vehicle in `pending_payment` with `payment_status=pending`; amount is calculated from `platform_settings` and the selected period. A coupon is validated and reserved in `discount_code_redemptions` by the server.
- Company subscription: a pending `company_subscriptions` row with its server-calculated final amount.
- Advertising: a pending `vehicle_promotions` row; the amount due respects the saved discount and previous-payment credit.
- Managed sourcing request: an `awaiting_payment` request with a quoted fee.
- Managed sourcing subscription: a pending-review subscription with a submitted/not-submitted payment state.

The source service row is not marked paid or activated by intent creation. That happens only in the later service-specific settlement migration after a verified webhook.

## Required Edge Function secrets
- `PAYMOB_SECRET_KEY`
- `PAYMOB_PUBLIC_KEY`
- `PAYMOB_HMAC_SECRET`
- `PAYMOB_INTEGRATION_IDS` (comma-separated numeric IDs)
- `MYCAR_APP_URL` (the HTTPS app origin used for the customer return page)
- Supabase-provided `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`

Fawry checkout creation deliberately returns a not-implemented response until the merchant confirms the exact contracted FawryPay checkout product/API version. Fawry notification verification is already staged separately; notification verification alone is not a complete checkout integration.

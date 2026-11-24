# Unified payment core

## Scope
The unified payment center is an adapter layer over existing My Car service workflows. It does not replace or delete historical manual-transfer records.

## Initial providers
- `paymob`
- `fawry`

Both are seeded disabled in `payment_gateways`. No credentials are stored in PostgreSQL. Provider secrets belong in Supabase Edge Function secrets only.

## Canonical records
- `payments`: one logical charge for one service entitlement, with explicit original amount, discount, previously paid credit, and final amount due.
- `payment_attempts`: one row per provider checkout/retry.
- `payment_webhook_events`: provider event idempotency and processing audit.
- `payment_gateways`: safe, non-secret routing configuration.

## Safety invariants
1. A browser redirect never proves payment success.
2. Only a verified provider callback/webhook or a trusted server-side provider status query can mark a payment paid.
3. The amount and service purpose are calculated server-side from the authoritative service record and pricing configuration.
4. Repeated callbacks are idempotent; unique provider event IDs and provider references prevent duplicate processing.
5. Existing manual transfer flows and historical records remain available during rollout.
6. No card number, CVV, API secret, HMAC secret, or raw webhook payload is stored in these tables.

## Data API exposure
Supabase changed the default behavior for newly created public tables: they are not automatically exposed through the Data API. Before any Edge Function uses the Supabase client/PostgREST to query these ledger tables, explicitly review and enable the required table exposure in the project's Data API settings. Keep browser roles restricted by the SQL grants and RLS policies; table exposure alone must never be treated as authorization. Alternatively, keep ledger tables private and access them through narrowly scoped database functions or a server-side database connection.

## Rollout sequence
1. Apply and verify the schema migration in a controlled Supabase migration window.
2. Implement authenticated payment-intent creation and provider-specific adapters.
3. Implement public webhook endpoints with provider signature verification and event deduplication.
4. Integrate one service at a time, beginning with a low-risk test flow.
5. Test sandbox success, failure, cancellation, expiry, duplicate callback, amount mismatch, and refund.
6. Enable a provider only after merchant credentials and production approval are supplied.

## Legacy service mapping (to be confirmed against each UI submission path)
- Vehicle registration/renewal: `vehicle_payment_submissions` + `vehicles`.
- Company plans: `company_subscriptions`.
- Advertising: `vehicle_promotions`.
- Managed sourcing: `managed_sourcing_requests` and `managed_sourcing_subscriptions`.
- Discounts: existing `discount_code_redemptions` remains authoritative for eligibility/redemption.

The first migration intentionally creates the ledger only. It does not auto-activate any service and does not alter live payment workflows.

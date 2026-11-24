# Unified payment service integration map

Status: implementation planning on `feat/unified-payment-center`. This document does not enable a provider, alter production data, or change the existing manual-transfer flows.

## Existing payment entry points

| Service | Current UI / flow | Current service record | Existing approval / activation rule | Integration rule |
| --- | --- | --- | --- | --- |
| Vehicle registration and renewal | `src/components/WorkspacePage.tsx` → `submitTransfer` | `vehicle_payment_submissions` | Admin reviews the transfer submission; vehicle status is not activated by a browser redirect | Create a canonical payment against the vehicle and registration period. Keep proof upload and manual submission as a separate provider mode. |
| Company subscription | `src/components/CompanySubscriptionsPage.tsx` → `submit` | `company_subscriptions` | Subscription starts after admin verifies payment; active rows require verified/waived payment | Server loads the selected plan and billing cycle, computes price and discount, then creates the subscription/payment relationship. |
| Vehicle advertising / featured advertising | `src/components/AdvertisingPlansPage.tsx` → `submitRequest` | `vehicle_promotions` | Promotion is reviewed; only approved + verified/waived rows are active. Existing pending promotion can be upgraded and its paid credit deducted | Server re-reads plan, placement, pending promotion, coupon and previous credit. Never trust browser-supplied due amount or credit. |
| Managed sourcing subscription | `src/components/ManagedSourcingPage.tsx` → `submitSubscription` | `managed_sourcing_subscriptions` | Admin review verifies payment and activates subscription | Server re-reads package price, included requests, coupon and organization ownership. |
| Managed sourcing per-request fee | `src/components/ManagedSourcingPage.tsx` → `submitPayment` | `managed_sourcing_requests` and `managed_sourcing_actions` | Admin sets quote and awaiting-payment state; payment is verified through the managed-sourcing workflow | Server confirms the request belongs to the company, quote is payable, and payment has not already been fulfilled. Preserve the action timeline. |
| Independent search / other | No general-purpose online checkout flow confirmed in the inspected UI | Existing managed-sourcing records cover the current request workflow | Depends on service workflow | Do not enable a generic amount/purpose endpoint until a concrete service record and entitlement rule are defined. |

## Existing discount behavior

- Vehicle registration uses `preview_discount_code` with service `vehicle_registration`, vehicle id, and owner period months.
- Company subscriptions use `company_subscription`, plan id, and monthly/yearly cycle.
- Advertising uses `vehicle_advertising`, advertising plan id, and existing pending-upgrade credit logic.
- Managed sourcing packages use `managed_sourcing`, package id, and period metadata.

A preview is informational only. The payment-creation endpoint must revalidate the code and calculate the final amount server-side immediately before creating a payment. A client preview must never authorize a price or a redemption.

## Canonical payment lifecycle

1. The authenticated client requests checkout for a specific service record or a server-validated purchase intent.
2. The server validates identity, organization membership, service state, pricing, coupon eligibility, existing pending records, and idempotency key.
3. The server inserts one `payments` ledger row and a provider-specific `payment_attempts` row.
4. The provider adapter creates a checkout session using server-held credentials and returns only the hosted checkout URL and safe display details.
5. The browser redirects to the provider. A return URL is for user experience only and must not mark a payment as paid.
6. The webhook endpoint verifies the provider signature using the exact provider specification, checks the amount/currency/reference against the stored attempt, and deduplicates the event.
7. Only a verified server-side paid event may update the canonical ledger and call a service-specific activation routine. Service activation must be idempotent and must not bypass existing admin review where the business process requires it.
8. If webhook delivery is delayed or ambiguous, query the provider from the server using the stored reference. Never trust a browser callback or a client-supplied status.

## Required invariants

- EGP only until a separately reviewed multi-currency requirement exists.
- Never accept `amount`, `discount_amount`, `amount_due`, provider credentials, or a final payment status as authoritative client input.
- Do not store PAN, CVV, bank credentials, API secrets, HMAC secrets, or raw cardholder payloads.
- Store provider secrets only as Supabase Edge Function secrets.
- Use a stable idempotency key per purchase intent and unique provider references.
- Webhook event identity must be unique per provider; duplicate deliveries must not duplicate entitlements.
- Preserve the current manual transfer workflow and all existing service tables during rollout.
- A paid gateway event may satisfy the payment condition, but must not silently approve a vehicle, advertisement, or account that still requires platform review.
- Retry means a new provider attempt for the same canonical payment, not a second service entitlement.
- Refunds and chargebacks require explicit service-specific compensation behavior; do not automatically delete or roll back historical records.

## Safe rollout order

1. Review and harden the core schema and RLS in PR #245.
2. Add read-only/admin payment-center visibility and operational diagnostics.
3. Implement server-side pricing and purchase-intent validation per service, beginning with the simplest isolated service.
4. Implement provider adapters against sandbox credentials and provider documentation.
5. Implement signed webhook verification, duplicate-event handling, reconciliation, and idempotent service activation.
6. Add checkout UI behind a disabled feature flag while manual transfer remains available.
7. Run sandbox end-to-end tests for successful, failed, expired, duplicate, delayed-webhook, mismatched-amount, and retry scenarios.
8. Enable production credentials and provider routing only after merchant onboarding, legal/finance review, explicit approval, and a tested rollback plan.

## Open implementation decisions

- Confirm the merchant's Paymob account product and integration method, and the FawryPay product/merchant contract; provider APIs and signature schemes must be implemented from the exact contracted product documentation, not assumptions.
- Confirm whether the platform wants Paymob as primary and Fawry as fallback, or administrator-selectable routing.
- Define the service-specific activation routines and whether each provider-paid service still enters the existing admin review queue.
- Confirm refund, partial refund, chargeback, invoice/receipt, and reconciliation policies.

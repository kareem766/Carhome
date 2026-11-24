# My Car payment-provider onboarding checklist

This checklist is for the merchant account owner and the technical implementation. It does not authorize production activation.

## Paymob Accept

Ask Paymob to confirm that the account is approved for the Egypt Accept product and Unified Checkout, and obtain test-mode values for:

- Secret Key — server-side only.
- Public Key — used only to construct the hosted checkout URL.
- HMAC Secret — separate from the Secret Key; used only to verify transaction callbacks.
- Integration ID for each enabled test payment method (card, wallet, etc.); configure the comma-separated list as `PAYMOB_INTEGRATION_IDS`.
- Confirmation that the account is using the Intention API and that the configured integration IDs match the same test/live mode as the corresponding key.

Backend protocol currently documented for this integration:
- Create Intention from the backend using `POST /v1/intention/` and `Authorization: Token <Secret Key>`.
- Send amount in EGP cents, currency EGP, configured payment method integration IDs, unique merchant reference, notification URL, and return URL.
- Redirect to hosted Unified Checkout with the returned client secret and Public Key.
- Verify the server-to-server transaction callback using the HMAC Secret and the documented SHA-512 field order. Do not trust the browser redirect.

## FawryPay

Ask Fawry to confirm the exact contracted product and version. The documentation contains multiple checkout products and legacy paths; do not mix their request/signature formats.

Obtain test-mode values for:
- Merchant Code.
- Secure Key — server-side only.
- The exact test API base URL and the contracted checkout method (hosted checkout/Express Checkout or server API).
- Enabled payment methods and any merchant configuration required for each.
- Server Notification V2 callback registration for the test environment.
- Get Payment Status V2 availability and the matching request format.

Fawry's V2 callback endpoint must be registered during merchant onboarding; provide the test callback URL when Fawry requests it. Use the V2 `messageSignature` SHA-256 scheme and verify the payment amount and merchant reference against the stored attempt. Do not implement the legacy V1 MD5 notification path.

## Secret handling

Do not paste API keys, HMAC secrets, Secure Keys, or any payment credentials into ChatGPT, GitHub issues, source files, browser storage, or client-side environment variables.

After merchant onboarding, add each credential directly as a Supabase Edge Function secret in the My Car project. Use distinct test and production secret sets. Never place secret values in the `payment_gateways.public_settings` JSON.

## Before sandbox testing

- Confirm the legal merchant name and account ownership match the entity receiving settlements.
- Confirm who pays gateway fees and whether fees are added to the customer or absorbed by My Car.
- Confirm refund, partial-refund, cancellation, expiry, chargeback, settlement, and reconciliation procedures.
- Use synthetic/test transactions only; test duplicate, delayed, failed, expired, amount-mismatch, and retry callbacks.
- Keep both providers disabled in the platform until each callback and status-reconciliation path passes.
- Production enablement requires separate explicit approval after merchant approval and successful sandbox evidence.

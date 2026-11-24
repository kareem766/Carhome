import { normalizeFawryCallback, normalizePaymobCallback } from "./payment-webhook.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("Paymob callback maps only expected integration and EGP amount", () => {
  const payload = { type: "TRANSACTION", obj: {
    id: 12345, amount_cents: 125050, currency: "EGP", integration_id: 9988,
    order: { id: 777 }, pending: false, success: true,
  }};
  const event = normalizePaymobCallback(payload, ["9988", "9989"]);
  assert(event?.amount === 1250.5 && event.providerReference === "777" && event.outcome === "succeeded", "Paymob event normalization failed");
  assert(normalizePaymobCallback(payload, ["wrong"]) === null, "Unexpected integration must be rejected");
});

Deno.test("Fawry callback requires matching paid order and payment amounts", () => {
  const payload = {
    requestId: "event-uuid-1", fawryRefNumber: "F-1", merchantRefNumber: "MYCAR-1",
    paymentAmount: "252.00", orderAmount: 250, orderStatus: "PAID",
  };
  const event = normalizeFawryCallback(payload);
  assert(event?.amount === 250 && event.providerReference === "MYCAR-1" && event.providerEventId === "event-uuid-1" && event.outcome === "succeeded", "Fawry event normalization failed");
  assert(normalizeFawryCallback({ ...payload, paymentAmount: 249 }) === null, "Partial/mismatched amount must be rejected");
});

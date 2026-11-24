export type VerifiedProviderEvent = {
  providerCode: "paymob" | "fawry";
  providerEventId: string;
  eventType: string;
  providerReference: string;
  amount: number;
  currency: "EGP";
  outcome: "succeeded" | "failed" | "pending";
  errorCode: string | null;
};

function finiteAmount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
}

export function normalizePaymobCallback(payload: Record<string, unknown>, expectedIntegrationId: string): VerifiedProviderEvent | null {
  const raw = payload.obj;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const amountCents = obj.amount_cents;
  const amount = typeof amountCents === "number" && Number.isSafeInteger(amountCents) && amountCents >= 0
    ? amountCents / 100 : null;
  const order = obj.order;
  const orderId = order && typeof order === "object" && !Array.isArray(order)
    ? (order as Record<string, unknown>).id : null;
  if (amount === null || (typeof orderId !== "string" && typeof orderId !== "number")) return null;
  if (String(obj.integration_id) !== expectedIntegrationId || obj.currency !== "EGP") return null;
  const eventId = obj.id;
  if (typeof eventId !== "string" && typeof eventId !== "number") return null;
  const pending = obj.pending === true;
  const success = obj.success === true;
  return {
    providerCode: "paymob",
    providerEventId: String(eventId),
    eventType: typeof payload.type === "string" ? payload.type : "TRANSACTION",
    providerReference: String(orderId),
    amount,
    currency: "EGP",
    outcome: pending ? "pending" : success ? "succeeded" : "failed",
    errorCode: success || pending ? null : "provider_declined",
  };
}

export function normalizeFawryCallback(payload: Record<string, unknown>): VerifiedProviderEvent | null {
  const amount = finiteAmount(typeof payload.paymentAmount === "string" ? Number(payload.paymentAmount) : payload.paymentAmount);
  const orderAmount = finiteAmount(typeof payload.orderAmount === "string" ? Number(payload.orderAmount) : payload.orderAmount);
  const ref = payload.fawryRefNumber;
  const merchantRef = payload.merchantRefNumber;
  const status = payload.orderStatus;
  if (amount === null || orderAmount === null || amount !== orderAmount) return null;
  if ((typeof ref !== "string" && typeof ref !== "number") ||
      (typeof merchantRef !== "string" && typeof merchantRef !== "number") ||
      typeof status !== "string") return null;
  const normalizedStatus = status.toUpperCase();
  const outcome = normalizedStatus === "PAID" ? "succeeded"
    : ["FAILED", "CANCELLED", "EXPIRED"].includes(normalizedStatus) ? "failed" : "pending";
  return {
    providerCode: "fawry",
    providerEventId: String(ref),
    eventType: "PAYMENT_STATUS_" + normalizedStatus.slice(0, 40),
    providerReference: String(merchantRef),
    amount,
    currency: "EGP",
    outcome,
    errorCode: outcome === "failed" ? normalizedStatus : null,
  };
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import { verifyFawryNotificationV2, verifyPaymobTransactionHmac } from "../_shared/payment-signatures.ts";
import { normalizeFawryCallback, normalizePaymobCallback, sha256Hex } from "../_shared/payment-webhook.ts";

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

async function readBoundedBody(req: Request, maxBytes = 64 * 1024): Promise<Uint8Array | null> {
  if (!req.body) return null;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const contentType = req.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") return json({ error: "unsupported_media_type" }, 415);

  const rawBody = await readBoundedBody(req);
  if (!rawBody || rawBody.byteLength === 0) return json({ error: "invalid_or_oversized_body" }, 400);

  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "invalid_payload" }, 400);
    payload = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const url = new URL(req.url);
  const paymobHmac = url.searchParams.get("hmac") ?? "";
  const provider = paymobHmac ? "paymob" : "fawry";
  let event;
  if (provider === "paymob") {
    const secret = Deno.env.get("PAYMOB_HMAC_SECRET") ?? "";
    const integrationId = Deno.env.get("PAYMOB_INTEGRATION_ID") ?? "";
    if (!secret || !integrationId) return json({ error: "provider_not_configured" }, 503);
    if (!await verifyPaymobTransactionHmac(payload, paymobHmac, secret)) return json({ error: "invalid_signature" }, 401);
    event = normalizePaymobCallback(payload, integrationId);
  } else {
    const secret = Deno.env.get("FAWRY_NOTIFICATION_SECRET") ?? "";
    if (!secret) return json({ error: "provider_not_configured" }, 503);
    if (!await verifyFawryNotificationV2(payload, secret)) return json({ error: "invalid_signature" }, 401);
    event = normalizeFawryCallback(payload);
  }
  if (!event) return json({ error: "invalid_provider_event" }, 422);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "server_not_configured" }, 503);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("process_verified_payment_webhook", {
    p_provider_code: event.providerCode,
    p_provider_event_id: event.providerEventId,
    p_event_type: event.eventType,
    p_payload_sha256: await sha256Hex(rawBody),
    p_provider_reference: event.providerReference,
    p_amount: event.amount,
    p_currency: event.currency,
    p_outcome: event.outcome,
    p_error_code: event.errorCode,
  });
  if (error) return json({ error: "webhook_processing_failed" }, 500);
  const result = data as Record<string, unknown> | null;
  if (!result?.accepted) {
    const reason = result?.reason;
    const status = reason === "gateway_disabled" ? 503
      : reason === "payment_attempt_not_found" ? 404
      : reason === "amount_mismatch" ? 409 : 422;
    return json({ error: typeof reason === "string" ? reason : "event_rejected" }, status);
  }
  return json({ received: true, duplicate: result.duplicate === true, already_paid: result.already_paid === true });
});

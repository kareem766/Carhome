import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import { normalizeEgyptianPhone } from "../_shared/payment-intent.ts";

const corsHeadersFor = (req: Request) => {
  const requestOrigin = req.headers.get("Origin") ?? "";
  const configuredOrigin = Deno.env.get("MYCAR_ALLOWED_ORIGIN") ?? "*";
  const allowedOrigins = new Set<string>();
  for (const value of [Deno.env.get("MYCAR_APP_URL") ?? "", ...(Deno.env.get("MYCAR_ALLOWED_ORIGINS") ?? "").split(",")]) {
    try { if (value.trim()) allowedOrigins.add(new URL(value.trim()).origin); } catch { /* invalid origins are not allowed */ }
  }
  const allowOrigin = configuredOrigin === "*" ? "*" : allowedOrigins.has(requestOrigin) ? requestOrigin : configuredOrigin;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-idempotency-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
};
const json = (body: Record<string, unknown>, status = 200, headers: Record<string,string> = {}) => new Response(JSON.stringify(body), {
  status, headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

type RequestBody = {
  purpose?: string;
  entity_id?: string;
  provider?: string;
  idempotency_key?: string;
  period_months?: number;
  coupon_code?: string | null;
  return_origin?: string;
};

function validUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function buildCheckoutUrl(publicKey: string, clientSecret: string): string {
  const url = new URL("https://accept.paymob.com/unifiedcheckout/");
  url.searchParams.set("publicKey", publicKey);
  url.searchParams.set("clientSecret", clientSecret);
  return url.toString();
}

Deno.serve(async (req: Request) => {
  const corsHeaders = corsHeadersFor(req);
  const respond = (body: Record<string, unknown>, status = 200) => json(body, status, corsHeaders);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token === authHeader) return respond({ error: "authentication_required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return respond({ error: "server_not_configured" }, 503);

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > 16 * 1024) return respond({ error: "request_too_large" }, 413);
  let body: RequestBody;
  try {
    const raw = await req.text();
    if (raw.length > 16 * 1024) return respond({ error: "request_too_large" }, 413);
    body = JSON.parse(raw);
  } catch {
    return respond({ error: "invalid_json" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      !validUuid(body.entity_id) ||
      !["vehicle_registration","company_subscription","advertising","featured_advertising","managed_sourcing_request","managed_sourcing_subscription"].includes(body.purpose ?? "") ||
      !["paymob","fawry"].includes(body.provider ?? "") ||
      typeof body.idempotency_key !== "string" || body.idempotency_key.length < 12 || body.idempotency_key.length > 120 ||
      (body.period_months !== undefined && (!Number.isInteger(body.period_months) || body.period_months < 1 || body.period_months > 24)) ||
      (body.coupon_code !== undefined && body.coupon_code !== null && (typeof body.coupon_code !== "string" || body.coupon_code.length > 80))) {
    return respond({ error: "invalid_request" }, 400);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return respond({ error: "invalid_session" }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const provider = body.provider as "paymob" | "fawry";
  if (provider === "fawry") {
    return respond({ error: "fawry_checkout_requires_confirmed_merchant_product", message: "Fawry checkout adapter is intentionally held until the contracted FawryPay product and API version are confirmed." }, 501);
  }

  const { data: gateway, error: gatewayError } = await admin.from("payment_gateways")
    .select("is_enabled,environment,public_settings")
    .eq("provider_code", "paymob").maybeSingle();
  if (gatewayError) return respond({ error: "gateway_configuration_unavailable" }, 503);
  if (!gateway?.is_enabled) return respond({ error: "gateway_disabled" }, 503);

  const { data: profile } = await admin.from("profiles")
    .select("display_name,phone,contact_email,address")
    .eq("id", authData.user.id).maybeSingle();
  const phone = normalizeEgyptianPhone(String(profile?.phone ?? ""));
  if (!phone) return respond({ error: "billing_phone_required", message: "أضف رقم موبايل مصري صحيح في بيانات حسابك قبل الدفع." }, 422);
  const email = String(profile?.contact_email ?? authData.user.email ?? "").trim();
  if (!email || !email.includes("@")) return respond({ error: "billing_email_required" }, 422);

  const secretKey = Deno.env.get("PAYMOB_SECRET_KEY") ?? "";
  const publicKey = Deno.env.get("PAYMOB_PUBLIC_KEY") ?? "";
  const integrationIds = (Deno.env.get("PAYMOB_INTEGRATION_IDS") ?? "").split(",").map(v => v.trim()).filter(v => /^\d+$/.test(v));
  if (!secretKey || !publicKey || integrationIds.length === 0) return respond({ error: "paymob_credentials_missing" }, 503);

  const { data: prepared, error: prepareError } = await admin.rpc("create_mycar_payment", {
    p_user_id: authData.user.id,
    p_purpose: body.purpose,
    p_entity_id: body.entity_id,
    p_provider_code: provider,
    p_idempotency_key: body.idempotency_key,
    p_period_months: body.period_months ?? 1,
    p_coupon_code: body.coupon_code ?? null,
  });
  if (prepareError) return respond({ error: "payment_preparation_failed" }, 500);
  if (!prepared?.ok) {
    const reason = String(prepared?.error ?? "payment_not_available");
    const status = reason === "not_authorized" ? 403
      : reason === "gateway_disabled" ? 503
      : reason === "already_paid" ? 409
      : reason.endsWith("_not_payable") ? 409 : 422;
    return respond({ error: reason }, status);
  }
  if (prepared.checkout_url) {
    return respond({
      payment_id: prepared.payment_id,
      attempt_id: prepared.attempt_id,
      amount_due: prepared.amount_due,
      currency: "EGP",
      checkout_url: prepared.checkout_url,
      reused: true,
    });
  }

  const appUrl = Deno.env.get("MYCAR_APP_URL") ?? "";
  const allowedOrigins = new Set<string>();
  try {
    const productionOrigin = new URL(appUrl);
    if (productionOrigin.protocol !== "https:") throw new Error("https_required");
    allowedOrigins.add(productionOrigin.origin);
    for (const value of (Deno.env.get("MYCAR_ALLOWED_ORIGINS") ?? "").split(",")) {
      const candidate = value.trim();
      if (!candidate) continue;
      const parsed = new URL(candidate);
      if (parsed.protocol !== "https:") throw new Error("https_required");
      allowedOrigins.add(parsed.origin);
    }
  } catch {
    await admin.rpc("fail_mycar_payment_attempt", { p_attempt_id: prepared.attempt_id, p_error_code: "app_url_not_configured" });
    return respond({ error: "app_url_not_configured" }, 503);
  }

  let appOrigin: string;
  try {
    const requestedOrigin = body.return_origin ? new URL(body.return_origin) : new URL(appUrl);
    if (requestedOrigin.protocol !== "https:" || !allowedOrigins.has(requestedOrigin.origin)) {
      throw new Error("return_origin_not_allowed");
    }
    appOrigin = requestedOrigin.origin;
  } catch {
    await admin.rpc("fail_mycar_payment_attempt", { p_attempt_id: prepared.attempt_id, p_error_code: "return_origin_not_allowed" });
    return respond({ error: "return_origin_not_allowed" }, 403);
  }

  const displayName = String(profile?.display_name ?? "My Car Customer").trim().split(/\s+/);
  const firstName = (displayName[0] || "MyCar").slice(0, 60);
  const lastName = (displayName.slice(1).join(" ") || "Customer").slice(0, 60);
  const amountCents = Math.round(Number(prepared.amount_due) * 100);
  if (!Number.isSafeInteger(amountCents) || amountCents < 100) {
    await admin.rpc("fail_mycar_payment_attempt", { p_attempt_id: prepared.attempt_id, p_error_code: "invalid_amount" });
    return respond({ error: "invalid_amount" }, 422);
  }
  const notificationUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/payments-webhook`;
  const redirectionUrl = new URL("/payment/result", appOrigin);
  redirectionUrl.searchParams.set("payment_id", prepared.payment_id);

  const description = String(prepared.purpose ?? "My Car service").replace(/[^\p{L}\p{N}\s_-]/gu, "").slice(0, 100) || "My Car service";
  const requestPayload = {
    amount: amountCents,
    currency: "EGP",
    payment_methods: integrationIds.map(Number),
    items: [{ name: description, amount: amountCents, description, quantity: 1 }],
    billing_data: {
      first_name: firstName,
      last_name: lastName,
      phone_number: phone,
      email,
      apartment: "NA",
      floor: "NA",
      street: "NA",
      building: "NA",
      city: "NA",
      country: "EGY",
      state: "NA",
    },
    special_reference: prepared.merchant_reference,
    expiration: 3600,
    notification_url: notificationUrl,
    redirection_url: redirectionUrl.toString(),
  };

  let providerResponse: Response;
  try {
    providerResponse = await fetch("https://accept.paymob.com/v1/intention/", {
      method: "POST",
      headers: { "Authorization": `Token ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    await admin.rpc("fail_mycar_payment_attempt", { p_attempt_id: prepared.attempt_id, p_error_code: "paymob_network_error" });
    return respond({ error: "provider_unreachable" }, 502);
  }

  let responseBody: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = await providerResponse.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) responseBody = parsed as Record<string, unknown>;
  } catch { /* deliberately omit provider response body from logs and user output */ }

  if (!providerResponse.ok || !responseBody) {
    await admin.rpc("fail_mycar_payment_attempt", { p_attempt_id: prepared.attempt_id, p_error_code: `paymob_http_${providerResponse.status}` });
    return respond({ error: "provider_intention_failed", provider_status: providerResponse.status }, 502);
  }

  const orderId = responseBody.intention_order_id ?? (Array.isArray(responseBody.payment_keys)
    ? (responseBody.payment_keys[0] as Record<string, unknown> | undefined)?.order_id : null);
  const clientSecret = responseBody.client_secret;
  if ((typeof orderId !== "string" && typeof orderId !== "number") || typeof clientSecret !== "string" || !clientSecret) {
    await admin.rpc("fail_mycar_payment_attempt", { p_attempt_id: prepared.attempt_id, p_error_code: "paymob_invalid_intention_response" });
    return respond({ error: "provider_invalid_response" }, 502);
  }

  const checkoutUrl = buildCheckoutUrl(publicKey, clientSecret);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const { data: finalized, error: finalizeError } = await admin.rpc("finalize_mycar_payment_attempt", {
    p_attempt_id: prepared.attempt_id,
    p_provider_code: "paymob",
    p_provider_reference: String(orderId),
    p_checkout_url: checkoutUrl,
    p_expires_at: expiresAt,
  });
  if (finalizeError || !finalized?.ok) {
    return respond({ error: "payment_checkout_finalize_failed" }, 502);
  }

  return respond({
    payment_id: prepared.payment_id,
    attempt_id: prepared.attempt_id,
    amount_due: prepared.amount_due,
    currency: "EGP",
    checkout_url: checkoutUrl.toString(),
    reused: false,
  });
});

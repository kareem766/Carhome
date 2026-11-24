import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
};
const json = (body: Record<string, unknown>, status = 200, headers: Record<string,string> = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

Deno.serve(async (req: Request) => {
  const corsHeaders = corsHeadersFor(req);
  const respond = (body: Record<string, unknown>, status = 200) => json(body, status, corsHeaders);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "method_not_allowed" }, 405);
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token === authHeader) return respond({ error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return respond({ error: "server_not_configured" }, 503);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return respond({ error: "invalid_session" }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.from("payment_gateways")
    .select("provider_code,display_name,is_enabled,supported_payment_methods,priority,environment")
    .eq("is_enabled", true)
    .order("priority", { ascending: true });

  if (error) return respond({ error: "gateway_configuration_unavailable" }, 503);
  const paymobReady = Boolean(
    Deno.env.get("PAYMOB_SECRET_KEY") &&
    Deno.env.get("PAYMOB_PUBLIC_KEY") &&
    Deno.env.get("PAYMOB_HMAC_SECRET") &&
    Deno.env.get("PAYMOB_INTEGRATION_IDS")
  );
  const readyProviders = (data ?? []).filter((gateway) =>
    gateway.provider_code === "paymob" && paymobReady
  );
  return respond({
    enabled_providers: readyProviders.map((gateway) => ({
      provider_code: gateway.provider_code,
      display_name: gateway.display_name,
      supported_payment_methods: gateway.supported_payment_methods ?? [],
      environment: gateway.environment,
    })),
  });
});

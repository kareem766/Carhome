import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ success: false, error: "Method not allowed" }, 405);

  try {
    const payload = await req.json();
    const action = String(payload.action || "submit");
    if (action === "status") {
      const accountEmail = String(payload.accountEmail || "").trim().toLowerCase();
      if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(accountEmail) || accountEmail.length > 254) {
        return reply({ success: false, error: "Invalid account email" }, 400);
      }
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!supabaseUrl || !serviceRoleKey) return reply({ success: false, error: "Support service is unavailable" }, 503);
      const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
      const { data: existing, error: lookupError } = await admin
        .from("public_support_requests")
        .select("request_code,status")
        .eq("account_email", accountEmail)
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lookupError) throw lookupError;
      return reply({ success: true, pending: Boolean(existing), reference: existing?.request_code || null, status: existing?.status || null });
    }
    if (action !== "submit") return reply({ success: false, error: "Unsupported action" }, 400);
    // Quietly accept honeypot submissions without storing them.
    if (typeof payload.website === "string" && payload.website.trim()) {
      return reply({ success: true, reference: "MC-RECEIVED" });
    }

    const contactName = String(payload.contactName || "").trim();
    const contactEmail = String(payload.contactEmail || "").trim().toLowerCase();
    const accountEmail = String(payload.accountEmail || "").trim().toLowerCase();
    const phone = String(payload.phone || "").trim();
    const message = String(payload.message || "").trim();

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (contactName.length < 2 || contactName.length > 100 ||
        !emailPattern.test(contactEmail) || contactEmail.length > 254 ||
        !emailPattern.test(accountEmail) || accountEmail.length > 254 ||
        phone.length > 30 || message.length < 10 || message.length > 3000) {
      return reply({ success: false, error: "راجع البيانات المدخلة وتأكد من صحة البريد الإلكتروني وأن تفاصيل الطلب لا تقل عن 10 أحرف." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return reply({ success: false, error: "خدمة استقبال طلبات الدعم غير مهيأة حاليًا." }, 503);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: existingRequest, error: existingError } = await admin
      .from("public_support_requests")
      .select("request_code,status")
      .eq("account_email", accountEmail)
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existingRequest) {
      return reply({ success: true, pending: true, reference: existingRequest.request_code, status: existingRequest.status });
    }

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: rateError } = await admin
      .from("public_support_requests")
      .select("id", { count: "exact", head: true })
      .eq("contact_email", contactEmail)
      .gte("created_at", since);
    if (rateError) throw rateError;
    if ((count || 0) >= 3) {
      return reply({ success: false, error: "تم استلام عدة طلبات من هذا البريد مؤخرًا. حاول مرة أخرى بعد ساعة." }, 429);
    }

    const requestCode = "MC-" + crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
    const { data: savedRequest, error: insertError } = await admin.from("public_support_requests").insert({
      request_code: requestCode,
      contact_name: contactName,
      contact_email: contactEmail,
      account_email: accountEmail,
      phone: phone || null,
      subject: "طلب مراجعة إيقاف الحساب",
      message,
    }).select("id").single();
    if (insertError || !savedRequest) throw insertError || new Error("Unable to save support request");

    const { data: admins, error: adminsError } = await admin.from("platform_admins").select("user_id");
    if (adminsError || !admins?.length) {
      await admin.from("public_support_requests").delete().eq("id", savedRequest.id);
      throw adminsError || new Error("No platform administrators are configured");
    }
    const notifications = admins.map(({ user_id }) => ({
      user_id,
      title: "طلب جديد لمراجعة حساب موقوف",
      body: `وصل طلب مراجعة جديد برقم ${requestCode} للحساب ${accountEmail}.`,
      notification_type: "account",
      action_url: "/workspace/admin/support",
      created_by: null,
    }));
    const { error: notificationError } = await admin.from("platform_notifications").insert(notifications);
    if (notificationError) {
      await admin.from("public_support_requests").delete().eq("id", savedRequest.id);
      throw notificationError;
    }

    return reply({ success: true, pending: true, reference: requestCode, status: "open" });
  } catch (error) {
    console.error("public suspended-account support intake failed", error);
    return reply({ success: false, error: "تعذر حفظ طلبك الآن. حاول مرة أخرى بعد قليل." }, 500);
  }
});

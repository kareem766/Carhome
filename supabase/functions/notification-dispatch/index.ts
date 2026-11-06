import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import webpush from "npm:web-push@3.6.7";

type Delivery = {
  id: string;
  user_id: string;
  category: "transactional" | "marketing";
  title: string;
  body: string;
  action_url: string | null;
  push_status: "pending" | "sent" | "skipped" | "failed";
  email_status: "pending" | "sent" | "skipped" | "failed";
  attempts: number;
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char] ?? char);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const dispatchSecret = Deno.env.get("NOTIFICATION_DISPATCH_SECRET");
  if (!dispatchSecret || req.headers.get("authorization") !== `Bearer ${dispatchSecret}`) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "server_not_configured" }, 503);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: batch, error: claimError } = await supabase.rpc(
    "claim_notification_delivery_batch",
    { p_limit: 25 },
  );
  if (claimError) return json({ error: "queue_claim_failed", detail: claimError.message }, 500);

  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT");
  const brevoKey = Deno.env.get("BREVO_API_KEY");
  const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL");
  const senderName = Deno.env.get("BREVO_SENDER_NAME") || "My Car عربيتي";
  const appBaseUrl = (Deno.env.get("APP_BASE_URL") || "").replace(/\/$/, "");

  let sentPush = 0;
  let sentEmail = 0;
  let failed = 0;

  for (const item of (batch || []) as Delivery[]) {
    let pushStatus = item.push_status;
    let emailStatus = item.email_status;
    const errors: string[] = [];

    const [preferenceResult, subscriptionResult, authResult] = await Promise.all([
      supabase.from("platform_notification_preferences")
        .select("push_enabled,email_enabled,marketing_enabled")
        .eq("user_id", item.user_id).maybeSingle(),
      supabase.from("platform_push_subscriptions")
        .select("id,endpoint,p256dh,auth_key")
        .eq("user_id", item.user_id),
      supabase.auth.admin.getUserById(item.user_id),
    ]);

    if (preferenceResult.error) errors.push("preferences: " + preferenceResult.error.message);
    if (subscriptionResult.error) errors.push("subscriptions: " + subscriptionResult.error.message);
    if (authResult.error) errors.push("auth: " + authResult.error.message);

    const preferences = preferenceResult.data || {
      push_enabled: true, email_enabled: true, marketing_enabled: true,
    };
    const marketingAllowed = item.category !== "marketing" || preferences.marketing_enabled !== false;

    if (pushStatus === "pending" || pushStatus === "failed") {
      if (preferenceResult.error || subscriptionResult.error) {
        pushStatus = "failed";
      } else if (!preferences.push_enabled || !marketingAllowed) {
        pushStatus = "skipped";
      } else if (!(subscriptionResult.data || []).length) {
        pushStatus = "skipped";
      } else if (!vapidPublic || !vapidPrivate || !vapidSubject) {
        pushStatus = "failed";
        errors.push("push: VAPID keys are not configured");
      } else {
        try {
          webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
          const safeActionUrl = item.action_url?.startsWith("/") && !item.action_url.startsWith("//")
            ? item.action_url
            : "/";
          const payload = JSON.stringify({
            id: item.id,
            title: item.title,
            body: item.body,
            url: safeActionUrl,
          });
          const outcomes = await Promise.allSettled((subscriptionResult.data || []).map(async (subscription) => {
            try {
              await webpush.sendNotification({
                endpoint: subscription.endpoint,
                keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
              }, payload, { TTL: 60 * 60 * 24 });
              return "sent";
            } catch (error) {
              const statusCode = Number((error as { statusCode?: number })?.statusCode || 0);
              if (statusCode === 404 || statusCode === 410) {
                await supabase.from("platform_push_subscriptions").delete().eq("id", subscription.id);
                return "expired";
              }
              throw error;
            }
          }));
          const delivered = outcomes.filter((outcome) => outcome.status === "fulfilled" && outcome.value === "sent").length;
          const rejected = outcomes.filter((outcome) => outcome.status === "rejected");
          if (delivered > 0 && rejected.length === 0) {
            pushStatus = "sent"; sentPush++;
          } else if (delivered === 0 && rejected.length === 0) {
            pushStatus = "skipped";
          } else {
            pushStatus = "failed";
            errors.push("push: one or more device deliveries failed");
          }
        } catch (error) {
          pushStatus = "failed";
          errors.push("push: " + String(error).slice(0, 400));
        }
      }
    }

    if (emailStatus === "pending" || emailStatus === "failed") {
      if (preferenceResult.error || authResult.error) {
        emailStatus = "failed";
      } else if (!preferences.email_enabled || !marketingAllowed) {
        emailStatus = "skipped";
      } else if (!authResult.data.user?.email) {
        emailStatus = "skipped";
      } else if (!brevoKey || !senderEmail) {
        emailStatus = "failed";
        errors.push("email: Brevo API key or authenticated sender is not configured");
      } else {
        try {
          const safeActionUrl = item.action_url?.startsWith("/") && !item.action_url.startsWith("//")
            ? item.action_url
            : "/";
          const emailHtml = `<!doctype html><html lang="ar" dir="rtl"><body style="font-family:Arial,sans-serif;background:#f4f7fb;padding:24px;color:#142d4e"><main style="max-width:600px;margin:auto;background:#fff;border-radius:16px;padding:28px"><h2>${escapeHtml(item.title)}</h2><p style="line-height:1.9;white-space:pre-line">${escapeHtml(item.body)}</p>${appBaseUrl ? `<p><a href="${escapeHtml(appBaseUrl + safeActionUrl)}" style="display:inline-block;background:#126b9c;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none">فتح My Car</a></p>` : ""}<p style="color:#64748b;font-size:12px">هذه رسالة مرتبطة بإشعارات حسابك على My Car عربيتي.</p></main></body></html>`;
          const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "api-key": brevoKey, "Content-Type": "application/json", "accept": "application/json" },
            body: JSON.stringify({
              sender: { name: senderName, email: senderEmail },
              to: [{ email: authResult.data.user.email }],
              subject: item.title,
              htmlContent: emailHtml,
              tags: [item.category === "marketing" ? "mycar-marketing" : "mycar-notification"],
            }),
          });
          if (!response.ok) throw new Error(`Brevo returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
          emailStatus = "sent"; sentEmail++;
        } catch (error) {
          emailStatus = "failed";
          errors.push("email: " + String(error).slice(0, 400));
        }
      }
    }

    const hasFailure = pushStatus === "failed" || emailStatus === "failed";
    const exhausted = item.attempts >= 8;
    const nextStatus = hasFailure ? (exhausted ? "failed" : "pending") : "completed";
    const retryDelayMs = Math.min(60_000 * (2 ** Math.max(0, item.attempts - 1)), 60 * 60 * 1000);
    const { error: updateError } = await supabase.from("notification_delivery_outbox").update({
      push_status: pushStatus,
      email_status: emailStatus,
      status: nextStatus,
      available_at: new Date(Date.now() + retryDelayMs).toISOString(),
      locked_at: null,
      last_error: errors.length ? errors.join(" | ").slice(0, 1500) : null,
      updated_at: new Date().toISOString(),
    }).eq("id", item.id);
    if (updateError || hasFailure) failed++;
  }

  return json({
    claimed: (batch || []).length,
    push_sent: sentPush,
    email_sent: sentEmail,
    failed,
  });
});

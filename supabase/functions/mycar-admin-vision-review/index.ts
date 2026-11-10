import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("MYCAR_ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  return btoa(binary);
}

function parseModelJson(raw: string) {
  const cleaned = raw.trim().replace(/^```(?:json)?s*/i, "").replace(/s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model response was not valid JSON");
  return JSON.parse(cleaned.slice(start, end + 1));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearers+/i, "");
  if (!token || token === authHeader) return json({ error: "يلزم تسجيل الدخول." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    (() => {
      try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default; }
      catch { return ""; }
    })();
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "إعدادات الخادم غير مكتملة." }, 503);
  if (!geminiKey) return json({ code: "AI_NOT_CONFIGURED", error: "فحص الصور الذكي غير مفعّل بعد. يلزم إعداد GEMINI_API_KEY في أسرار Supabase." }, 503);

  let body: { entity_type?: string; entity_id?: string };
  try { body = await req.json(); } catch { return json({ error: "صيغة الطلب غير صحيحة." }, 400); }
  const entityType = body.entity_type;
  const entityId = String(body.entity_id ?? "").trim();
  if (!["vehicle", "payment"].includes(String(entityType)) || !entityId || entityId.length > 100) {
    return json({ error: "نوع السجل أو رقمه غير صالح." }, 400);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "انتهت جلسة الدخول." }, 401);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: adminRow, error: adminError } = await admin
    .from("platform_admins").select("user_id").eq("user_id", authData.user.id).maybeSingle();
  if (adminError || !adminRow) return json({ error: "هذه الخدمة متاحة لإدارة المنصة فقط." }, 403);

  try {
    const bucket = entityType === "vehicle" ? "vehicle-images" : "payment-proofs";
    let paths: string[] = [];
    if (entityType === "vehicle") {
      const { data, error } = await admin.from("vehicle_images")
        .select("storage_path").eq("vehicle_id", entityId).order("created_at", { ascending: true }).limit(4);
      if (error) throw error;
      paths = (data ?? []).map((row: { storage_path: string }) => row.storage_path).filter(Boolean);
    } else {
      const { data, error } = await admin.from("vehicle_payment_submissions")
        .select("proof_path").eq("id", entityId).maybeSingle();
      if (error) throw error;
      if (data?.proof_path) paths = [data.proof_path];
    }
    if (!paths.length) return json({ code: "NO_FILES", error: "لا توجد ملفات مرفقة بهذا السجل؛ أرفق الملف أولًا ثم أعد الفحص." });

    const parts: Array<Record<string, unknown>> = [];
    const fileSummaries: Array<{ file_number: number; mime_type: string; size_bytes: number }> = [];
    let totalBytes = 0;
    for (let index = 0; index < paths.length; index++) {
      const { data: file, error } = await admin.storage.from(bucket).download(paths[index]);
      if (error || !file) continue;
      const mimeType = file.type || (paths[index].toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
      const allowed = entityType === "vehicle"
        ? ["image/jpeg", "image/png", "image/webp"].includes(mimeType)
        : ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(mimeType);
      if (!allowed || file.size > (entityType === "vehicle" ? 8 : 5) * 1024 * 1024) continue;
      totalBytes += file.size;
      if (totalBytes > 18 * 1024 * 1024) break;
      const bytes = new Uint8Array(await file.arrayBuffer());
      parts.push({ inline_data: { mime_type: mimeType, data: toBase64(bytes) } });
      fileSummaries.push({ file_number: index + 1, mime_type: mimeType, size_bytes: file.size });
    }
    if (!parts.length) return json({ code: "NO_VALID_FILES", error: "لم نعثر على ملفات صالحة للفحص؛ تحقق من نوع الملف وحجمه ثم أعد المحاولة." });

    const prompt = entityType === "vehicle"
      ? `أنت مساعد تدقيق بصري لمراجعة تسجيل مركبة في مصر. افحص الصور بصريًا فقط. لا تستنتج ملكية أو هوية أو أصالة أو قانونية، ولا تؤكد الماركة أو الموديل إلا إذا كان ظاهرًا بوضوح. ابحث عن: هل تظهر مركبة؟ عدد المركبات الظاهرة؟ جودة الصور ووضوحها؟ صور مكررة أو زوايا متشابهة جدًا؟ أضرار ظاهرة واضحة دون مبالغة؟ هل توجد صور شاشة أو صور دعائية/مخزنية ظاهرة؟ لا تصنف ذلك تزويرًا. أخرج JSON فقط بالشكل: {"summary":"...","vehicle_visible":true,"vehicle_count_estimate":1,"visible_details":["..."],"quality_issues":["..."],"possible_duplicates":false,"stock_or_screenshot_suspected":false,"risk_level":"low|medium|high","human_review_reasons":["..."],"limitations":["..."]}. اعتبر كل نتيجة احتمالية وتوصية للمراجع.`
      : `أنت مساعد قراءة أولية لإيصالات تحويل رسوم منصة في مصر. استخرج فقط البيانات الظاهرة ذات الصلة: اسم وسيلة الدفع أو البنك، رقم مرجع العملية إذا كان ظاهرًا، المبلغ، التاريخ والوقت، وحالة العملية كما تظهر بالنص. لا تستنتج أن التحويل حقيقي أو تم تسويته، ولا تؤكد وصول الأموال. لا تستخرج أرقام الحسابات أو البطاقات أو بيانات شخصية غير لازمة. إذا لم تكن القيمة واضحة اتركها null. أخرج JSON فقط بالشكل: {"summary":"...","payment_provider":"...","transaction_reference":"...","amount":"...","currency":"EGP|unknown","transaction_date":"...","displayed_status":"...","readability":"clear|partial|poor","tampering_indicators":["..."],"risk_level":"low|medium|high","human_review_reasons":["..."],"limitations":["..."]}. أي مؤشر بصري ليس إثباتًا للتلاعب.`;

    const model = Deno.env.get("GEMINI_REVIEW_MODEL") ?? "gemini-2.5-flash";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [...parts, { text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1200, responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error("Gemini vision request failed", response.status, detail.slice(0, 400));
      return json({ error: "تعذر إكمال الفحص الذكي حاليًا. حاول لاحقًا." }, 502);
    }
    const payload = await response.json();
    const raw = (payload.candidates?.[0]?.content?.parts ?? [])
      .map((part: { text?: string }) => part.text ?? "").join("\n");
    if (!raw) return json({ error: "لم يرجع نموذج الذكاء الاصطناعي نتيجة قابلة للعرض." }, 502);
    const analysis = parseModelJson(raw);
    return json({
      entity_type: entityType, entity_id: entityId, model,
      analyzed_at: new Date().toISOString(), files_analyzed: fileSummaries,
      analysis, decision: "advisory_only",
      warning: "هذه قراءة بصرية آلية وليست إثباتًا للملكية أو صحة التحويل أو وصول الأموال. القرار النهائي لموظف الإدارة.",
    });
  } catch (error) {
    console.error("Admin vision review failed", error);
    return json({ error: "حدث خطأ أثناء فحص الملفات. لم يتم تغيير حالة السجل." }, 500);
  }
});

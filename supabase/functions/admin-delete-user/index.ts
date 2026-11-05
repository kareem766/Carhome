import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const send = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return send({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return send({ error: "إعدادات خدمة الحذف غير مكتملة." }, 500);

    const authorization = req.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) return send({ error: "يجب تسجيل الدخول أولاً." }, 401);

    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: callerResult, error: callerError } = await db.auth.getUser(authorization.slice(7));
    const caller = callerResult?.user;
    if (callerError || !caller) return send({ error: "جلسة الدخول غير صالحة." }, 401);

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return send({ error: "بيانات الطلب غير صالحة." }, 400); }
    const userId = String(body.user_id || "").trim();
    if (!userId) return send({ error: "معرّف الحساب مطلوب." }, 400);
    if (userId === caller.id) return send({ error: "لا يمكن حذف حسابك الحالي من لوحة الإدارة." }, 403);

    const { data: callerAdmin, error: callerAdminError } = await db
      .from("platform_admins").select("user_id").eq("user_id", caller.id).maybeSingle();
    if (callerAdminError) return send({ error: "تعذر التحقق من صلاحية مدير المنصة: " + callerAdminError.message }, 500);
    if (!callerAdmin) return send({ error: "غير مصرح بحذف الحسابات." }, 403);

    const { data: targetAdmin, error: targetAdminError } = await db
      .from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
    if (targetAdminError) return send({ error: "تعذر التحقق من صلاحيات الحساب المطلوب." }, 500);
    if (targetAdmin) return send({ error: "حمايةً للمنصة، لا يمكن حذف حساب مدير منصة من إدارة الحسابات." }, 403);

    const { data: targetResult, error: targetError } = await db.auth.admin.getUserById(userId);
    const target = targetResult?.user;
    if (targetError || !target) return send({ error: "الحساب المطلوب غير موجود." }, 404);

    const [{ data: profile, error: profileError }, { data: memberships, error: membershipsError }, { data: createdOrganizations, error: createdOrganizationsError }] = await Promise.all([
      db.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
      db.from("organization_memberships").select("organization_id,role").eq("user_id", userId),
      db.from("organizations").select("id").eq("created_by", userId),
    ]);
    if (profileError || membershipsError || createdOrganizationsError) {
      return send({ error: "تعذر تحميل ارتباطات الحساب قبل الحذف. لم يتم حذف أي بيانات." }, 500);
    }

    const organizationIds = [...new Set([
      ...(memberships || []).map((m: any) => m.organization_id),
      ...(createdOrganizations || []).map((o: any) => o.id),
    ])];
    const { data: organizations, error: organizationsError } = organizationIds.length
      ? await db.from("organizations")
          .select("id,created_by,approval_status,contact_name,phone,contact_email,address")
          .in("id", organizationIds)
      : { data: [], error: null };
    if (organizationsError) return send({ error: "تعذر التحقق من المؤسسات المرتبطة بالحساب." }, 500);

    const snapshots: any[] = [];
    const changedVehicleStatuses: any[] = [];
    const changedMembershipRoles: any[] = [];
    const rollback = async () => {
      for (const row of changedVehicleStatuses) {
        await db.from("vehicles").update({ review_status: row.review_status }).eq("id", row.id);
      }
      for (const row of changedMembershipRoles) {
        await db.from("organization_memberships").update({ role: row.role })
          .eq("organization_id", row.organization_id).eq("user_id", row.user_id);
      }
      for (const org of snapshots) {
        await db.from("organizations").update({
          created_by: org.created_by,
          approval_status: org.approval_status,
          contact_name: org.contact_name,
          phone: org.phone,
          contact_email: org.contact_email,
          address: org.address,
        }).eq("id", org.id);
      }
      await db.from("deleted_account_archives").delete().eq("user_id", userId);
    };

    for (const org of organizations || []) {
      snapshots.push(org);
      const { data: otherMembers, error: otherMembersError } = await db
        .from("organization_memberships").select("user_id,role")
        .eq("organization_id", org.id).neq("user_id", userId);
      if (otherMembersError) {
        await rollback();
        return send({ error: "تعذر التحقق من أعضاء المؤسسة. لم يتم حذف الحساب." }, 500);
      }

      if ((otherMembers || []).length > 0) {
        const successor = otherMembers![0];
        const wasOwner = (memberships || []).some((m: any) => m.organization_id === org.id && m.role === "owner");
        if (wasOwner && successor.role !== "owner") {
          const { error: roleError } = await db.from("organization_memberships")
            .update({ role: "owner" }).eq("organization_id", org.id).eq("user_id", successor.user_id);
          if (roleError) {
            await rollback();
            return send({ error: "تعذر نقل ملكية المؤسسة إلى عضو آخر: " + roleError.message }, 500);
          }
          changedMembershipRoles.push({ organization_id: org.id, user_id: successor.user_id, role: successor.role });
        }
        if (org.created_by === userId) {
          const { error: creatorError } = await db.from("organizations")
            .update({ created_by: successor.user_id }).eq("id", org.id);
          if (creatorError) {
            await rollback();
            return send({ error: "تعذر نقل مسؤولية المؤسسة إلى عضو آخر: " + creatorError.message }, 500);
          }
        }
      } else {
        // Keep the organization and its business history, but suspend access and hide its listings.
        const { data: vehicles, error: vehiclesError } = await db.from("vehicles")
          .select("id,review_status").eq("organization_id", org.id);
        if (vehiclesError) {
          await rollback();
          return send({ error: "تعذر تجهيز إعلانات المؤسسة للأرشفة الآمنة." }, 500);
        }
        for (const vehicle of vehicles || []) {
          changedVehicleStatuses.push(vehicle);
        }
        const { error: pauseError } = await db.from("vehicles")
          .update({ review_status: "paused" }).eq("organization_id", org.id);
        if (pauseError) {
          await rollback();
          return send({ error: "تعذر إيقاف إعلانات المؤسسة قبل حذف الحساب: " + pauseError.message }, 500);
        }
        // Do not alter approval_status here: that transition is reserved for an authenticated platform-admin session.
        // The account has no remaining members; keep its historical approval state while clearing personal contact details.
        const { error: suspendError } = await db.from("organizations").update({
          contact_name: null,
          phone: null,
          contact_email: null,
          address: null,
        }).eq("id", org.id);
        if (suspendError) {
          await rollback();
          return send({ error: "تعذر أرشفة المؤسسة المرتبطة بالحساب: " + suspendError.message }, 500);
        }
      }
    }

    const { error: archiveError } = await db.from("deleted_account_archives").upsert({
      user_id: userId,
      email: target.email || null,
      display_name: profile?.display_name || target.user_metadata?.display_name || null,
      deleted_by: caller.id,
      deleted_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (archiveError) {
      await rollback();
      return send({ error: "تعذر حفظ مرجع السجلات التاريخية. لم يتم حذف الحساب." }, 500);
    }

    const { error: deleteError } = await db.auth.admin.deleteUser(userId);
    if (deleteError) {
      await rollback();
      return send({ error: "تعذر حذف حساب الدخول: " + deleteError.message }, 500);
    }

    return send({
      success: true,
      message: "تم حذف حساب الدخول والبيانات الشخصية وعضوياته. تم الاحتفاظ بالسجلات المالية والتعاقدية والطلبات والعروض والمراسلات، مع إيقاف المؤسسات وإعلاناتها عند عدم وجود أعضاء آخرين.",
      preserved_history: true,
    });
  } catch (error) {
    console.error("admin-delete-user failed:", error);
    return send({ error: "حدث خطأ غير متوقع أثناء حذف الحساب. لم يتم تأكيد اكتمال العملية." }, 500);
  }
});

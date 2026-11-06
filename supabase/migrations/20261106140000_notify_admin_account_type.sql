-- Make new-account review notifications identify the exact account category.
-- Keep all existing review notification behavior for vehicles, payments, promotions and subscriptions.
create or replace function public.notify_admin_review_needed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_title text;
  v_body text;
  v_url text := '/workspace/admin/vehicle-reviews';
  v_type text := 'request';
  v_is_pending boolean := false;
  v_actor uuid;
  v_account_label text;
begin
  if tg_table_name = 'organizations' then
    v_is_pending := new.approval_status = 'pending_review';
    v_account_label := case new.organization_type
      when 'individual_owner' then 'مالك سيارة'
      when 'company' then 'شركة طالبة'
      when 'fleet_supplier' then 'مورد أسطول'
      else 'حساب مؤسسة'
    end;
    v_title := 'حساب جديد يحتاج المراجعة: ' || v_account_label;
    v_body := 'تم تسجيل حساب جديد من نوع ' || v_account_label
      || ' باسم ' || coalesce(nullif(btrim(new.name), ''), 'اسم غير محدد')
      || case when nullif(btrim(coalesce(new.contact_name, '')), '') is not null
        then '، مسؤول التواصل: ' || btrim(new.contact_name) else '' end
      || case when nullif(btrim(coalesce(new.contact_email, '')), '') is not null
        then '، البريد الإلكتروني: ' || btrim(new.contact_email) else '' end
      || case when nullif(btrim(coalesce(new.phone, '')), '') is not null
        then '، رقم الهاتف: ' || btrim(new.phone) else '' end
      || '. الحساب بانتظار مراجعة واعتماد الإدارة.';
    v_url := '/workspace/admin/vehicle-reviews#admin-organizations';
    v_type := 'account';
    v_actor := new.created_by;
  elsif tg_table_name = 'vehicles' then
    v_is_pending := new.review_status = 'pending_review';
    v_title := 'سيارة جديدة تحتاج المراجعة';
    v_body := 'تم تسجيل سيارة جديدة وتحتاج إلى مراجعة البيانات والصور قبل اعتمادها.';
    v_url := '/workspace/admin/vehicle-reviews#admin-vehicles';
    v_type := 'vehicle';
    v_actor := new.created_by;
  elsif tg_table_name = 'vehicle_payment_submissions' then
    v_is_pending := new.review_status = 'pending';
    v_title := 'تحويل رسوم تسجيل سيارة يحتاج المراجعة';
    v_body := 'تم إرسال بيانات تحويل جديدة لمراجعتها واعتمادها.';
    v_url := '/workspace/admin/vehicle-reviews#admin-vehicles';
    v_type := 'payment';
    v_actor := new.submitted_by;
  elsif tg_table_name = 'vehicle_promotions' then
    v_is_pending := new.status = 'pending_review' or new.payment_status = 'pending';
    v_title := 'طلب إعلان أو ترويج يحتاج المراجعة';
    v_body := 'تم إرسال طلب ترويج سيارة أو بيانات دفع جديدة وتحتاج إلى مراجعة.';
    v_url := '/workspace/admin/vehicle-reviews#admin-vehicles';
    v_type := 'promotion';
    v_actor := new.created_by;
  elsif tg_table_name = 'company_subscriptions' then
    v_is_pending := new.status = 'pending' or new.payment_status = 'pending';
    v_title := 'اشتراك شركة يحتاج المراجعة';
    v_body := 'تم إرسال اشتراك أو بيانات دفع جديدة من شركة وتحتاج إلى مراجعة.';
    v_type := 'subscription';
    v_actor := new.created_by;
  end if;

  if v_is_pending then
    insert into public.platform_notifications(user_id, title, body, notification_type, action_url, created_by)
    select a.user_id, v_title, v_body, v_type, v_url, v_actor
    from public.platform_admins a;
  end if;

  return new;
end;
$function$;

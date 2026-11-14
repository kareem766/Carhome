-- Keep company approval notifications within the notification types accepted by the platform.
-- Quote approval itself moves the request to awaiting_payment in the application.
create or replace function private.notify_managed_sourcing_action()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  action_label text;
begin
  action_label := case new.action_type
    when 'approve_quote' then 'وافقت الشركة على رسوم الخدمة ونطاق العمل. يرجى متابعة طلب الدفع.'
    when 'submit_payment_reference' then 'أرسلت الشركة مرجع دفع يحتاج إلى المراجعة.'
    when 'select_offer' then 'اختارت الشركة أحد الخيارات وتحتاج إلى متابعة المورد.'
    when 'request_alternatives' then 'طلبت الشركة بدائل للخيارات المعروضة.'
    when 'change_requirements' then 'طلبت الشركة تعديل احتياجاتها.'
    when 'cancel_request' then 'طلبت الشركة إلغاء الطلب.'
    else 'أرسلت الشركة استفسارًا على طلب التوفير.'
  end;

  insert into public.platform_notifications(
    user_id,title,body,notification_type,action_url,created_by
  )
  select a.user_id,
    'إجراء جديد على طلب توفير سيارات',
    action_label,
    'request',
    '/workspace/admin/managed-sourcing?request=' || new.request_id::text,
    new.created_by
  from public.platform_admins a;

  return new;
end;
$function$;

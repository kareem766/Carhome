
-- Notify platform administrators when a company approves a quote, submits payment details, selects an offer, or requests a change.
create or replace function private.notify_managed_sourcing_action()
returns trigger language plpgsql security definer set search_path = '' as $$
declare action_label text;
begin
 action_label := case new.action_type
   when 'approve_quote' then 'وافقت الشركة على رسوم الخدمة ونطاق العمل.'
   when 'submit_payment_reference' then 'أرسلت الشركة مرجع دفع يحتاج إلى المراجعة.'
   when 'select_offer' then 'اختارت الشركة أحد الخيارات وتحتاج إلى متابعة المورد.'
   when 'request_alternatives' then 'طلبت الشركة بدائل للخيارات المعروضة.'
   when 'change_requirements' then 'طلبت الشركة تعديل احتياجاتها.'
   when 'cancel_request' then 'طلبت الشركة إلغاء الطلب.'
   else 'أرسلت الشركة استفسارًا على طلب التوفير.' end;
 insert into public.platform_notifications(user_id,title,body,notification_type,action_url,created_by)
 select a.user_id,'إجراء جديد على طلب توفير سيارات',action_label,'managed_sourcing_action','/workspace/admin/managed-sourcing',new.created_by
 from public.platform_admins a;
 return new;
end;
$$;
revoke all on function private.notify_managed_sourcing_action() from public;
drop trigger if exists managed_sourcing_action_notify on public.managed_sourcing_actions;
create trigger managed_sourcing_action_notify after insert on public.managed_sourcing_actions for each row execute function private.notify_managed_sourcing_action();

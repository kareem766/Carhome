-- Deep-link company managed-sourcing notifications to the exact request.
create or replace function private.notify_managed_sourcing_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if TG_OP='INSERT' then
    insert into public.platform_notifications(user_id,title,body,notification_type,action_url,created_by)
    select a.user_id,'طلب توفير سيارات جديد','وصل طلب جديد من شركة ويحتاج إلى المراجعة.','managed_sourcing_request','/workspace/admin/managed-sourcing',new.created_by
    from public.platform_admins a;
  elsif
    new.payment_submitted_at is distinct from old.payment_submitted_at
    or new.payment_reference is distinct from old.payment_reference
    or new.status is distinct from old.status
    or new.payment_status is distinct from old.payment_status
    or new.quoted_fee_egp is distinct from old.quoted_fee_egp
  then
    if (new.payment_submitted_at is distinct from old.payment_submitted_at
        or new.payment_reference is distinct from old.payment_reference)
       and new.payment_submitted_at is not null then
      insert into public.platform_notifications(user_id,title,body,notification_type,action_url,created_by)
      select a.user_id,'تحويل خدمة تفويض السيارات يحتاج المراجعة',
        'أرسلت الشركة بيانات التحويل (رقم العملية وتاريخ التحويل). يرجى مراجعتها قبل اعتماد الطلب.',
        'managed_sourcing_request','/workspace/admin/managed-sourcing',new.created_by
      from public.platform_admins a;
    end if;

    if new.quoted_fee_egp is distinct from old.quoted_fee_egp
       and new.quoted_fee_egp is not null then
      insert into public.platform_notifications(user_id,title,body,notification_type,action_url,created_by)
      select distinct m.user_id,
        'تمت مراجعة طلب البحث وتحديد رسوم الخدمة',
        'راجعت الإدارة طلبك وحددت رسوم الخدمة بمبلغ '
          || to_char(new.quoted_fee_egp,'FM999,999,990.00')
          || ' ج.م. افتح طلب البحث لمراجعة التفاصيل والموافقة على عرض السعر ثم استكمال الدفع.',
        'managed_sourcing_update','/workspace/company/managed-sourcing?request='||new.id::text,coalesce(new.assigned_to,new.created_by)
      from public.organization_memberships m
      where m.organization_id=new.company_organization_id
        and m.user_id is not null;
    elsif new.status is distinct from old.status
       or new.payment_status is distinct from old.payment_status then
      insert into public.platform_notifications(user_id,title,body,notification_type,action_url,created_by)
      select distinct m.user_id,
        case
          when new.payment_status='verified' then 'تم تأكيد رسوم خدمة البحث'
          when new.payment_status='rejected' then 'تحتاج رسوم خدمة البحث إلى مراجعة'
          when new.status='awaiting_company_approval' then 'طلب البحث بانتظار موافقتك'
          when new.status='searching' then 'بدأ فريق My Car البحث عن السيارات'
          else 'تحديث جديد على طلب البحث'
        end,
        case
          when new.payment_status='verified' then 'تم تأكيد السداد وبدأ فريق My Car العمل على طلبك.'
          when new.payment_status='rejected' then 'تعذر اعتماد التحويل. يرجى مراجعة بيانات الدفع من حساب الشركة.'
          when new.status='awaiting_company_approval' then 'راجعت الإدارة طلبك. رسوم الخدمة المحددة '
             || coalesce(to_char(new.quoted_fee_egp,'FM999,999,990.00'),'—')
             || ' ج.م. راجع التفاصيل ووافق على عرض السعر للانتقال إلى خطوة الدفع.'
          when new.status='searching' then 'تم اعتماد طلب البحث وبدأ فريق My Car تنفيذ البحث.'
          else 'حالة طلب البحث الآن: '||new.status||'. افتح حساب الشركة لمراجعة آخر التفاصيل.'
        end,
        'managed_sourcing_update','/workspace/company/managed-sourcing?request='||new.id::text,coalesce(new.assigned_to,new.created_by)
      from public.organization_memberships m
      where m.organization_id=new.company_organization_id
        and m.user_id is not null;
    end if;
  end if;
  return new;
end;
$function$;

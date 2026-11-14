-- Notify every member of a company when the administration responds with a service fee or changes the request/payment decision.
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
        'managed_sourcing_update','/workspace/company/managed-sourcing',coalesce(new.assigned_to,new.created_by)
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
        'managed_sourcing_update','/workspace/company/managed-sourcing',coalesce(new.assigned_to,new.created_by)
      from public.organization_memberships m
      where m.organization_id=new.company_organization_id
        and m.user_id is not null;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists managed_sourcing_request_notify on public.managed_sourcing_requests;
create trigger managed_sourcing_request_notify
after insert or update of status,payment_status,payment_reference,payment_submitted_at,quoted_fee_egp
on public.managed_sourcing_requests
for each row execute function private.notify_managed_sourcing_request();

-- The trigger above now notifies all company members, so avoid a second duplicate notification here.
create or replace function public.managed_sourcing_admin_start_search(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_request public.managed_sourcing_requests%rowtype;
begin
  if v_user is null or not exists (
    select 1 from public.platform_admins a where a.user_id=v_user
  ) then
    raise exception 'غير مصرح بهذا الإجراء الإداري';
  end if;

  select * into v_request
  from public.managed_sourcing_requests r
  where r.id=p_request_id
  for update;

  if not found then
    raise exception 'تفويض البحث غير موجود';
  end if;

  if v_request.payment_model <> 'subscription' then
    raise exception 'الطلبات المستقلة يجب اعتماد تحويلها من إجراء مراجعة الدفع';
  end if;

  if v_request.status not in ('new','under_review') then
    raise exception 'حالة الطلب الحالية لا تسمح ببدء البحث';
  end if;

  if not exists (
    select 1 from public.managed_sourcing_subscriptions s
    where s.id=v_request.subscription_id
      and s.organization_id=v_request.company_organization_id
      and s.package_id=v_request.package_id
      and s.payment_status='verified'
      and s.starts_at<=v_request.created_at
      and s.ends_at>v_request.created_at
  ) then
    raise exception 'اشتراك الشركة غير نشط أو لا يحتوي على طلبات متاحة';
  end if;

  update public.managed_sourcing_requests
  set status='searching',
      payment_status='not_required',
      company_approved_at=coalesce(company_approved_at,now()),
      assigned_to=v_user,
      updated_at=now()
  where id=p_request_id;

  insert into public.managed_sourcing_updates(
    request_id,created_by,visibility,title,body,status_from,status_to
  ) values (
    p_request_id,v_user,'company','بدأ البحث ضمن اشتراك الشركة',
    'اعتمد فريق My Car الطلب وبدأ البحث ضمن الاشتراك النشط للشركة.',
    v_request.status,'searching'
  );

  insert into public.managed_sourcing_internal_notes(request_id,created_by,note)
  values(p_request_id,v_user,'ADMIN AUDIT: subscription-backed managed sourcing request moved to searching.');

  return jsonb_build_object('request_id',p_request_id,'status','searching','started_at',now());
end;
$function$;

revoke execute on function public.managed_sourcing_admin_start_search(uuid) from public,anon;
grant execute on function public.managed_sourcing_admin_start_search(uuid) to authenticated;

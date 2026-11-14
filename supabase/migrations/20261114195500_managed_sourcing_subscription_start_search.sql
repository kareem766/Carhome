-- Permit subscription-backed managed sourcing requests to start searching safely.
create or replace function public.guard_managed_sourcing_request_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.status='awaiting_payment' and new.company_approved_at is null then
    raise exception 'لا يمكن نقل الطلب إلى انتظار السداد قبل موافقة الشركة';
  end if;

  if new.status='searching' and old.status is distinct from new.status then
    if old.status='awaiting_payment'
       and old.company_approved_at is not null
       and new.payment_status='verified'
       and new.payment_reference is not null
       and new.payment_submitted_at is not null then
      null;
    elsif old.payment_model='subscription'
       and old.subscription_id is not null
       and new.payment_model='subscription'
       and new.payment_status='not_required'
       and new.company_approved_at is not null
       and exists (
         select 1 from public.platform_admins a
         where a.user_id = (select auth.uid())
       )
       and exists (
         select 1 from public.managed_sourcing_subscriptions s
         where s.id=old.subscription_id
           and s.organization_id=old.company_organization_id
           and s.package_id=old.package_id
           and s.status='active'
           and s.payment_status='verified'
           and s.starts_at<=now()
           and s.ends_at>now()
           and s.requests_used<=s.requests_included
       ) then
      null;
    else
      raise exception 'لا يبدأ البحث إلا بعد اعتماد السداد أو التحقق من الاشتراك النشط';
    end if;
  end if;
  return new;
end;
$function$;

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
      and s.status='active'
      and s.payment_status='verified'
      and s.starts_at<=now()
      and s.ends_at>now()
      and s.requests_used<=s.requests_included
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

  insert into public.platform_notifications(user_id,title,body,notification_type,action_url,created_by)
  select m.user_id,'بدأ فريق My Car البحث عن السيارات',
    'تم اعتماد طلب البحث الخاص بشركتك وبدأ فريق My Car تنفيذ البحث.',
    'managed_sourcing_update','/workspace/company/managed-sourcing',v_user
  from public.organization_memberships m
  where m.organization_id=v_request.company_organization_id
    and m.user_id <> v_request.created_by
  on conflict do nothing;

  return jsonb_build_object('request_id',p_request_id,'status','searching','started_at',now());
end;
$function$;

revoke execute on function public.managed_sourcing_admin_start_search(uuid) from public,anon;
grant execute on function public.managed_sourcing_admin_start_search(uuid) to authenticated;


-- Avoid duplicate company notifications: the existing request trigger already notifies the request creator.
create or replace function public.publish_managed_sourcing_results(
  p_request_id uuid,
  p_offer_ids uuid[],
  p_company_message text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request public.managed_sourcing_requests%rowtype;
  v_selected integer;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.platform_admins pa
    where pa.user_id = (select auth.uid())
  ) then
    raise exception 'غير مصرح لك بإرسال نتائج البحث';
  end if;

  if coalesce(cardinality(p_offer_ids),0) = 0 then
    raise exception 'اختر عرضًا واحدًا على الأقل لإرساله للشركة';
  end if;

  select * into v_request
  from public.managed_sourcing_requests r
  where r.id = p_request_id
  for update;

  if not found then
    raise exception 'تفويض البحث غير موجود';
  end if;

  select count(*) into v_selected
  from public.managed_sourcing_offers o
  where o.request_id = p_request_id
    and o.id = any(p_offer_ids);

  if v_selected <> cardinality(p_offer_ids) then
    raise exception 'توجد عروض مختارة لا تتبع هذا التفويض';
  end if;

  update public.managed_sourcing_offers o
  set company_decision = case when o.id = any(p_offer_ids) then 'selected' else 'rejected' end,
      recommendation_rank = case
        when o.id = any(p_offer_ids) then array_position(p_offer_ids,o.id)
        else o.recommendation_rank
      end,
      updated_at = now()
  where o.request_id = p_request_id;

  update public.managed_sourcing_requests
  set status = 'results_ready',
      results_published_at = now(),
      results_published_by = (select auth.uid()),
      updated_at = now()
  where id = p_request_id;

  insert into public.managed_sourcing_updates(
    request_id,created_by,visibility,title,body,status_from,status_to
  ) values (
    p_request_id,(select auth.uid()),'company','نتيجة البحث جاهزة لشركتك',
    coalesce(nullif(left(btrim(p_company_message),2000),''),'أنهى فريق My Car مراجعة العروض وتجهيز الخيارات المرشحة. يمكنك مراجعة المقارنة واتخاذ قرارك من حساب الشركة.'),
    v_request.status,'results_ready'
  );

  insert into public.platform_notifications(user_id,title,body,notification_type,action_url,created_by)
  select m.user_id,'نتيجة البحث أصبحت جاهزة',
    'تم تجهيز العروض المرشحة لتفويض البحث الخاص بشركتك. افتح حسابك لمراجعة التقرير.',
    'managed_sourcing_update',
    '/workspace/company/managed-sourcing',
    (select auth.uid())
  from public.organization_memberships m
  where m.organization_id = v_request.company_organization_id
    and m.user_id <> v_request.created_by
  on conflict do nothing;

  return jsonb_build_object('published_offers',v_selected,'published_at',now());
end;
$function$;


-- Accept the existing company payment submission state while still requiring a real transfer reference and timestamp.
create or replace function public.managed_sourcing_admin_verify_payment(
  p_request_id uuid,
  p_verified boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_request public.managed_sourcing_requests%rowtype;
  v_next text;
  v_pay text;
begin
  if v_user is null or not exists(
    select 1 from public.platform_admins where user_id=v_user
  ) then
    raise exception 'غير مصرح بهذا الإجراء الإداري';
  end if;

  select * into v_request
  from public.managed_sourcing_requests
  where id=p_request_id
  for update;

  if not found then
    raise exception 'الطلب غير موجود';
  end if;

  if v_request.status<>'awaiting_payment'
     or v_request.company_approved_at is null
     or v_request.payment_status not in ('awaiting_payment','payment_submitted','rejected')
     or nullif(btrim(v_request.payment_reference),'') is null
     or v_request.payment_submitted_at is null
     or v_request.payment_transfer_date is null then
    raise exception 'لا يمكن اعتماد التحويل قبل موافقة الشركة وإرسال مرجع التحويل وتاريخه';
  end if;

  if p_verified then
    v_next:='searching'; v_pay:='verified';
  else
    v_next:='awaiting_payment'; v_pay:='rejected';
  end if;

  update public.managed_sourcing_requests
  set status=v_next,
      payment_status=v_pay,
      payment_verified_at=case when p_verified then now() else null end,
      updated_at=now()
  where id=p_request_id;

  insert into public.managed_sourcing_updates(
    request_id,created_by,visibility,title,body,status_from,status_to
  ) values (
    p_request_id,v_user,'company',
    case when p_verified then 'تم تأكيد رسوم الخدمة' else 'تعذر تأكيد رسوم الخدمة' end,
    case when p_verified then 'تم تأكيد السداد وبدأ فريق My Car العمل وفق حالة الطلب.' else 'لم يتم اعتماد التحويل. يرجى مراجعة بيانات العملية وإعادة إرسالها.' end,
    v_request.status,v_next
  );

  insert into public.managed_sourcing_internal_notes(request_id,created_by,note)
  values(
    p_request_id,v_user,
    case when p_verified then 'ADMIN AUDIT: payment verified; request moved to searching.' else 'ADMIN AUDIT: payment rejected; request remains awaiting payment.' end
  );
end;
$function$;

revoke execute on function public.managed_sourcing_admin_verify_payment(uuid,boolean) from public,anon;
grant execute on function public.managed_sourcing_admin_verify_payment(uuid,boolean) to authenticated;

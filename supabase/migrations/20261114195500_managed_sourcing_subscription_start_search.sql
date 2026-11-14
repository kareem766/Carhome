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
  on conflict do nothing;

  return jsonb_build_object('request_id',p_request_id,'status','searching','started_at',now());
end;
$function$;

revoke execute on function public.managed_sourcing_admin_start_search(uuid) from public,anon;
grant execute on function public.managed_sourcing_admin_start_search(uuid) to authenticated;

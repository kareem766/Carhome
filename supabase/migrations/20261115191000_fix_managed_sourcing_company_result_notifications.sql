create or replace function public.publish_managed_sourcing_results(
  p_request_id uuid,
  p_offer_ids uuid[],
  p_company_message text default ''
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_request public.managed_sourcing_requests%rowtype;
  v_selected integer;
  v_notified integer := 0;
  v_action_url text;
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

  v_action_url := '/workspace/company/managed-sourcing?request=' || p_request_id::text;

  with recipients as (
    select m.user_id
    from public.organization_memberships m
    where m.organization_id = v_request.company_organization_id
    union
    select v_request.created_by
    where v_request.created_by is not null
  ),
  inserted as (
    insert into public.platform_notifications(user_id,title,body,notification_type,action_url,created_by)
    select r.user_id,
      'نتائج البحث أصبحت جاهزة',
      'تم تجهيز نتائج البحث لطلب «' || v_request.title || '». افتح الطلب لمراجعة السيارات المرشحة والتواصل مع مقدميها.',
      'managed_sourcing_results',
      v_action_url,
      (select auth.uid())
    from recipients r
    where not exists (
      select 1
      from public.platform_notifications n
      where n.user_id = r.user_id
        and n.notification_type = 'managed_sourcing_results'
        and n.action_url = v_action_url
    )
    returning id
  )
  select count(*) into v_notified from inserted;

  return jsonb_build_object(
    'published_offers',v_selected,
    'published_at',now(),
    'notified_members',v_notified
  );
end;
$function$;

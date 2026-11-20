-- Keep the explicit fleet-supplier offer notification as the single owner alert.
-- The offer is inserted before its first message so the message trigger can recognize it.
begin;

create or replace function public.notify_company_when_vehicle_provider_replies()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_company_id uuid;
  v_provider_id uuid;
  v_vehicle_id uuid;
  v_vehicle_label text;
  v_recipient_org_id uuid;
  v_title text;
  v_body text;
  v_sender_org_type public.organization_type;
begin
  select c.company_organization_id, c.provider_organization_id, c.vehicle_id,
         concat_ws(' ', v.make, v.model, v.model_year::text)
    into v_company_id, v_provider_id, v_vehicle_id, v_vehicle_label
  from public.conversations c
  left join public.vehicles v on v.id=c.vehicle_id
  where c.id=new.conversation_id;

  if v_vehicle_id is null then
    return new;
  end if;

  select o.organization_type into v_sender_org_type
  from public.organizations o
  where o.id = new.sender_organization_id;

  -- The RPC has already created the formal offer immediately before this
  -- first message. Its dedicated notification is more descriptive; avoid
  -- sending a second generic message notification for the same action.
  if v_sender_org_type = 'fleet_supplier'::public.organization_type
     and exists (
       select 1
       from public.vehicle_offers vo
       where vo.conversation_id = new.conversation_id
         and vo.created_by = new.sender_id
         and vo.message = new.body
         and vo.created_at between new.created_at - interval '1 minute' and new.created_at
     ) then
    return new;
  end if;

  if new.sender_organization_id = v_provider_id then
    v_recipient_org_id := v_company_id;
    v_title := 'رد مالك السيارة على عرضك';
    v_body := 'قام مالك السيارة بالرد على عرضك ورسالتك بخصوص ' ||
      coalesce(nullif(v_vehicle_label,''),'السيارة') ||
      '. افتح المحادثة لمتابعة الرد.';
  elsif new.sender_organization_id = v_company_id then
    v_recipient_org_id := v_provider_id;
    if v_sender_org_type = 'fleet_supplier'::public.organization_type then
      v_title := 'رسالة جديدة من مورد أسطول بخصوص سيارتك';
      v_body := 'أرسل مورد الأسطول رسالة بخصوص ' ||
        coalesce(nullif(v_vehicle_label,''),'سيارتك') ||
        '. افتح المحادثة للاطلاع والرد.';
    else
      v_title := 'رسالة جديدة من الشركة بخصوص سيارتك';
      v_body := 'أرسلت الشركة رسالة بخصوص ' ||
        coalesce(nullif(v_vehicle_label,''),'سيارتك') ||
        '. افتح المحادثة للاطلاع والرد.';
    end if;
  else
    return new;
  end if;

  insert into public.platform_notifications(user_id,title,body,notification_type,action_url,created_by)
  select distinct m.user_id,
         v_title,
         v_body,
         'message',
         '/messages?conversation=' || new.conversation_id::text,
         new.sender_id
  from public.organization_memberships m
  where m.organization_id=v_recipient_org_id
    and m.user_id is distinct from new.sender_id;

  return new;
end;
$function$;

create or replace function public.start_fleet_supplier_vehicle_conversation(
  p_vehicle_id uuid,
  p_message text,
  p_send_offer boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_supplier_id uuid;
  v_owner_id uuid;
  v_conversation_id uuid;
  v_offer_id uuid;
  v_message text := btrim(coalesce(p_message, ''));
  v_vehicle_label text;
begin
  if v_user_id is null then
    raise exception 'يجب تسجيل الدخول لإرسال طلب السيارة.' using errcode = '28000';
  end if;

  if char_length(v_message) < 1 or char_length(v_message) > 2000 then
    raise exception 'اكتب رسالة العرض في حدود 2000 حرف.' using errcode = '22023';
  end if;

  select m.organization_id
    into v_supplier_id
  from public.organization_memberships m
  join public.organizations supplier on supplier.id = m.organization_id
  where m.user_id = v_user_id
    and supplier.organization_type = 'fleet_supplier'::public.organization_type
    and supplier.approval_status = 'approved'
  order by (m.role = 'owner') desc
  limit 1;

  if v_supplier_id is null then
    raise exception 'حساب مورد الأسطول غير معتمد أو غير مرتبط بمؤسسة.' using errcode = '42501';
  end if;

  select v.organization_id, concat_ws(' ', v.make, v.model, v.model_year::text)
    into v_owner_id, v_vehicle_label
  from public.vehicles v
  join public.organizations owner_org on owner_org.id = v.organization_id
  where v.id = p_vehicle_id
    and v.organization_id <> v_supplier_id
    and v.review_status = 'approved'
    and v.payment_status in ('verified', 'waived')
    and (v.license_expiry_date is null or v.license_expiry_date >= current_date)
    and owner_org.organization_type = 'individual_owner'::public.organization_type
    and owner_org.approval_status = 'approved'
    and (v.registration_expires_at is null or v.registration_expires_at > now());

  if v_owner_id is null then
    raise exception 'السيارة لم تعد متاحة أو لا تستوفي شروط الاعتماد والسداد.' using errcode = 'P0002';
  end if;

  select c.id
    into v_conversation_id
  from public.conversations c
  where c.request_id is null
    and c.vehicle_id = p_vehicle_id
    and c.company_organization_id = v_supplier_id
    and c.provider_organization_id = v_owner_id
    and c.status = 'open'
  order by c.created_at desc
  limit 1;

  if v_conversation_id is null then
    insert into public.conversations (
      request_id, vehicle_id, company_organization_id,
      provider_organization_id, created_by, status
    )
    values (
      null, p_vehicle_id, v_supplier_id,
      v_owner_id, v_user_id, 'open'
    )
    on conflict (vehicle_id, company_organization_id, provider_organization_id)
      where vehicle_id is not null and status = 'open'
    do update set updated_at = now()
    returning id into v_conversation_id;
  end if;

  -- Create the offer first so the message trigger knows this is the initial
  -- offer message and does not emit a duplicate notification.
  if coalesce(p_send_offer, true) then
    insert into public.vehicle_offers (
      vehicle_id, company_organization_id, provider_organization_id,
      conversation_id, created_by, message
    )
    values (
      p_vehicle_id, v_supplier_id, v_owner_id,
      v_conversation_id, v_user_id, v_message
    )
    returning id into v_offer_id;
  end if;

  insert into public.messages (
    conversation_id, sender_organization_id, sender_id, body
  )
  values (v_conversation_id, v_supplier_id, v_user_id, v_message);

  if coalesce(p_send_offer, true) then
    insert into public.platform_notifications (
      user_id, title, body, notification_type, action_url, created_by
    )
    select distinct m.user_id,
      'وصلك عرض جديد على سيارتك من مورد أسطول',
      'أرسل مورد أسطول عرضًا على سيارتك ' || coalesce(nullif(v_vehicle_label, ''), 'المعروضة على My Car') || '. اضغط للاطلاع على التفاصيل والرد.',
      'message',
      '/messages?conversation=' || v_conversation_id::text,
      v_user_id
    from public.organization_memberships m
    where m.organization_id = v_owner_id;
  end if;

  return jsonb_build_object(
    'offer_id', v_offer_id,
    'conversation_id', v_conversation_id
  );
end;
$function$;

revoke all on function public.start_fleet_supplier_vehicle_conversation(uuid, text, boolean) from public, anon;
grant execute on function public.start_fleet_supplier_vehicle_conversation(uuid, text, boolean) to authenticated;

notify pgrst, 'reload schema';
commit;

-- Allow approved fleet suppliers to contact individual vehicle owners from the catalog.
-- The operation is atomic: conversation, first message, optional formal offer and owner notification.
begin;

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

  insert into public.messages (
    conversation_id, sender_organization_id, sender_id, body
  )
  values (v_conversation_id, v_supplier_id, v_user_id, v_message);

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

    insert into public.platform_notifications (
      user_id, title, body, notification_type, action_url, created_by
    )
    select distinct m.user_id,
      'وصلك طلب سيارة جديد من مورد أسطول',
      'أرسل مورد أسطول عرضًا على سيارتك ' || coalesce(nullif(v_vehicle_label, ''), 'المعروضة على My Car') || '. افتح المحادثة لمراجعة التفاصيل والرد.',
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

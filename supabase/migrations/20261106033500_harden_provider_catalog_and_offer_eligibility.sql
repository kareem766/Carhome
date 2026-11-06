-- Align catalog and offer visibility with the platform's approved, paid vehicle rules.
-- Fleet suppliers may browse the catalog, but unpaid or expired-license vehicles
-- must not be exposed or used to submit offers.

begin;

create or replace function private.can_view_catalog_vehicle(
  target_vehicle_id uuid,
  target_organization_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.vehicles v
    join public.organizations provider on provider.id = v.organization_id
    where v.id = target_vehicle_id
      and (target_organization_id is null or v.organization_id = target_organization_id)
      and v.review_status = 'approved'
      and v.payment_status in ('verified', 'waived')
      and (v.license_expiry_date is null or v.license_expiry_date >= current_date)
      and provider.approval_status = 'approved'
      and provider.organization_type in (
        'individual_owner'::public.organization_type,
        'fleet_supplier'::public.organization_type
      )
      and (
        provider.organization_type <> 'individual_owner'::public.organization_type
        or v.registration_expires_at is null
        or v.registration_expires_at > now()
      )
      and exists (
        select 1
        from public.organization_memberships viewer
        join public.organizations viewer_org on viewer_org.id = viewer.organization_id
        where viewer.user_id = (select auth.uid())
          and viewer_org.organization_type in (
            'company'::public.organization_type,
            'fleet_supplier'::public.organization_type
          )
          and viewer_org.approval_status = 'approved'
      )
  );
$function$;

grant execute on function private.can_view_catalog_vehicle(uuid, uuid) to authenticated;

-- A company direct offer must target a vehicle that is actually eligible for the catalog.
create or replace function public.submit_company_vehicle_offer(p_vehicle_id uuid, p_message text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_provider_id uuid;
  v_conversation_id uuid;
  v_offer_id uuid;
  v_message text := btrim(coalesce(p_message,''));
  v_vehicle_label text;
begin
  if v_user_id is null then
    raise exception 'يجب تسجيل الدخول لإرسال العرض.' using errcode='28000';
  end if;
  if char_length(v_message) < 1 or char_length(v_message) > 2000 then
    raise exception 'اكتب تفاصيل العرض في حدود 2000 حرف.' using errcode='22023';
  end if;

  select m.organization_id into v_company_id
  from public.organization_memberships m
  join public.organizations o on o.id=m.organization_id
  where m.user_id=v_user_id
    and o.organization_type='company'::public.organization_type
    and o.approval_status='approved'
  order by (m.role='owner') desc
  limit 1;

  if v_company_id is null then
    raise exception 'حساب الشركة غير معتمد أو غير مرتبط بمؤسسة.' using errcode='42501';
  end if;

  select v.organization_id, concat_ws(' ',v.make,v.model,v.model_year::text)
  into v_provider_id,v_vehicle_label
  from public.vehicles v
  join public.organizations provider on provider.id=v.organization_id
  where v.id=p_vehicle_id
    and v.review_status='approved'
    and v.payment_status in ('verified','waived')
    and (v.license_expiry_date is null or v.license_expiry_date >= current_date)
    and provider.approval_status='approved'
    and provider.organization_type in (
      'individual_owner'::public.organization_type,
      'fleet_supplier'::public.organization_type
    )
    and v.organization_id<>v_company_id
    and (
      provider.organization_type <> 'individual_owner'::public.organization_type
      or v.registration_expires_at is null
      or v.registration_expires_at>now()
    );

  if v_provider_id is null then
    raise exception 'السيارة لم تعد متاحة لإرسال العروض أو لا تستوفي شروط الاعتماد والسداد.' using errcode='P0002';
  end if;

  select c.id into v_conversation_id
  from public.conversations c
  where c.request_id is null
    and c.vehicle_id=p_vehicle_id
    and c.company_organization_id=v_company_id
    and c.provider_organization_id=v_provider_id
    and c.status='open'
  order by c.created_at desc
  limit 1;

  if v_conversation_id is null then
    insert into public.conversations(
      request_id,vehicle_id,company_organization_id,provider_organization_id,created_by,status
    )
    values(null,p_vehicle_id,v_company_id,v_provider_id,v_user_id,'open')
    on conflict (vehicle_id,company_organization_id,provider_organization_id)
      where request_id is null and vehicle_id is not null and status='open'
    do update set updated_at=now()
    returning id into v_conversation_id;
  end if;

  insert into public.messages(conversation_id,sender_organization_id,sender_id,body)
  values(v_conversation_id,v_company_id,v_user_id,v_message);

  insert into public.vehicle_offers(
    vehicle_id,company_organization_id,provider_organization_id,conversation_id,created_by,message
  )
  values(p_vehicle_id,v_company_id,v_provider_id,v_conversation_id,v_user_id,v_message)
  returning id into v_offer_id;

  insert into public.platform_notifications(user_id,title,body,notification_type,action_url,created_by)
  select distinct m.user_id,
    'وصلك عرض جديد على سيارتك',
    'أرسلت شركة عرضًا جديدًا على سيارتك '||coalesce(nullif(v_vehicle_label,''),'المعروضة على My Car')||'. افتح المحادثة لمراجعة العرض والرد.',
    'message',
    '/messages?conversation='||v_conversation_id::text,
    v_user_id
  from public.organization_memberships m
  where m.organization_id=v_provider_id;

  return jsonb_build_object('offer_id',v_offer_id,'conversation_id',v_conversation_id);
end;
$function$;

grant execute on function public.submit_company_vehicle_offer(uuid, text) to authenticated;

-- Providers only see open company requests for which they have a matching, eligible vehicle.
drop policy if exists "providers can view open rental requests" on public.rental_requests;
create policy "eligible providers can view matching open rental requests"
on public.rental_requests
for select
to authenticated
using (
  status = 'open'
  and exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    join public.vehicles v on v.organization_id = m.organization_id
    where m.user_id = (select auth.uid())
      and o.organization_type in (
        'individual_owner'::public.organization_type,
        'fleet_supplier'::public.organization_type
      )
      and o.approval_status = 'approved'
      and v.review_status = 'approved'
      and v.payment_status in ('verified', 'waived')
      and (v.license_expiry_date is null or v.license_expiry_date >= current_date)
      and (
        o.organization_type <> 'individual_owner'::public.organization_type
        or v.registration_expires_at is null
        or v.registration_expires_at > now()
      )
      and v.governorate = rental_requests.governorate
      and (
        rental_requests.vehicle_type = 'أخرى'
        or lower(btrim(v.vehicle_type)) = lower(btrim(rental_requests.vehicle_type))
        or (rental_requests.vehicle_type = 'فان / ميكروباص' and v.vehicle_type in ('فان','ميكروباص'))
        or (rental_requests.vehicle_type = 'نقل' and v.vehicle_type like 'نقل%')
      )
      and (not rental_requests.with_driver or v.with_driver = true)
  )
);

-- Offers must be backed by enough approved, paid, matching vehicles.
drop policy if exists "fleet suppliers can offer on open requests" on public.rental_offers;
create policy "approved providers with eligible vehicles can offer on open requests"
on public.rental_offers
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and status = 'submitted'
  and exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    join public.rental_requests r on r.id = rental_offers.request_id
    where m.organization_id = rental_offers.organization_id
      and m.user_id = (select auth.uid())
      and o.organization_type in (
        'individual_owner'::public.organization_type,
        'fleet_supplier'::public.organization_type
      )
      and o.approval_status = 'approved'
      and r.status = 'open'
      and (
        select count(*)
        from public.vehicles v
        where v.organization_id = o.id
          and v.review_status = 'approved'
          and v.payment_status in ('verified', 'waived')
          and (v.license_expiry_date is null or v.license_expiry_date >= current_date)
          and (
            o.organization_type <> 'individual_owner'::public.organization_type
            or v.registration_expires_at is null
            or v.registration_expires_at > now()
          )
          and v.governorate = r.governorate
          and (
            r.vehicle_type = 'أخرى'
            or lower(btrim(v.vehicle_type)) = lower(btrim(r.vehicle_type))
            or (r.vehicle_type = 'فان / ميكروباص' and v.vehicle_type in ('فان','ميكروباص'))
            or (r.vehicle_type = 'نقل' and v.vehicle_type like 'نقل%')
          )
          and (not r.with_driver or v.with_driver = true)
      ) >= rental_offers.vehicle_count
  )
);

-- Employee requests are visible only to approved providers with a matching paid vehicle.
drop policy if exists "employees and eligible providers read employee requests" on public.employee_rental_requests;
create policy "employees and eligible providers read employee requests"
on public.employee_rental_requests
for select
to authenticated
using (
  employee_user_id = (select auth.uid())
  or exists (
    select 1 from public.platform_admins a
    where a.user_id = (select auth.uid())
  )
  or (
    status = 'open'
    and exists (
      select 1
      from public.organization_memberships m
      join public.organizations o on o.id = m.organization_id
      join public.vehicles v on v.organization_id = m.organization_id
      where m.user_id = (select auth.uid())
        and o.organization_type in (
          'individual_owner'::public.organization_type,
          'fleet_supplier'::public.organization_type
        )
        and o.approval_status = 'approved'
        and v.review_status = 'approved'
        and v.with_driver = true
        and v.payment_status in ('verified', 'waived')
        and (v.license_expiry_date is null or v.license_expiry_date >= current_date)
        and (
          o.organization_type <> 'individual_owner'::public.organization_type
          or v.registration_expires_at is null
          or v.registration_expires_at > now()
        )
        and (
          employee_rental_requests.vehicle_type = 'أخرى'
          or lower(btrim(v.vehicle_type)) = lower(btrim(employee_rental_requests.vehicle_type))
        )
        and v.seats >= employee_rental_requests.seats
        and v.governorate = employee_rental_requests.governorate
    )
  )
);

-- The submitted employee offer must reference the same eligible vehicle that matches the request.
drop policy if exists "approved providers submit offers for open employee requests" on public.employee_rental_offers;
create policy "approved providers submit offers for open employee requests"
on public.employee_rental_offers
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and status = 'submitted'
  and driver_included = true
  and exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    join public.vehicles v on v.organization_id = o.id
    join public.employee_rental_requests r on r.id = employee_rental_offers.request_id
    where m.user_id = (select auth.uid())
      and m.organization_id = employee_rental_offers.organization_id
      and v.id = employee_rental_offers.vehicle_id
      and o.organization_type in (
        'individual_owner'::public.organization_type,
        'fleet_supplier'::public.organization_type
      )
      and o.approval_status = 'approved'
      and v.review_status = 'approved'
      and v.with_driver = true
      and v.payment_status in ('verified', 'waived')
      and (v.license_expiry_date is null or v.license_expiry_date >= current_date)
      and (
        o.organization_type <> 'individual_owner'::public.organization_type
        or v.registration_expires_at is null
        or v.registration_expires_at > now()
      )
      and (
        r.vehicle_type = 'أخرى'
        or lower(btrim(v.vehicle_type)) = lower(btrim(r.vehicle_type))
      )
      and v.seats >= r.seats
      and v.governorate = r.governorate
      and r.status = 'open'
  )
);

-- These RPCs return company-member emails or change offer state; they are not public endpoints.
revoke all on function public.company_list_members() from public, anon;
grant execute on function public.company_list_members() to authenticated;

revoke all on function public.company_respond_to_rental_offer(uuid, text) from public, anon;
grant execute on function public.company_respond_to_rental_offer(uuid, text) to authenticated;

notify pgrst, 'reload schema';

commit;

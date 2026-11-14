create or replace function public.preview_managed_sourcing_eligibility(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request public.managed_sourcing_requests%rowtype;
  v_users integer := 0;
  v_vehicles integer := 0;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.platform_admins pa where pa.user_id = (select auth.uid())
  ) then
    raise exception 'غير مصرح لك بمعاينة المؤهلين';
  end if;

  select * into v_request
  from public.managed_sourcing_requests r
  where r.id = p_request_id;

  if not found then raise exception 'تفويض البحث غير موجود'; end if;

  with eligible as (
    select m.user_id, v.id as vehicle_id,
      row_number() over (
        partition by v.id
        order by case m.role::text when 'owner' then 1 when 'manager' then 2 else 3 end, m.user_id
      ) as recipient_order
    from public.vehicles v
    join public.organizations o on o.id = v.organization_id
    join public.organization_memberships m on m.organization_id = v.organization_id
    where o.organization_type in ('individual_owner','fleet_supplier')
      and o.approval_status = 'approved'
      and v.review_status = 'approved'
      and v.payment_status in ('verified','waived')
      and (v.license_expiry_date is null or v.license_expiry_date >= current_date)
      and (o.organization_type <> 'individual_owner'
        or (v.registration_expires_at is not null and v.registration_expires_at > now()))
      and (cardinality(coalesce(v_request.governorates, '{}'::text[])) = 0
        or v.governorate = any(v_request.governorates))
      and (v_request.vehicle_type in ('','أي نوع مناسب','أخرى')
        or lower(btrim(v.vehicle_type)) = lower(btrim(v_request.vehicle_type)))
      and (v_request.model_year_min is null or v.model_year >= v_request.model_year_min)
      and (v_request.model_year_max is null or v.model_year <= v_request.model_year_max)
      and (cardinality(coalesce(v_request.makes_models, '{}'::text[])) = 0
        or exists (
          select 1 from unnest(v_request.makes_models) mm
          where (v.make || ' ' || v.model) ilike ('%' || mm || '%')
             or public.managed_sourcing_model_matches(v.make, v.model, array[mm])
        ))
  ), chosen as (
    select user_id, vehicle_id from eligible where recipient_order = 1
  )
  select count(distinct user_id), count(distinct vehicle_id)
  into v_users, v_vehicles
  from chosen;

  return jsonb_build_object('eligible_users',v_users,'eligible_vehicles',v_vehicles);
end;
$function$;

revoke all on function public.preview_managed_sourcing_eligibility(uuid) from public;
grant execute on function public.preview_managed_sourcing_eligibility(uuid) to authenticated;

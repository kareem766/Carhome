-- Enforce subscription request quotas and package vehicle limits at the database boundary.
-- The AFTER INSERT trigger is the single source of truth for consuming one request credit.

create or replace function private.consume_managed_sourcing_subscription_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_vehicle_limit integer;
  v_updated_count integer;
begin
  if new.payment_model = 'subscription' then
    select p.included_vehicles_per_request
      into v_vehicle_limit
    from public.managed_sourcing_subscriptions s
    join public.managed_sourcing_packages p on p.id = s.package_id
    where s.id = new.subscription_id
      and s.organization_id = new.company_organization_id
      and s.package_id = new.package_id
      and s.status = 'active'
      and s.payment_status = 'verified'
      and s.starts_at <= now()
      and s.ends_at > now()
      and s.requests_used < s.requests_included
    for update of s;

    if not found then
      raise exception 'الاشتراك غير نشط أو منتهي أو لا يحتوي على طلبات متاحة';
    end if;

    if v_vehicle_limit is not null and new.quantity > v_vehicle_limit then
      raise exception 'عدد السيارات يتجاوز الحد المسموح به في باقة البحث المختارة';
    end if;

    update public.managed_sourcing_subscriptions s
       set requests_used = s.requests_used + 1,
           updated_at = now()
     where s.id = new.subscription_id
       and s.organization_id = new.company_organization_id
       and s.package_id = new.package_id
       and s.status = 'active'
       and s.payment_status = 'verified'
       and s.starts_at <= now()
       and s.ends_at > now()
       and s.requests_used < s.requests_included;

    get diagnostics v_updated_count = row_count;
    if v_updated_count <> 1 then
      raise exception 'تعذر حجز طلب من رصيد الاشتراك؛ حدّث البيانات وحاول مرة أخرى';
    end if;
  end if;

  return new;
end;
$function$;

-- This RPC previously incremented requests_used before INSERT, while the
-- AFTER INSERT trigger incremented it again. Validate and lock here, but let
-- the trigger consume exactly one credit atomically with the request insert.
create or replace function public.managed_sourcing_submit_request(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_user uuid := auth.uid();
  v_org uuid := (p_payload->>'company_organization_id')::uuid;
  v_model text := coalesce(p_payload->>'payment_model','per_request');
  v_sub_id uuid := nullif(p_payload->>'subscription_id','')::uuid;
  v_package_id uuid := nullif(p_payload->>'package_id','')::uuid;
  v_request_id uuid;
  v_package uuid;
  v_vehicle_limit integer;
  v_quantity integer := coalesce((p_payload->>'quantity')::int,1);
begin
  if v_user is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;

  if not exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id=m.organization_id
    where m.organization_id=v_org and m.user_id=v_user and o.organization_type='company'
  ) then
    raise exception 'غير مصرح بإنشاء طلب لهذه الشركة';
  end if;

  if v_model='subscription' then
    if v_sub_id is null then raise exception 'يجب اختيار اشتراك صالح'; end if;

    select s.package_id, p.included_vehicles_per_request
      into v_package, v_vehicle_limit
    from public.managed_sourcing_subscriptions s
    join public.managed_sourcing_packages p on p.id=s.package_id
    where s.id=v_sub_id
      and s.organization_id=v_org
      and s.package_id=v_package_id
      and s.status='active'
      and s.payment_status='verified'
      and s.starts_at<=now()
      and s.ends_at>now()
      and s.requests_used<s.requests_included
    for update of s;

    if v_package is null then
      raise exception 'الاشتراك غير نشط أو منتهي أو لا يحتوي على رصيد طلبات متاح';
    end if;

    if v_vehicle_limit is not null and v_quantity > v_vehicle_limit then
      raise exception 'عدد السيارات يتجاوز الحد المسموح به في باقة البحث المختارة';
    end if;
  elsif v_model='per_request' then
    if v_sub_id is not null or v_package_id is not null then
      raise exception 'لا يجوز ربط طلب مستقل باشتراك أو باقة';
    end if;
    v_package := null;
  else
    raise exception 'طريقة السداد غير صحيحة';
  end if;

  insert into public.managed_sourcing_requests (
    company_organization_id, created_by, title, service_type, quantity, vehicle_type,
    makes_models, model_year_min, model_year_max, governorates, duration_type,
    duration_months, start_date, budget_per_vehicle_egp, total_budget_egp,
    requirements, delegation_level, urgency, payment_model, package_id, subscription_id
  ) values (
    v_org, v_user, p_payload->>'title', coalesce(p_payload->>'service_type','search_and_coordinate'),
    v_quantity, coalesce(p_payload->>'vehicle_type','أي نوع مناسب'),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'makes_models','[]'::jsonb))), '{}'),
    nullif(p_payload->>'model_year_min','')::int, nullif(p_payload->>'model_year_max','')::int,
    coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'governorates','[]'::jsonb))), '{}'),
    coalesce(p_payload->>'duration_type','monthly'), coalesce((p_payload->>'duration_months')::int,1),
    nullif(p_payload->>'start_date','')::date,
    nullif(p_payload->>'budget_per_vehicle_egp','')::numeric,
    nullif(p_payload->>'total_budget_egp','')::numeric,
    coalesce(p_payload->>'requirements',''), coalesce(p_payload->>'delegation_level','full_coordination'),
    coalesce(p_payload->>'urgency','standard'), v_model, v_package, v_sub_id
  ) returning id into v_request_id;

  insert into public.managed_sourcing_updates(request_id,created_by,visibility,title,body,status_from,status_to)
  values(v_request_id,v_user,'company','تم استلام طلب التفويض','تم تسجيل طلبك بنجاح وسيقوم فريق My Car بمراجعته.','new','new');

  return v_request_id;
end;
$function$;

revoke execute on function public.managed_sourcing_submit_request(jsonb) from public, anon;
grant execute on function public.managed_sourcing_submit_request(jsonb) to authenticated;

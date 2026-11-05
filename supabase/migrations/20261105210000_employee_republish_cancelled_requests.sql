alter table public.employee_rental_requests
  add column if not exists reposted_from_request_id uuid
  references public.employee_rental_requests(id) on delete set null;

create index if not exists employee_requests_reposted_from_idx
  on public.employee_rental_requests(reposted_from_request_id)
  where reposted_from_request_id is not null;

create or replace function public.employee_republish_cancelled_request(
  p_request_id uuid,
  p_title text,
  p_vehicle_type text,
  p_seats integer,
  p_governorate text,
  p_pickup_address text,
  p_duration_months integer,
  p_start_date date,
  p_work_days_per_week integer,
  p_daily_hours numeric,
  p_budget_min_egp numeric default null,
  p_budget_max_egp numeric default null,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_new_request_id uuid;
  v_fee_enabled boolean;
begin
  if v_uid is null then
    raise exception 'يجب تسجيل الدخول لإعادة نشر الطلب.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.employee_accounts e
    where e.user_id = v_uid and e.account_status = 'active'
  ) then
    raise exception 'حساب الموظف غير نشط.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.employee_rental_requests r
    where r.id = p_request_id
      and r.employee_user_id = v_uid
      and r.status = 'cancelled'
  ) then
    raise exception 'لا يمكن إعادة نشر هذا الطلب؛ تأكد أنه طلب ملغي تابع لحسابك.' using errcode = '42501';
  end if;

  if p_start_date is null or p_start_date < current_date then
    raise exception 'يجب اختيار تاريخ بداية اليوم أو تاريخ لاحق.' using errcode = '22007';
  end if;

  select coalesce(s.request_fee_enabled, false)
    into v_fee_enabled
  from public.employee_service_settings s
  where s.id = true;

  if coalesce(v_fee_enabled, false) then
    raise exception 'إعادة نشر الطلب متوقفة مؤقتًا لحين تفعيل إجراءات الدفع.' using errcode = '55000';
  end if;

  insert into public.employee_rental_requests (
    employee_user_id,
    reposted_from_request_id,
    title,
    vehicle_type,
    seats,
    governorate,
    pickup_address,
    duration_months,
    start_date,
    work_days_per_week,
    daily_hours,
    budget_min_egp,
    budget_max_egp,
    details,
    with_driver,
    status
  ) values (
    v_uid,
    p_request_id,
    btrim(p_title),
    btrim(p_vehicle_type),
    p_seats,
    btrim(p_governorate),
    btrim(p_pickup_address),
    p_duration_months,
    p_start_date,
    p_work_days_per_week,
    p_daily_hours,
    p_budget_min_egp,
    p_budget_max_egp,
    nullif(btrim(coalesce(p_details, '')), ''),
    true,
    'pending_review'
  )
  returning id into v_new_request_id;

  return v_new_request_id;
end;
$function$;

revoke all on function public.employee_republish_cancelled_request(
  uuid, text, text, integer, text, text, integer, date, integer, numeric, numeric, numeric, text
) from public, anon;
grant execute on function public.employee_republish_cancelled_request(
  uuid, text, text, integer, text, text, integer, date, integer, numeric, numeric, numeric, text
) to authenticated;

comment on column public.employee_rental_requests.reposted_from_request_id is
  'Links a newly submitted employee request to the cancelled request it was copied from; historical offers and messages remain attached to the original.';

create or replace function public.company_respond_to_rental_offer(
  p_offer_id uuid,
  p_status text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_request_id uuid;
  v_company_org uuid;
begin
  if v_uid is null then raise exception 'يجب تسجيل الدخول'; end if;
  if p_status not in ('accepted','rejected') then raise exception 'حالة الرد غير صالحة'; end if;
  select m.organization_id into v_company_org
  from public.organization_memberships m join public.organizations o on o.id=m.organization_id
  where m.user_id=v_uid and o.organization_type='company'::public.organization_type
  order by m.created_at limit 1;
  if v_company_org is null then raise exception 'هذه العملية متاحة لحسابات الشركات فقط'; end if;
  select r.id into v_request_id
  from public.rental_offers ro join public.rental_requests r on r.id=ro.request_id
  where ro.id=p_offer_id and r.organization_id=v_company_org and r.status in ('open','reviewing');
  if v_request_id is null then raise exception 'العرض غير موجود أو لا تملك الشركة صلاحية الرد عليه'; end if;
  update public.rental_offers set status=p_status,updated_at=now()
  where id=p_offer_id and request_id=v_request_id and status='submitted';
  if not found then raise exception 'تم الرد على هذا العرض مسبقًا أو لم يعد متاحًا'; end if;
  -- rental_offers_notify_changes trigger owns provider notifications to avoid duplicates.
  return true;
end;
$function$;
revoke all on function public.company_respond_to_rental_offer(uuid,text) from public;
grant execute on function public.company_respond_to_rental_offer(uuid,text) to authenticated;
-- Server-side payment order preparation and provider checkout finalization.
-- Staged only. This migration must be reviewed and applied after the payment-core schema.
create or replace function public.create_mycar_payment(
  p_user_id uuid,
  p_purpose text,
  p_entity_id uuid,
  p_provider_code text,
  p_idempotency_key text,
  p_period_months integer default 1,
  p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_entity_table text;
  v_org_id uuid;
  v_created_by uuid;
  v_org_type text;
  v_original numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_credit numeric(12,2) := 0;
  v_due numeric(12,2) := 0;
  v_coupon text;
  v_discount_service text;
  v_payment_id uuid;
  v_attempt_id uuid;
  v_attempt_number integer;
  v_request_key text;
  v_existing public.payments%rowtype;
  v_attempt public.payment_attempts%rowtype;
  v_gateway_enabled boolean;
  v_code public.discount_codes%rowtype;
  v_redemptions integer;
  v_role text;
begin
  if p_user_id is null
     or p_purpose not in ('vehicle_registration','company_subscription','advertising','featured_advertising','managed_sourcing_request','managed_sourcing_subscription')
     or p_entity_id is null
     or p_provider_code not in ('paymob','fawry')
     or p_idempotency_key is null
     or length(btrim(p_idempotency_key)) < 12
     or length(p_idempotency_key) > 120 then
    return jsonb_build_object('ok',false,'error','invalid_request');
  end if;

  select g.is_enabled into v_gateway_enabled
  from public.payment_gateways g where g.provider_code = p_provider_code;
  if coalesce(v_gateway_enabled,false) is not true then
    return jsonb_build_object('ok',false,'error','gateway_disabled');
  end if;

  if p_purpose = 'vehicle_registration' then
    if p_period_months is null or p_period_months < 1 or p_period_months > 24 then
      return jsonb_build_object('ok',false,'error','invalid_period');
    end if;
    v_entity_table := 'vehicles';
    select v.organization_id, v.created_by
      into v_org_id, v_created_by
    from public.vehicles v
    where v.id = p_entity_id
      and v.review_status = 'pending_payment'
      and v.payment_status = 'pending'
    for update;
    if v_org_id is null then return jsonb_build_object('ok',false,'error','vehicle_not_payable'); end if;
    if not exists (
      select 1 from public.organization_memberships m
      where m.organization_id = v_org_id and m.user_id = p_user_id
    ) and v_created_by is distinct from p_user_id then
      return jsonb_build_object('ok',false,'error','not_authorized');
    end if;
    select o.organization_type into v_org_type
    from public.organizations o where o.id = v_org_id;
    if v_org_type not in ('individual_owner','fleet_supplier') then
      return jsonb_build_object('ok',false,'error','unsupported_account_type');
    end if;
    if v_org_type = 'fleet_supplier' then
      select coalesce(s.supplier_vehicle_registration_fee_egp,150) * p_period_months
        into v_original from public.platform_settings s where s.id = true;
    else
      select coalesce(s.owner_vehicle_monthly_fee_egp,300) * p_period_months
        into v_original from public.platform_settings s where s.id = true;
    end if;
    v_coupon := nullif(upper(btrim(coalesce(p_coupon_code,''))),'');
    v_discount_service := 'vehicle_registration';
    v_role := v_org_type;
  elsif p_purpose = 'company_subscription' then
    v_entity_table := 'company_subscriptions';
    select s.organization_id, s.created_by,
           coalesce(s.original_amount_egp,s.amount_egp),
           coalesce(s.discount_amount_egp,0),
           coalesce(s.final_amount_egp,s.amount_egp),
           s.coupon_code, o.organization_type
      into v_org_id, v_created_by, v_original, v_discount, v_due, v_coupon, v_org_type
    from public.company_subscriptions s
    join public.organizations o on o.id=s.organization_id
    where s.id=p_entity_id and s.status='pending' and s.payment_status='pending'
    for update of s;
    if v_org_id is null then return jsonb_build_object('ok',false,'error','subscription_not_payable'); end if;
    if not exists (select 1 from public.organization_memberships m where m.organization_id=v_org_id and m.user_id=p_user_id)
       and v_created_by is distinct from p_user_id then
      return jsonb_build_object('ok',false,'error','not_authorized');
    end if;
    if p_coupon_code is not null and upper(btrim(p_coupon_code)) <> coalesce(v_coupon,'') then
      return jsonb_build_object('ok',false,'error','coupon_must_be_applied_before_checkout');
    end if;
  elsif p_purpose in ('advertising','featured_advertising') then
    v_entity_table := 'vehicle_promotions';
    select p.organization_id, p.created_by,
           coalesce(p.original_amount_egp,p.plan_price_egp_snapshot),
           coalesce(p.discount_amount_egp,0),
           coalesce(p.previous_payment_credit_egp,0),
           coalesce(p.payment_due_egp,p.final_amount_egp),
           o.organization_type
      into v_org_id, v_created_by, v_original, v_discount, v_credit, v_due, v_org_type
    from public.vehicle_promotions p
    join public.organizations o on o.id=p.organization_id
    where p.id=p_entity_id and p.status='pending_review' and p.payment_status='pending'
    for update of p;
    if v_org_id is null then return jsonb_build_object('ok',false,'error','promotion_not_payable'); end if;
    if not exists (select 1 from public.organization_memberships m where m.organization_id=v_org_id and m.user_id=p_user_id)
       and v_created_by is distinct from p_user_id then
      return jsonb_build_object('ok',false,'error','not_authorized');
    end if;
    if p_coupon_code is not null then
      return jsonb_build_object('ok',false,'error','coupon_must_be_applied_before_checkout');
    end if;
    v_due := coalesce(v_due, v_original - v_discount - v_credit);
  elsif p_purpose = 'managed_sourcing_request' then
    v_entity_table := 'managed_sourcing_requests';
    select r.company_organization_id, r.created_by, r.quoted_fee_egp
      into v_org_id, v_created_by, v_original
    from public.managed_sourcing_requests r
    where r.id=p_entity_id and r.status='awaiting_payment'
      and r.payment_status='awaiting_payment' and r.quoted_fee_egp is not null
    for update;
    if v_org_id is null or v_original is null then
      return jsonb_build_object('ok',false,'error','request_not_payable');
    end if;
    if not exists (select 1 from public.organization_memberships m where m.organization_id=v_org_id and m.user_id=p_user_id)
       and v_created_by is distinct from p_user_id then
      return jsonb_build_object('ok',false,'error','not_authorized');
    end if;
    v_due := v_original;
    if p_coupon_code is not null then return jsonb_build_object('ok',false,'error','coupon_not_supported_for_this_service'); end if;
  elsif p_purpose = 'managed_sourcing_subscription' then
    v_entity_table := 'managed_sourcing_subscriptions';
    select s.organization_id, s.created_by,
           coalesce(s.original_amount_egp,s.monthly_price_egp),
           coalesce(s.discount_amount_egp,0),
           coalesce(s.final_amount_egp,s.monthly_price_egp),
           s.coupon_code
      into v_org_id, v_created_by, v_original, v_discount, v_due, v_coupon
    from public.managed_sourcing_subscriptions s
    where s.id=p_entity_id and s.status='pending_review'
      and s.payment_status in ('submitted','not_submitted')
    for update;
    if v_org_id is null then return jsonb_build_object('ok',false,'error','sourcing_subscription_not_payable'); end if;
    if not exists (select 1 from public.organization_memberships m where m.organization_id=v_org_id and m.user_id=p_user_id)
       and v_created_by is distinct from p_user_id then
      return jsonb_build_object('ok',false,'error','not_authorized');
    end if;
    if p_coupon_code is not null and upper(btrim(p_coupon_code)) <> coalesce(v_coupon,'') then
      return jsonb_build_object('ok',false,'error','coupon_must_be_applied_before_checkout');
    end if;
  end if;

  v_original := round(coalesce(v_original,0),2);
  v_discount := round(coalesce(v_discount,0),2);
  v_credit := round(coalesce(v_credit,0),2);
  v_due := round(coalesce(v_due,v_original-v_discount-v_credit),2);
  if v_original <= 0 or v_due <= 0 or v_discount + v_credit > v_original
     or v_due <> v_original-v_discount-v_credit then
    return jsonb_build_object('ok',false,'error','invalid_amount_configuration');
  end if;

  select * into v_existing
  from public.payments p
  where p.created_by=p_user_id and p.idempotency_key=p_idempotency_key
  for update;

  if found then
    if v_existing.entity_table <> v_entity_table or v_existing.entity_id <> p_entity_id
       or v_existing.purpose <> p_purpose or v_existing.provider_code <> p_provider_code then
      return jsonb_build_object('ok',false,'error','idempotency_conflict');
    end if;
    if v_existing.status='paid' then
      return jsonb_build_object('ok',false,'error','already_paid');
    end if;
    if v_existing.status in ('cancelled','refunded','partially_refunded','review_required') then
      return jsonb_build_object('ok',false,'error','payment_closed');
    end if;
    select * into v_attempt from public.payment_attempts a
    where a.payment_id=v_existing.id and a.provider_code=p_provider_code
      and a.status in ('created','pending')
      and a.checkout_url is not null and (a.expires_at is null or a.expires_at > now())
    order by a.attempt_number desc limit 1;
    if found then
      return jsonb_build_object(
        'ok',true,'existing',true,'payment_id',v_existing.id,'attempt_id',v_attempt.id,
        'amount_due',v_existing.amount_due,'purpose',v_existing.purpose,
        'merchant_reference',v_attempt.request_key,'checkout_url',v_attempt.checkout_url,
        'provider_reference',v_attempt.provider_reference
      );
    end if;
    select * into v_attempt from public.payment_attempts a
    where a.payment_id=v_existing.id and a.provider_code=p_provider_code
      and a.status in ('created','pending') and a.checkout_url is null
    order by a.attempt_number desc limit 1
    for update;
    if found then
      return jsonb_build_object('ok',false,'error','payment_attempt_in_progress');
    end if;
    v_payment_id := v_existing.id;
  else
    insert into public.payments(
      created_by,purpose,entity_table,entity_id,provider_code,status,currency,
      original_amount,discount_amount,credit_amount,amount_due,discount_code,
      idempotency_key,description,metadata
    ) values (
      p_user_id,p_purpose,v_entity_table,p_entity_id,p_provider_code,'created','EGP',
      v_original,v_discount,v_credit,v_due,v_coupon,p_idempotency_key,
      case p_purpose
        when 'vehicle_registration' then 'رسوم تسجيل سيارة'
        when 'company_subscription' then 'اشتراك حساب الشركة'
        when 'advertising' then 'إعلان سيارة'
        when 'featured_advertising' then 'إعلان مميز'
        when 'managed_sourcing_request' then 'رسوم طلب بحث مستقل'
        when 'managed_sourcing_subscription' then 'اشتراك تفويض My Car للبحث'
      end,
      jsonb_build_object('period_months',case when p_purpose='vehicle_registration' then p_period_months else null end)
    ) returning id into v_payment_id;

    if v_coupon is not null and p_purpose='vehicle_registration' then
      select * into v_code from public.discount_codes
      where code=v_coupon for update;
      if not found or not v_code.is_active
        or (v_code.starts_at is not null and now()<v_code.starts_at)
        or (v_code.expires_at is not null and now()>=v_code.expires_at)
        or not ('vehicle_registration'=any(v_code.services))
        or not (v_role=any(v_code.target_roles))
        or v_original < coalesce(v_code.min_order_egp,0) then
        raise exception 'كود الخصم غير صالح أو غير متاح لهذه الخدمة';
      end if;
      select count(*) into v_redemptions from public.discount_code_redemptions
      where discount_code_id=v_code.id and status in ('pending','confirmed');
      if v_code.max_redemptions is not null and v_redemptions>=v_code.max_redemptions then
        raise exception 'تم استنفاد عدد مرات استخدام الكود';
      end if;
      select count(*) into v_redemptions from public.discount_code_redemptions
      where discount_code_id=v_code.id and user_id=p_user_id and status in ('pending','confirmed');
      if v_redemptions>=coalesce(v_code.max_per_user,1) then
        raise exception 'لقد استخدمت هذا الكود الحد الأقصى المسموح به لحسابك';
      end if;
      if v_code.new_customers_only and exists(
        select 1 from public.discount_code_redemptions r where r.user_id=p_user_id and r.status='confirmed'
      ) then raise exception 'هذا الكود مخصص للعملاء الجدد'; end if;
      v_discount := case when v_code.discount_type='percent'
        then round(v_original*v_code.discount_value/100,2) else v_code.discount_value end;
      if v_code.max_discount_egp is not null then v_discount:=least(v_discount,v_code.max_discount_egp); end if;
      v_discount:=least(v_discount,v_original-0.01);
      if v_discount<=0 then raise exception 'قيمة الخصم غير صالحة'; end if;
      v_due:=v_original-v_discount;
      update public.payments set discount_amount=v_discount,amount_due=v_due,discount_code=v_code.code
      where id=v_payment_id;
      insert into public.discount_code_redemptions(
        discount_code_id,code,user_id,service,reference_id,
        original_amount_egp,discount_amount_egp,final_amount_egp,status
      ) values (
        v_code.id,v_code.code,p_user_id,'vehicle_registration',v_payment_id,
        v_original,v_discount,v_due,'pending'
      );
    end if;
  end if;

  select coalesce(max(a.attempt_number),0)+1 into v_attempt_number
  from public.payment_attempts a where a.payment_id=v_payment_id;
  v_request_key := 'MC-' || replace(gen_random_uuid()::text,'-','');
  insert into public.payment_attempts(payment_id,attempt_number,provider_code,status,request_key)
  values(v_payment_id,v_attempt_number,p_provider_code,'created',v_request_key)
  returning id into v_attempt_id;

  return jsonb_build_object(
    'ok',true,'existing',false,'payment_id',v_payment_id,'attempt_id',v_attempt_id,
    'amount_due',v_due,'original_amount',v_original,'discount_amount',v_discount,
    'credit_amount',v_credit,'purpose',p_purpose,'merchant_reference',v_request_key
  );
end;
$$;

create or replace function public.finalize_mycar_payment_attempt(
  p_attempt_id uuid,
  p_provider_code text,
  p_provider_reference text,
  p_checkout_url text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_payment_id uuid;
begin
  if p_attempt_id is null or p_provider_code not in ('paymob','fawry')
     or p_provider_reference is null or length(p_provider_reference)>200
     or p_checkout_url is null or p_checkout_url !~ '^https://'
     or p_expires_at is null or p_expires_at<=now() then
    return jsonb_build_object('ok',false,'error','invalid_finalize_request');
  end if;

  select a.payment_id into v_payment_id
  from public.payment_attempts a
  where a.id=p_attempt_id and a.provider_code=p_provider_code
  for update;
  if v_payment_id is null then return jsonb_build_object('ok',false,'error','attempt_not_found'); end if;

  update public.payment_attempts
  set provider_reference=p_provider_reference,checkout_url=p_checkout_url,
      status='pending',expires_at=p_expires_at,updated_at=now()
  where id=p_attempt_id and status in ('created','pending');

  if not found then return jsonb_build_object('ok',false,'error','attempt_not_finalizable'); end if;

  update public.payments
  set provider_reference=p_provider_reference,checkout_url=p_checkout_url,
      status='pending',expires_at=p_expires_at,updated_at=now()
  where id=v_payment_id and status in ('created','pending','failed','expired');

  return jsonb_build_object('ok',true,'payment_id',v_payment_id);
end;
$$;

create or replace function public.fail_mycar_payment_attempt(
  p_attempt_id uuid,
  p_error_code text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_payment_id uuid;
begin
  update public.payment_attempts
  set status='failed',failure_code=left(coalesce(p_error_code,'provider_error'),100),
      completed_at=now(),updated_at=now()
  where id=p_attempt_id and status in ('created','pending')
  returning payment_id into v_payment_id;
  if v_payment_id is not null then
    update public.payments p set status='failed',
      failure_code=left(coalesce(p_error_code,'provider_error'),100),updated_at=now()
    where p.id=v_payment_id and p.status<>'paid'
      and not exists(select 1 from public.payment_attempts a where a.payment_id=v_payment_id and a.status='pending');
  end if;
end;
$$;

revoke all on function public.create_mycar_payment(uuid,text,uuid,text,text,integer,text) from public,anon,authenticated;
revoke all on function public.finalize_mycar_payment_attempt(uuid,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.fail_mycar_payment_attempt(uuid,text) from public,anon,authenticated;
grant execute on function public.create_mycar_payment(uuid,text,uuid,text,text,integer,text) to service_role;
grant execute on function public.finalize_mycar_payment_attempt(uuid,text,text,text,timestamptz) to service_role;
grant execute on function public.fail_mycar_payment_attempt(uuid,text) to service_role;

comment on function public.create_mycar_payment(uuid,text,uuid,text,text,integer,text) is
  'Creates a canonical My Car payment from a server-verified service record. Amounts are never accepted from the browser.';

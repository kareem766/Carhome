-- My Car discount codes. Applied to the My Car Supabase project on 2026-11-02.
create table if not exists public.discount_codes (
 id uuid primary key default gen_random_uuid(), code text not null unique,
 name text not null default '', discount_type text not null check(discount_type in ('percent','fixed')),
 discount_value numeric(12,2) not null check(discount_value>0),
 max_discount_egp numeric(12,2), min_order_egp numeric(12,2) not null default 0 check(min_order_egp>=0),
 services text[] not null default array['vehicle_advertising']::text[],
 target_roles text[] not null default array['company','individual_owner','fleet_supplier']::text[],
 starts_at timestamptz not null default now(), expires_at timestamptz,
 max_redemptions integer check(max_redemptions is null or max_redemptions>0),
 max_per_user integer not null default 1 check(max_per_user>0), new_customers_only boolean not null default false,
 is_active boolean not null default true, created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint discount_codes_percent_range check(discount_type<>'percent' or discount_value<100),
 constraint discount_codes_code_format check(code=upper(btrim(code)) and code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
 constraint discount_codes_dates check(expires_at is null or expires_at>starts_at)
);
create unique index if not exists discount_codes_code_unique on public.discount_codes(upper(code));
create table if not exists public.discount_code_redemptions (
 id uuid primary key default gen_random_uuid(), discount_code_id uuid not null references public.discount_codes(id) on delete restrict,
 code text not null, user_id uuid not null references auth.users(id) on delete restrict, service text not null, reference_id uuid,
 original_amount_egp numeric(12,2) not null check(original_amount_egp>0),
 discount_amount_egp numeric(12,2) not null check(discount_amount_egp>0),
 final_amount_egp numeric(12,2) not null check(final_amount_egp>0),
 status text not null default 'pending' check(status in ('pending','confirmed','cancelled')),
 created_at timestamptz not null default now(), confirmed_at timestamptz
);
create index if not exists discount_redemptions_code_status_idx on public.discount_code_redemptions(discount_code_id,status);
create index if not exists discount_redemptions_user_code_idx on public.discount_code_redemptions(user_id,discount_code_id,status);
alter table public.vehicle_promotions add column if not exists coupon_code text;
alter table public.vehicle_promotions add column if not exists original_amount_egp numeric(12,2);
alter table public.vehicle_promotions add column if not exists discount_amount_egp numeric(12,2) not null default 0;
alter table public.vehicle_promotions add column if not exists final_amount_egp numeric(12,2);
alter table public.vehicle_payment_submissions add column if not exists coupon_code text;
alter table public.vehicle_payment_submissions add column if not exists original_amount_egp numeric(12,2);
alter table public.vehicle_payment_submissions add column if not exists discount_amount_egp numeric(12,2) not null default 0;
alter table public.vehicle_payment_submissions add column if not exists final_amount_egp numeric(12,2);
alter table public.company_subscriptions add column if not exists coupon_code text;
alter table public.company_subscriptions add column if not exists original_amount_egp numeric(12,2);
alter table public.company_subscriptions add column if not exists discount_amount_egp numeric(12,2) not null default 0;
alter table public.company_subscriptions add column if not exists final_amount_egp numeric(12,2);
alter table public.managed_sourcing_subscriptions add column if not exists coupon_code text;
alter table public.managed_sourcing_subscriptions add column if not exists original_amount_egp numeric(12,2);
alter table public.managed_sourcing_subscriptions add column if not exists discount_amount_egp numeric(12,2) not null default 0;
alter table public.managed_sourcing_subscriptions add column if not exists final_amount_egp numeric(12,2);
alter table public.discount_codes enable row level security;
alter table public.discount_code_redemptions enable row level security;
create policy discount_codes_admin_all on public.discount_codes for all to authenticated using(exists(select 1 from public.platform_admins a where a.user_id=auth.uid())) with check(exists(select 1 from public.platform_admins a where a.user_id=auth.uid()));
create policy discount_redemptions_admin_read on public.discount_code_redemptions for select to authenticated using(exists(select 1 from public.platform_admins a where a.user_id=auth.uid()));
create policy discount_redemptions_user_read_own on public.discount_code_redemptions for select to authenticated using(user_id=auth.uid());
grant select,insert,update,delete on public.discount_codes to authenticated;
grant select on public.discount_code_redemptions to authenticated;

create or replace function public.apply_discount_code_to_payment()
returns trigger language plpgsql security definer set search_path = public, auth as $
declare
 v_code public.discount_codes%rowtype; v_service text; v_original numeric(12,2); v_discount numeric(12,2);
 v_role text; v_user uuid; v_reference uuid; v_code_text text; v_existing integer;
begin
 if tg_table_name='vehicle_promotions' then
  v_user:=coalesce(new.created_by,auth.uid()); v_service:='vehicle_advertising'; v_reference:=new.id; v_code_text:=new.coupon_code;
  select price_egp into v_original from public.advertising_plans where id=new.advertising_plan_id and is_active=true;
  select organization_type into v_role from public.organizations where id=new.organization_id;
 elsif tg_table_name='vehicle_payment_submissions' then
  v_user:=coalesce(new.submitted_by,auth.uid()); v_service:='vehicle_registration'; v_reference:=new.id; v_code_text:=new.coupon_code;
  select organization_type into v_role from public.organizations where id=new.organization_id;
  if v_role='fleet_supplier' then select coalesce(s.supplier_vehicle_registration_fee_egp,150)*greatest(coalesce(new.period_months,1),1) into v_original from public.platform_settings s where s.id=true;
  else select coalesce(s.owner_vehicle_monthly_fee_egp,300)*greatest(coalesce(new.period_months,1),1) into v_original from public.platform_settings s where s.id=true; end if;
 elsif tg_table_name='company_subscriptions' then
  v_user:=coalesce(new.created_by,auth.uid()); v_service:='company_subscription'; v_reference:=new.id; v_code_text:=new.coupon_code; v_role:='company';
  select case when new.billing_cycle='yearly' then yearly_price else monthly_price end into v_original from public.platform_subscription_plans where id=new.plan_id and is_active=true;
 elsif tg_table_name='managed_sourcing_subscriptions' then
  v_user:=coalesce(new.created_by,auth.uid()); v_service:='managed_sourcing'; v_reference:=new.id; v_code_text:=new.coupon_code; v_role:='company';
  select monthly_price_egp into v_original from public.managed_sourcing_packages where id=new.package_id and is_active=true;
 else return new; end if;
 if v_original is null or v_original<=0 then raise exception 'تعذر تحديد السعر الأساسي للخدمة'; end if;
 if v_code_text is null or btrim(v_code_text)='' then
  new.original_amount_egp:=v_original; new.discount_amount_egp:=0; new.final_amount_egp:=v_original;
  if tg_table_name in ('vehicle_payment_submissions','company_subscriptions') then new.amount_egp:=v_original; end if;
  if tg_table_name='managed_sourcing_subscriptions' then new.monthly_price_egp:=v_original; end if;
  return new;
 end if;
 if v_user is null then raise exception 'يلزم تسجيل الدخول لاستخدام كود الخصم'; end if;
 select * into v_code from public.discount_codes where code=upper(btrim(v_code_text)) for update;
 if not found or not v_code.is_active or now()<v_code.starts_at or (v_code.expires_at is not null and now()>=v_code.expires_at) then raise exception 'كود الخصم غير صالح أو منتهي الصلاحية'; end if;
 if not(v_service=any(v_code.services)) then raise exception 'كود الخصم غير متاح لهذه الخدمة'; end if;
 if v_role is null or not(v_role=any(v_code.target_roles)) then raise exception 'كود الخصم غير متاح لنوع حسابك'; end if;
 if v_original<v_code.min_order_egp then raise exception 'قيمة الطلب أقل من الحد الأدنى للكود'; end if;
 select count(*) into v_existing from public.discount_code_redemptions where discount_code_id=v_code.id and status in ('pending','confirmed');
 if v_code.max_redemptions is not null and v_existing>=v_code.max_redemptions then raise exception 'تم استنفاد عدد مرات استخدام الكود'; end if;
 select count(*) into v_existing from public.discount_code_redemptions where discount_code_id=v_code.id and user_id=v_user and status in ('pending','confirmed');
 if v_existing>=v_code.max_per_user then raise exception 'لقد استخدمت هذا الكود الحد الأقصى المسموح به لحسابك'; end if;
 if v_code.new_customers_only and exists(select 1 from public.discount_code_redemptions where user_id=v_user and status='confirmed') then raise exception 'هذا الكود مخصص للعملاء الجدد'; end if;
 v_discount:=case when v_code.discount_type='percent' then round(v_original*v_code.discount_value/100,2) else v_code.discount_value end;
 if v_code.max_discount_egp is not null then v_discount:=least(v_discount,v_code.max_discount_egp); end if;
 v_discount:=least(v_discount,v_original-0.01);
 if v_discount<=0 then raise exception 'قيمة الخصم غير صالحة'; end if;
 new.coupon_code:=v_code.code; new.original_amount_egp:=v_original; new.discount_amount_egp:=v_discount; new.final_amount_egp:=v_original-v_discount;
 if tg_table_name in ('vehicle_payment_submissions','company_subscriptions') then new.amount_egp:=v_original-v_discount; end if;
 if tg_table_name='managed_sourcing_subscriptions' then new.monthly_price_egp:=v_original-v_discount; end if;
 insert into public.discount_code_redemptions(discount_code_id,code,user_id,service,reference_id,original_amount_egp,discount_amount_egp,final_amount_egp,status)
 values(v_code.id,v_code.code,v_user,v_service,v_reference,v_original,v_discount,v_original-v_discount,'pending');
 return new;
end $;
create or replace function public.sync_discount_redemption_status()
returns trigger language plpgsql security definer set search_path = public as $
begin
 if tg_table_name='vehicle_promotions' and old.payment_status is distinct from new.payment_status then
  update public.discount_code_redemptions set status=case when new.payment_status='verified' then 'confirmed' when new.payment_status in ('rejected','cancelled') then 'cancelled' else status end, confirmed_at=case when new.payment_status='verified' then now() else confirmed_at end where reference_id=new.id and service='vehicle_advertising';
 elsif tg_table_name='vehicle_payment_submissions' and old.review_status is distinct from new.review_status then
  update public.discount_code_redemptions set status=case when new.review_status='approved' then 'confirmed' when new.review_status='rejected' then 'cancelled' else status end, confirmed_at=case when new.review_status='approved' then now() else confirmed_at end where reference_id=new.id and service='vehicle_registration';
 elsif tg_table_name='company_subscriptions' and old.payment_status is distinct from new.payment_status then
  update public.discount_code_redemptions set status=case when new.payment_status='verified' then 'confirmed' when new.payment_status in ('rejected','cancelled') then 'cancelled' else status end, confirmed_at=case when new.payment_status='verified' then now() else confirmed_at end where reference_id=new.id and service='company_subscription';
 elsif tg_table_name='managed_sourcing_subscriptions' and old.payment_status is distinct from new.payment_status then
  update public.discount_code_redemptions set status=case when new.payment_status='verified' then 'confirmed' when new.payment_status in ('rejected','cancelled') then 'cancelled' else status end, confirmed_at=case when new.payment_status='verified' then now() else confirmed_at end where reference_id=new.id and service='managed_sourcing';
 end if; return new;
end $;
drop trigger if exists apply_discount_vehicle_promotion on public.vehicle_promotions;
create trigger apply_discount_vehicle_promotion before insert on public.vehicle_promotions for each row execute function public.apply_discount_code_to_payment();
drop trigger if exists apply_discount_vehicle_payment on public.vehicle_payment_submissions;
create trigger apply_discount_vehicle_payment before insert on public.vehicle_payment_submissions for each row execute function public.apply_discount_code_to_payment();
drop trigger if exists apply_discount_company_subscription on public.company_subscriptions;
create trigger apply_discount_company_subscription before insert on public.company_subscriptions for each row execute function public.apply_discount_code_to_payment();
drop trigger if exists apply_discount_managed_sourcing_subscription on public.managed_sourcing_subscriptions;
create trigger apply_discount_managed_sourcing_subscription before insert on public.managed_sourcing_subscriptions for each row execute function public.apply_discount_code_to_payment();
drop trigger if exists sync_discount_vehicle_promotion on public.vehicle_promotions;
create trigger sync_discount_vehicle_promotion after update on public.vehicle_promotions for each row execute function public.sync_discount_redemption_status();
drop trigger if exists sync_discount_vehicle_payment on public.vehicle_payment_submissions;
create trigger sync_discount_vehicle_payment after update on public.vehicle_payment_submissions for each row execute function public.sync_discount_redemption_status();
drop trigger if exists sync_discount_company_subscription on public.company_subscriptions;
create trigger sync_discount_company_subscription after update on public.company_subscriptions for each row execute function public.sync_discount_redemption_status();
drop trigger if exists sync_discount_managed_sourcing_subscription on public.managed_sourcing_subscriptions;
create trigger sync_discount_managed_sourcing_subscription after update on public.managed_sourcing_subscriptions for each row execute function public.sync_discount_redemption_status();
create or replace function public.preview_discount_code(p_code text,p_service text,p_reference_id uuid,p_period text default 'monthly',p_period_months integer default 1)
returns jsonb language plpgsql security definer set search_path = public, auth as $
declare v_code public.discount_codes%rowtype; v_user uuid:=auth.uid(); v_role text; v_org uuid; v_original numeric(12,2); v_discount numeric(12,2); v_used integer;
begin
 if v_user is null then raise exception 'سجّل الدخول أولًا لاستخدام كود الخصم'; end if;
 select om.organization_id,o.organization_type into v_org,v_role from public.organization_memberships om join public.organizations o on o.id=om.organization_id where om.user_id=v_user limit 1;
 if p_service='vehicle_advertising' then select price_egp into v_original from public.advertising_plans where id=p_reference_id and is_active=true;
 elsif p_service='vehicle_registration' then
  if not exists(select 1 from public.vehicles where id=p_reference_id and organization_id=v_org) then raise exception 'السيارة المحددة غير مرتبطة بحسابك'; end if;
  if v_role='fleet_supplier' then select coalesce(s.supplier_vehicle_registration_fee_egp,150)*greatest(coalesce(p_period_months,1),1) into v_original from public.platform_settings s where s.id=true;
  else select coalesce(s.owner_vehicle_monthly_fee_egp,300)*greatest(coalesce(p_period_months,1),1) into v_original from public.platform_settings s where s.id=true; end if;
 elsif p_service='company_subscription' then
  if v_role<>'company' then raise exception 'الخدمة متاحة لحسابات الشركات فقط'; end if;
  select case when p_period='yearly' then yearly_price else monthly_price end into v_original from public.platform_subscription_plans where id=p_reference_id and is_active=true;
 elsif p_service='managed_sourcing' then
  if v_role<>'company' then raise exception 'الخدمة متاحة لحسابات الشركات فقط'; end if;
  select monthly_price_egp into v_original from public.managed_sourcing_packages where id=p_reference_id and is_active=true;
 else raise exception 'الخدمة غير مدعومة بكود الخصم'; end if;
 if v_original is null or v_original<=0 then raise exception 'تعذر تحديد السعر الحالي للخدمة'; end if;
 select * into v_code from public.discount_codes where code=upper(btrim(p_code)) for update;
 if not found or not v_code.is_active or now()<v_code.starts_at or (v_code.expires_at is not null and now()>=v_code.expires_at) then raise exception 'كود الخصم غير صالح أو منتهي الصلاحية'; end if;
 if not(p_service=any(v_code.services)) then raise exception 'كود الخصم غير متاح لهذه الخدمة'; end if;
 if v_role is null or not(v_role=any(v_code.target_roles)) then raise exception 'كود الخصم غير متاح لنوع حسابك'; end if;
 if v_original<v_code.min_order_egp then raise exception 'قيمة الطلب أقل من الحد الأدنى للكود'; end if;
 select count(*) into v_used from public.discount_code_redemptions where discount_code_id=v_code.id and status in ('pending','confirmed');
 if v_code.max_redemptions is not null and v_used>=v_code.max_redemptions then raise exception 'تم استنفاد عدد مرات استخدام الكود'; end if;
 select count(*) into v_used from public.discount_code_redemptions where discount_code_id=v_code.id and user_id=v_user and status in ('pending','confirmed');
 if v_used>=v_code.max_per_user then raise exception 'لقد استخدمت هذا الكود الحد الأقصى المسموح به لحسابك'; end if;
 if v_code.new_customers_only and exists(select 1 from public.discount_code_redemptions where user_id=v_user and status='confirmed') then raise exception 'هذا الكود مخصص للعملاء الجدد'; end if;
 v_discount:=case when v_code.discount_type='percent' then round(v_original*v_code.discount_value/100,2) else v_code.discount_value end;
 if v_code.max_discount_egp is not null then v_discount:=least(v_discount,v_code.max_discount_egp); end if;
 v_discount:=least(v_discount,v_original-0.01);
 if v_discount<=0 then raise exception 'قيمة الخصم غير صالحة'; end if;
 return jsonb_build_object('code',v_code.code,'name',v_code.name,'service',p_service,'original_amount_egp',v_original,'discount_amount_egp',v_discount,'final_amount_egp',v_original-v_discount);
end $;
revoke all on function public.preview_discount_code(text,text,uuid,text,integer) from public;
grant execute on function public.preview_discount_code(text,text,uuid,text,integer) to authenticated;
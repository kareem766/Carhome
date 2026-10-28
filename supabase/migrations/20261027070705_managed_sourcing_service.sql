
-- Managed vehicle sourcing: requests, offers, company actions, public timeline, editable pricing and monthly packages.
create table if not exists public.managed_sourcing_pricing (
 id uuid primary key default gen_random_uuid(), name text not null,
 min_vehicles integer not null default 1 check(min_vehicles>=1),
 max_vehicles integer check(max_vehicles is null or max_vehicles>=min_vehicles),
 service_fee_egp numeric(12,2) not null default 0 check(service_fee_egp>=0),
 urgency_multiplier numeric(5,2) not null default 1 check(urgency_multiplier>=1),
 description text not null default '', is_active boolean not null default true,
 display_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.managed_sourcing_packages (
 id uuid primary key default gen_random_uuid(), name text not null, description text not null default '',
 monthly_price_egp numeric(12,2) not null default 0 check(monthly_price_egp>=0),
 included_requests integer not null default 0 check(included_requests>=0), included_vehicles_per_request integer,
 is_active boolean not null default false, display_order integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.managed_sourcing_requests (
 id uuid primary key default gen_random_uuid(), company_organization_id uuid not null references public.organizations(id) on delete cascade,
 created_by uuid not null references auth.users(id) on delete restrict,
 title text not null check(char_length(btrim(title)) between 4 and 180),
 service_type text not null default 'search_and_coordinate' check(service_type in ('standard','fleet','staff_transport','delivery','urgent','search_and_coordinate')),
 quantity integer not null default 1 check(quantity between 1 and 1000), vehicle_type text not null default 'أي نوع مناسب',
 makes_models text[] not null default '{}', model_year_min integer check(model_year_min is null or model_year_min between 1950 and 2100),
 model_year_max integer check(model_year_max is null or model_year_max between 1950 and 2100),
 governorates text[] not null default '{}', duration_type text not null default 'monthly' check(duration_type in ('monthly','yearly','custom')),
 duration_months integer not null default 1 check(duration_months between 1 and 120), start_date date,
 budget_per_vehicle_egp numeric(12,2) check(budget_per_vehicle_egp is null or budget_per_vehicle_egp>=0),
 total_budget_egp numeric(14,2) check(total_budget_egp is null or total_budget_egp>=0), requirements text not null default '',
 delegation_level text not null default 'full_coordination' check(delegation_level in ('recommendations','supplier_quotes','full_coordination')),
 urgency text not null default 'standard' check(urgency in ('standard','urgent')),
 payment_model text not null default 'per_request' check(payment_model in ('per_request','subscription')),
 package_id uuid references public.managed_sourcing_packages(id) on delete set null,
 status text not null default 'new' check(status in ('new','under_review','quote_ready','awaiting_company_approval','awaiting_payment','searching','gathering_offers','results_ready','awaiting_company_choice','completed','unable_to_fulfill','cancelled')),
 quoted_fee_egp numeric(12,2) check(quoted_fee_egp is null or quoted_fee_egp>=0),
 payment_status text not null default 'not_required' check(payment_status in ('not_required','awaiting_payment','payment_submitted','verified','rejected','refunded')),
 payment_reference text, assigned_to uuid references auth.users(id) on delete set null, admin_internal_notes text not null default '',
 company_approved_at timestamptz, payment_submitted_at timestamptz, payment_verified_at timestamptz, completed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(model_year_min is null or model_year_max is null or model_year_max>=model_year_min)
);
create table if not exists public.managed_sourcing_offers (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.managed_sourcing_requests(id) on delete cascade,
 vehicle_id uuid references public.vehicles(id) on delete set null, supplier_organization_id uuid references public.organizations(id) on delete set null,
 make text not null, model text not null, model_year integer, vehicle_type text not null default '', seats integer, governorate text not null default '',
 monthly_price_egp numeric(12,2) check(monthly_price_egp is null or monthly_price_egp>=0),
 yearly_price_egp numeric(12,2) check(yearly_price_egp is null or yearly_price_egp>=0),
 availability_status text not null default 'awaiting_confirmation' check(availability_status in ('awaiting_confirmation','available','unavailable','limited')),
 outreach_status text not null default 'not_contacted' check(outreach_status in ('not_contacted','contacted','waiting_reply','price_received','confirmed','unavailable','excluded')),
 terms text not null default '', notes text not null default '', recommendation_rank integer not null default 0,
 company_decision text not null default 'pending' check(company_decision in ('pending','selected','rejected','needs_alternative')),
 created_by uuid not null references auth.users(id) on delete restrict, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.managed_sourcing_actions (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.managed_sourcing_requests(id) on delete cascade,
 offer_id uuid references public.managed_sourcing_offers(id) on delete set null, created_by uuid not null references auth.users(id) on delete restrict,
 action_type text not null check(action_type in ('approve_quote','submit_payment_reference','select_offer','request_alternatives','change_requirements','cancel_request','question')),
 payment_reference text, message text not null default '', created_at timestamptz not null default now()
);
create table if not exists public.managed_sourcing_updates (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.managed_sourcing_requests(id) on delete cascade,
 created_by uuid not null references auth.users(id) on delete restrict, visibility text not null default 'company' check(visibility in ('company','internal')),
 title text not null, body text not null default '', status_from text, status_to text, created_at timestamptz not null default now()
);
create index if not exists managed_sourcing_requests_company_created_idx on public.managed_sourcing_requests(company_organization_id,created_at desc);
create index if not exists managed_sourcing_requests_status_created_idx on public.managed_sourcing_requests(status,created_at desc);
create index if not exists managed_sourcing_offers_request_idx on public.managed_sourcing_offers(request_id,recommendation_rank);
create index if not exists managed_sourcing_actions_request_idx on public.managed_sourcing_actions(request_id,created_at desc);
create index if not exists managed_sourcing_updates_request_idx on public.managed_sourcing_updates(request_id,created_at desc);

insert into public.managed_sourcing_pricing(name,min_vehicles,max_vehicles,service_fee_egp,description,display_order)
select 'سيارتان أو أقل',1,2,750,'رسوم إرشادية قابلة للتعديل من لوحة الإدارة قبل بدء تقديم الخدمة.',1 where not exists(select 1 from public.managed_sourcing_pricing);
insert into public.managed_sourcing_pricing(name,min_vehicles,max_vehicles,service_fee_egp,description,display_order)
select 'من 3 إلى 10 سيارات',3,10,2000,'رسوم إرشادية قابلة للتعديل من لوحة الإدارة قبل بدء تقديم الخدمة.',2 where (select count(*) from public.managed_sourcing_pricing)=1;
insert into public.managed_sourcing_pricing(name,min_vehicles,max_vehicles,service_fee_egp,description,display_order)
select 'أساطيل أكبر من 10 سيارات',11,null,4000,'رسوم بداية إرشادية قابلة للتعديل؛ يحدد المسؤول السعر النهائي حسب النطاق.',3 where (select count(*) from public.managed_sourcing_pricing)=2;
insert into public.managed_sourcing_packages(name,description,monthly_price_egp,included_requests,included_vehicles_per_request,is_active,display_order)
select 'باقة الشركات الأساسية','باقة شهرية لعدد محدد من طلبات البحث المُدار. يحدد المسؤول السعر النهائي قبل تفعيلها.',0,5,5,false,1 where not exists(select 1 from public.managed_sourcing_packages);
insert into public.managed_sourcing_packages(name,description,monthly_price_egp,included_requests,included_vehicles_per_request,is_active,display_order)
select 'باقة الشركات المتقدمة','باقة شهرية للفرق ذات الطلبات المتكررة، مع إمكانية تخصيص حدود الاستخدام.',0,15,25,false,2 where (select count(*) from public.managed_sourcing_packages)=1;
insert into public.managed_sourcing_packages(name,description,monthly_price_egp,included_requests,included_vehicles_per_request,is_active,display_order)
select 'باقة الشركات المؤسسية','باقة شهرية مخصصة لطلبات الأساطيل الكبيرة. لا تعرض قبل تحديد السعر والحدود.',0,40,100,false,3 where (select count(*) from public.managed_sourcing_packages)=2;

alter table public.managed_sourcing_pricing enable row level security;
alter table public.managed_sourcing_packages enable row level security;
alter table public.managed_sourcing_requests enable row level security;
alter table public.managed_sourcing_offers enable row level security;
alter table public.managed_sourcing_actions enable row level security;
alter table public.managed_sourcing_updates enable row level security;
grant select,insert,update,delete on public.managed_sourcing_pricing,public.managed_sourcing_packages,public.managed_sourcing_requests,public.managed_sourcing_offers,public.managed_sourcing_actions,public.managed_sourcing_updates to authenticated;

drop policy if exists "managed sourcing pricing read authenticated" on public.managed_sourcing_pricing;
create policy "managed sourcing pricing read authenticated" on public.managed_sourcing_pricing for select to authenticated using(true);
drop policy if exists "managed sourcing pricing admin manage" on public.managed_sourcing_pricing;
create policy "managed sourcing pricing admin manage" on public.managed_sourcing_pricing for all to authenticated using(exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()))) with check(exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid())));
drop policy if exists "managed sourcing packages read authenticated" on public.managed_sourcing_packages;
create policy "managed sourcing packages read authenticated" on public.managed_sourcing_packages for select to authenticated using(true);
drop policy if exists "managed sourcing packages admin manage" on public.managed_sourcing_packages;
create policy "managed sourcing packages admin manage" on public.managed_sourcing_packages for all to authenticated using(exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()))) with check(exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid())));
drop policy if exists "managed sourcing requests read own or admin" on public.managed_sourcing_requests;
create policy "managed sourcing requests read own or admin" on public.managed_sourcing_requests for select to authenticated using(
 exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()))
 or exists(select 1 from public.organization_memberships m where m.organization_id=company_organization_id and m.user_id=(select auth.uid()))
);
drop policy if exists "managed sourcing requests create own company" on public.managed_sourcing_requests;
create policy "managed sourcing requests create own company" on public.managed_sourcing_requests for insert to authenticated with check(
 created_by=(select auth.uid()) and exists(select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id where m.organization_id=company_organization_id and m.user_id=(select auth.uid()) and o.organization_type='company')
);
drop policy if exists "managed sourcing requests admin update" on public.managed_sourcing_requests;
create policy "managed sourcing requests admin update" on public.managed_sourcing_requests for update to authenticated using(exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()))) with check(exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid())));
drop policy if exists "managed sourcing offers read own or admin" on public.managed_sourcing_offers;
create policy "managed sourcing offers read own or admin" on public.managed_sourcing_offers for select to authenticated using(
 exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()))
 or exists(select 1 from public.managed_sourcing_requests r join public.organization_memberships m on m.organization_id=r.company_organization_id where r.id=request_id and m.user_id=(select auth.uid()))
);
drop policy if exists "managed sourcing offers admin manage" on public.managed_sourcing_offers;
create policy "managed sourcing offers admin manage" on public.managed_sourcing_offers for all to authenticated using(exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()))) with check(exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid())));
drop policy if exists "managed sourcing actions read own or admin" on public.managed_sourcing_actions;
create policy "managed sourcing actions read own or admin" on public.managed_sourcing_actions for select to authenticated using(
 exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()))
 or exists(select 1 from public.managed_sourcing_requests r join public.organization_memberships m on m.organization_id=r.company_organization_id where r.id=request_id and m.user_id=(select auth.uid()))
);
drop policy if exists "managed sourcing actions create own" on public.managed_sourcing_actions;
create policy "managed sourcing actions create own" on public.managed_sourcing_actions for insert to authenticated with check(
 created_by=(select auth.uid()) and exists(select 1 from public.managed_sourcing_requests r join public.organization_memberships m on m.organization_id=r.company_organization_id where r.id=request_id and m.user_id=(select auth.uid()))
);
drop policy if exists "managed sourcing actions admin delete" on public.managed_sourcing_actions;
create policy "managed sourcing actions admin delete" on public.managed_sourcing_actions for delete to authenticated using(exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid())));
drop policy if exists "managed sourcing updates read own public or admin" on public.managed_sourcing_updates;
create policy "managed sourcing updates read own public or admin" on public.managed_sourcing_updates for select to authenticated using(
 exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()))
 or (visibility='company' and exists(select 1 from public.managed_sourcing_requests r join public.organization_memberships m on m.organization_id=r.company_organization_id where r.id=request_id and m.user_id=(select auth.uid())))
);
drop policy if exists "managed sourcing updates admin manage" on public.managed_sourcing_updates;
create policy "managed sourcing updates admin manage" on public.managed_sourcing_updates for all to authenticated using(exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()))) with check(exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid())));

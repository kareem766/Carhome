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
-- The deployed apply_discount_code_to_payment, sync_discount_redemption_status and preview_discount_code
-- functions calculate prices from canonical plan/settings rows, enforce limits, and keep payment status
-- separate from discount application. Keep their definitions synchronized with the live project.
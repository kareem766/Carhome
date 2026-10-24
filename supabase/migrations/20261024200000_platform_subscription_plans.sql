create table if not exists public.platform_subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,100}$'),
  description text not null default '' check (char_length(description) <= 1000),
  monthly_price numeric(12,2) not null default 0 check (monthly_price >= 0),
  yearly_price numeric(12,2) not null default 0 check (yearly_price >= 0),
  currency text not null default 'EGP' check (currency ~ '^[A-Z]{3}$'),
  trial_days integer not null default 0 check (trial_days between 0 and 365),
  features jsonb not null default '[]'::jsonb check (jsonb_typeof(features) = 'array'),
  limits jsonb not null default '{}'::jsonb check (jsonb_typeof(limits) = 'object'),
  display_order integer not null default 0,
  is_active boolean not null default true,
  is_popular boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists platform_subscription_plans_public_order_idx
  on public.platform_subscription_plans (is_active, display_order, created_at);

alter table public.platform_subscription_plans enable row level security;

drop policy if exists "active subscription plans are publicly readable" on public.platform_subscription_plans;
create policy "active subscription plans are publicly readable"
on public.platform_subscription_plans for select to anon, authenticated
using (is_active = true or exists (
  select 1 from public.platform_admins a where a.user_id = (select auth.uid())
));

drop policy if exists "platform admins insert subscription plans" on public.platform_subscription_plans;
create policy "platform admins insert subscription plans"
on public.platform_subscription_plans for insert to authenticated
with check (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())));

drop policy if exists "platform admins update subscription plans" on public.platform_subscription_plans;
create policy "platform admins update subscription plans"
on public.platform_subscription_plans for update to authenticated
using (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())));

drop policy if exists "platform admins delete subscription plans" on public.platform_subscription_plans;
create policy "platform admins delete subscription plans"
on public.platform_subscription_plans for delete to authenticated
using (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())));

grant select on public.platform_subscription_plans to anon, authenticated;
grant insert, update, delete on public.platform_subscription_plans to authenticated;

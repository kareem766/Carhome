create table if not exists public.company_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  plan_id uuid references public.platform_subscription_plans(id) on delete set null,
  plan_name text not null,
  billing_cycle text not null check (billing_cycle in ('monthly','yearly')),
  amount_egp numeric(12,2) not null check (amount_egp >= 0),
  status text not null default 'pending' check (status in ('pending','active','expired','cancelled')),
  payment_status text not null default 'pending' check (payment_status in ('pending','submitted','verified','rejected','waived')),
  payment_reference text,
  starts_at timestamptz,
  ends_at timestamptz,
  admin_notes text,
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_subscriptions_active_dates check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index if not exists company_subscriptions_org_created_idx on public.company_subscriptions(organization_id, created_at desc);
create index if not exists company_subscriptions_status_idx on public.company_subscriptions(status, payment_status);
alter table public.company_subscriptions enable row level security;
drop policy if exists "platform admins manage company subscriptions" on public.company_subscriptions;
create policy "platform admins manage company subscriptions" on public.company_subscriptions for all to authenticated using (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()))) with check (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())));
drop policy if exists "organizations read own subscriptions" on public.company_subscriptions;
create policy "organizations read own subscriptions" on public.company_subscriptions for select to authenticated using (exists (select 1 from public.organizations o where o.id = company_subscriptions.organization_id and o.created_by = (select auth.uid())));

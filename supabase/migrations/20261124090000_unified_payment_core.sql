-- Unified payment core for My Car.
-- This migration is intentionally staged in GitHub first; it is not applied to production.
create table if not exists public.payment_gateways (
  id uuid primary key default gen_random_uuid(),
  provider_code text not null unique check (provider_code in ('paymob', 'fawry')),
  display_name text not null,
  is_enabled boolean not null default false,
  environment text not null default 'sandbox' check (environment in ('sandbox', 'production')),
  is_default boolean not null default false,
  priority integer not null default 100 check (priority >= 0),
  supported_payment_methods text[] not null default '{}',
  public_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_gateways_default_requires_enabled check (not is_default or is_enabled)
);

create unique index if not exists payment_gateways_one_default_idx
  on public.payment_gateways (is_default) where is_default = true;

insert into public.payment_gateways (provider_code, display_name, is_enabled, environment, is_default, priority)
values
  ('paymob', 'Paymob', false, 'sandbox', false, 10),
  ('fawry', 'Fawry', false, 'sandbox', false, 20)
on conflict (provider_code) do nothing;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  purpose text not null check (purpose in (
    'vehicle_registration',
    'vehicle_renewal',
    'company_subscription',
    'advertising',
    'featured_advertising',
    'managed_sourcing_request',
    'managed_sourcing_subscription',
    'independent_search',
    'other'
  )),
  entity_table text,
  entity_id uuid,
  provider_code text check (provider_code is null or provider_code in ('manual', 'paymob', 'fawry')),
  status text not null default 'created' check (status in (
    'created', 'pending', 'paid', 'failed', 'cancelled', 'expired',
    'review_required', 'partially_refunded', 'refunded'
  )),
  currency text not null default 'EGP' check (currency = 'EGP'),
  original_amount numeric(12,2) not null check (original_amount >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  credit_amount numeric(12,2) not null default 0 check (credit_amount >= 0),
  amount_due numeric(12,2) not null check (amount_due >= 0),
  discount_code text,
  idempotency_key text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  provider_reference text,
  checkout_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  refunded_amount numeric(12,2) not null default 0 check (refunded_amount >= 0),
  failure_code text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_amount_consistency check (discount_amount + credit_amount <= original_amount),
  constraint payments_due_consistency check (amount_due = original_amount - discount_amount - credit_amount),
  constraint payments_refund_not_overpaid check (refunded_amount <= amount_due),
  constraint payments_idempotency_per_user unique (created_by, idempotency_key)
);

create unique index if not exists payments_provider_reference_idx
  on public.payments (provider_code, provider_reference)
  where provider_reference is not null;
create index if not exists payments_created_by_created_at_idx
  on public.payments (created_by, created_at desc);
create index if not exists payments_status_created_at_idx
  on public.payments (status, created_at desc);
create index if not exists payments_entity_idx
  on public.payments (entity_table, entity_id)
  where entity_id is not null;

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  attempt_number integer not null check (attempt_number > 0),
  provider_code text not null check (provider_code in ('paymob', 'fawry')),
  status text not null default 'created' check (status in (
    'created', 'pending', 'succeeded', 'failed', 'cancelled', 'expired'
  )),
  provider_reference text,
  checkout_url text,
  request_key text not null,
  failure_code text,
  failure_message text,
  expires_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payment_id, attempt_number),
  unique (provider_code, request_key)
);

create index if not exists payment_attempts_payment_created_idx
  on public.payment_attempts (payment_id, created_at desc);
create unique index if not exists payment_attempts_provider_reference_idx
  on public.payment_attempts (provider_code, provider_reference)
  where provider_reference is not null;

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_code text not null check (provider_code in ('paymob', 'fawry')),
  provider_event_id text not null,
  event_type text not null,
  payload_sha256 text not null,
  processing_status text not null default 'received' check (processing_status in (
    'received', 'processed', 'ignored', 'failed'
  )),
  payment_id uuid references public.payments(id) on delete set null,
  processed_at timestamptz,
  error_code text,
  received_at timestamptz not null default now(),
  unique (provider_code, provider_event_id)
);

create index if not exists payment_webhook_events_status_received_idx
  on public.payment_webhook_events (processing_status, received_at);

alter table public.payment_gateways enable row level security;
alter table public.payments enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.payment_webhook_events enable row level security;

drop policy if exists "Platform admins can manage payment gateways" on public.payment_gateways;
create policy "Platform admins can manage payment gateways"
  on public.payment_gateways for all to authenticated
  using ((select public.support_is_platform_admin()))
  with check ((select public.support_is_platform_admin()));

drop policy if exists "Users can read their own payments" on public.payments;
create policy "Users can read their own payments"
  on public.payments for select to authenticated
  using (created_by = (select auth.uid()) or (select public.support_is_platform_admin()));

drop policy if exists "Platform admins can read payment attempts" on public.payment_attempts;
create policy "Platform admins can read payment attempts"
  on public.payment_attempts for select to authenticated
  using ((select public.support_is_platform_admin()));

drop policy if exists "Users can read attempts for their own payments" on public.payment_attempts;
create policy "Users can read attempts for their own payments"
  on public.payment_attempts for select to authenticated
  using (exists (
    select 1 from public.payments p
    where p.id = payment_attempts.payment_id
      and p.created_by = (select auth.uid())
  ));

drop policy if exists "Platform admins can read webhook events" on public.payment_webhook_events;
create policy "Platform admins can read webhook events"
  on public.payment_webhook_events for select to authenticated
  using ((select public.support_is_platform_admin()));

revoke all on public.payment_gateways from anon, authenticated;
revoke all on public.payments from anon, authenticated;
revoke all on public.payment_attempts from anon, authenticated;
revoke all on public.payment_webhook_events from anon, authenticated;

grant select, insert, update, delete on public.payment_gateways to authenticated;
grant select on public.payments to authenticated;
grant select on public.payment_attempts to authenticated;
grant select on public.payment_webhook_events to authenticated;

comment on table public.payment_gateways is
  'Non-secret gateway configuration. API keys and HMAC secrets must be stored only as Supabase Edge Function secrets.';
comment on table public.payments is
  'Canonical payment ledger. Legacy manual transfer records remain in their existing service tables during migration.';
comment on table public.payment_attempts is
  'Provider-specific checkout attempts; retries never create duplicate service entitlements.';
comment on table public.payment_webhook_events is
  'Webhook idempotency ledger. Stores a digest and processing metadata, not raw cardholder payloads.';


-- Admin controls for the online-payment master switch and per-service availability.
create table if not exists public.payment_platform_settings (
  id integer primary key check (id = 1),
  online_payments_enabled boolean not null default false,
  enabled_service_types text[] not null default array[
    'vehicle_registration',
    'company_subscription',
    'advertising',
    'featured_advertising',
    'managed_sourcing_request',
    'managed_sourcing_subscription'
  ]::text[],
  updated_at timestamptz not null default now()
);
insert into public.payment_platform_settings (id, online_payments_enabled)
values (1, false)
on conflict (id) do nothing;
alter table public.payment_platform_settings enable row level security;
drop policy if exists "Platform admins can manage payment platform settings" on public.payment_platform_settings;
create policy "Platform admins can manage payment platform settings"
  on public.payment_platform_settings for all to authenticated
  using ((select public.support_is_platform_admin()))
  with check ((select public.support_is_platform_admin()));
revoke all on public.payment_platform_settings from anon, authenticated;
grant select, update on public.payment_platform_settings to authenticated;
comment on table public.payment_platform_settings is
  'Admin-only master switch and per-service availability for online payments. Manual transfers are not controlled by this table.';

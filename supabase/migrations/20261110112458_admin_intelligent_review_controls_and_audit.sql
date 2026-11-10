-- Additive, non-destructive controls and audit history for the My Car admin review center.
-- Automatic approvals are explicitly constrained to remain disabled until trusted verification integrations exist.

create table if not exists public.admin_review_settings (
  category text primary key check (category in ('vehicle','account','payment','ad','service')),
  analysis_enabled boolean not null default true,
  auto_approval_enabled boolean not null default false,
  risk_threshold integer not null default 85 check (risk_threshold between 0 and 100),
  updated_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint admin_review_auto_approval_disabled check (auto_approval_enabled = false)
);

insert into public.admin_review_settings (category)
values ('vehicle'), ('account'), ('payment'), ('ad'), ('service')
on conflict (category) do nothing;

alter table public.admin_review_settings enable row level security;
grant select, update on public.admin_review_settings to authenticated;

drop policy if exists "Platform admins read intelligent review settings" on public.admin_review_settings;
create policy "Platform admins read intelligent review settings"
on public.admin_review_settings for select to authenticated
using (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())));

drop policy if exists "Platform admins update intelligent review settings" on public.admin_review_settings;
create policy "Platform admins update intelligent review settings"
on public.admin_review_settings for update to authenticated
using (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())));

create table if not exists public.admin_review_audit_log (
  id bigint generated always as identity primary key,
  entity_type text not null check (entity_type in ('vehicle','account','payment','advertisement','service_provider')),
  entity_id text not null,
  action text not null,
  actor_id uuid null references auth.users(id) on delete set null,
  previous_state jsonb not null default '{}'::jsonb,
  new_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_review_audit_log_entity_idx
  on public.admin_review_audit_log (entity_type, entity_id, created_at desc);
create index if not exists admin_review_audit_log_created_at_idx
  on public.admin_review_audit_log (created_at desc);

alter table public.admin_review_audit_log enable row level security;
grant select on public.admin_review_audit_log to authenticated;

drop policy if exists "Platform admins read intelligent review audit log" on public.admin_review_audit_log;
create policy "Platform admins read intelligent review audit log"
on public.admin_review_audit_log for select to authenticated
using (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())));

create or replace function public.mycar_log_review_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  old_row jsonb := to_jsonb(old);
  new_row jsonb := to_jsonb(new);
  old_state jsonb;
  new_state jsonb;
  target_type text;
begin
  old_state := jsonb_strip_nulls(jsonb_build_object(
    'review_status', old_row -> 'review_status',
    'approval_status', old_row -> 'approval_status',
    'status', old_row -> 'status',
    'payment_status', old_row -> 'payment_status'
  ));
  new_state := jsonb_strip_nulls(jsonb_build_object(
    'review_status', new_row -> 'review_status',
    'approval_status', new_row -> 'approval_status',
    'status', new_row -> 'status',
    'payment_status', new_row -> 'payment_status'
  ));

  if old_state is distinct from new_state then
    target_type := case tg_table_name
      when 'vehicles' then 'vehicle'
      when 'organizations' then 'account'
      when 'vehicle_payment_submissions' then 'payment'
      when 'vehicle_promotions' then 'advertisement'
      when 'service_provider_submissions' then 'service_provider'
      else tg_table_name
    end;

    insert into public.admin_review_audit_log (
      entity_type, entity_id, action, actor_id, previous_state, new_state
    ) values (
      target_type,
      coalesce(new_row ->> 'id', old_row ->> 'id'),
      'status_changed',
      auth.uid(),
      old_state,
      new_state
    );
  end if;

  return new;
end;
$$;

revoke all on function public.mycar_log_review_status_change() from public, anon, authenticated;

drop trigger if exists mycar_review_audit_vehicles on public.vehicles;
create trigger mycar_review_audit_vehicles
after update of review_status, payment_status on public.vehicles
for each row execute function public.mycar_log_review_status_change();

drop trigger if exists mycar_review_audit_organizations on public.organizations;
create trigger mycar_review_audit_organizations
after update of approval_status on public.organizations
for each row execute function public.mycar_log_review_status_change();

drop trigger if exists mycar_review_audit_payments on public.vehicle_payment_submissions;
create trigger mycar_review_audit_payments
after update of review_status on public.vehicle_payment_submissions
for each row execute function public.mycar_log_review_status_change();

drop trigger if exists mycar_review_audit_promotions on public.vehicle_promotions;
create trigger mycar_review_audit_promotions
after update of status, payment_status on public.vehicle_promotions
for each row execute function public.mycar_log_review_status_change();

drop trigger if exists mycar_review_audit_service_providers on public.service_provider_submissions;
create trigger mycar_review_audit_service_providers
after update of status on public.service_provider_submissions
for each row execute function public.mycar_log_review_status_change();

create or replace function public.mycar_log_review_setting_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.analysis_enabled is distinct from new.analysis_enabled
     or old.risk_threshold is distinct from new.risk_threshold then
    insert into public.admin_review_audit_log (
      entity_type, entity_id, action, actor_id, previous_state, new_state
    ) values (
      case new.category
        when 'vehicle' then 'vehicle'
        when 'account' then 'account'
        when 'payment' then 'payment'
        when 'ad' then 'advertisement'
        else 'service_provider'
      end,
      'settings:' || new.category,
      'review_settings_changed',
      auth.uid(),
      jsonb_build_object('analysis_enabled', old.analysis_enabled, 'risk_threshold', old.risk_threshold),
      jsonb_build_object('analysis_enabled', new.analysis_enabled, 'risk_threshold', new.risk_threshold)
    );
  end if;
  return new;
end;
$$;

revoke all on function public.mycar_log_review_setting_change() from public, anon, authenticated;

drop trigger if exists mycar_review_settings_audit on public.admin_review_settings;
create trigger mycar_review_settings_audit
after update on public.admin_review_settings
for each row execute function public.mycar_log_review_setting_change();

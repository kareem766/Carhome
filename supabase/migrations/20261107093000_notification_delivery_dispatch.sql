-- Reserve a notification type for marketing messages so external channels can honor opt-outs.
alter table public.platform_notifications
  drop constraint if exists platform_notifications_notification_type_check;

alter table public.platform_notifications
  add constraint platform_notifications_notification_type_check
  check (notification_type = any (array[
    'general'::text,
    'account'::text,
    'vehicle'::text,
    'payment'::text,
    'request'::text,
    'message'::text,
    'subscription'::text,
    'promotion'::text,
    'system'::text,
    'managed_sourcing_request'::text,
    'managed_sourcing_update'::text,
    'admin_broadcast'::text,
    'marketing'::text
  ]));

-- Durable delivery queue for all existing in-app notification events.
-- Push and email are dispatched asynchronously by a protected Edge Function.
create extension if not exists pg_net;

create table if not exists public.notification_delivery_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique references public.platform_notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'transactional' check (category in ('transactional','marketing')),
  title text not null,
  body text not null default '',
  action_url text,
  push_status text not null default 'pending' check (push_status in ('pending','sent','skipped','failed')),
  email_status text not null default 'pending' check (email_status in ('pending','sent','skipped','failed')),
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notification_delivery_outbox_ready_idx
  on public.notification_delivery_outbox(status, available_at, created_at);

alter table public.notification_delivery_outbox enable row level security;
revoke all on public.notification_delivery_outbox from public, anon, authenticated;
grant all on public.notification_delivery_outbox to service_role;

create or replace function public.enqueue_notification_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_delivery_outbox (
    notification_id, user_id, category, title, body, action_url
  ) values (
    new.id,
    new.user_id,
    case when new.notification_type = 'marketing' then 'marketing' else 'transactional' end,
    new.title,
    coalesce(new.body, ''),
    new.action_url
  )
  on conflict (notification_id) do nothing;
  return new;
end;
$$;

revoke all on function public.enqueue_notification_delivery() from public, anon, authenticated;
drop trigger if exists platform_notifications_enqueue_delivery on public.platform_notifications;
create trigger platform_notifications_enqueue_delivery
after insert on public.platform_notifications
for each row execute function public.enqueue_notification_delivery();

-- The Edge Function claims batches with SKIP LOCKED to avoid parallel duplicate workers.
create or replace function public.claim_notification_delivery_batch(p_limit integer default 25)
returns setof public.notification_delivery_outbox
language sql
security definer
set search_path = ''
as $$
  with candidates as (
    select q.id
    from public.notification_delivery_outbox q
    where q.attempts < 8
      and (
        (q.status = 'pending' and q.available_at <= now())
        or (q.status = 'processing' and q.locked_at < now() - interval '5 minutes')
      )
    order by q.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  )
  update public.notification_delivery_outbox q
  set status = 'processing',
      attempts = q.attempts + 1,
      locked_at = now(),
      updated_at = now()
  from candidates c
  where q.id = c.id
  returning q.*;
$$;

revoke all on function public.claim_notification_delivery_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_delivery_batch(integer) to service_role;

-- Separate admin RPC allows the dashboard to distinguish operational and marketing broadcasts.
create or replace function public.admin_broadcast_notifications_with_category(
  p_title text,
  p_body text,
  p_audience text default 'all',
  p_category text default 'transactional'
)
returns integer
language plpgsql
set search_path = ''
as $
declare
  v_count integer := 0;
begin
  if auth.uid() is null or not exists (
    select 1 from public.platform_admins pa where pa.user_id = auth.uid()
  ) then
    raise exception 'not authorized';
  end if;
  if nullif(btrim(p_title), '') is null or length(p_title) > 120 then
    raise exception 'invalid notification title';
  end if;
  if nullif(btrim(p_body), '') is null or length(p_body) > 1000 then
    raise exception 'invalid notification body';
  end if;
  if p_audience not in ('all','company','individual_owner','fleet_supplier') then
    raise exception 'invalid audience';
  end if;
  if p_category not in ('transactional','marketing') then
    raise exception 'invalid notification category';
  end if;

  insert into public.platform_notifications (user_id, title, body, notification_type, created_by)
  select distinct om.user_id, btrim(p_title), btrim(p_body),
    case when p_category = 'marketing' then 'marketing' else 'admin_broadcast' end,
    auth.uid()
  from public.organization_memberships om
  join public.organizations o on o.id = om.organization_id
  where (p_audience = 'all' or o.organization_type::text = p_audience)
    and om.user_id is not null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.admin_broadcast_notifications_with_category(text,text,text,text) from public, anon;
grant execute on function public.admin_broadcast_notifications_with_category(text,text,text,text) to authenticated;

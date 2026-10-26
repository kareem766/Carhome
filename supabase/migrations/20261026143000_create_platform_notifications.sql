create table if not exists public.platform_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null default '',
  notification_type text not null default 'general' check (notification_type in ('general','account','vehicle','payment','request','message','subscription','promotion','system')),
  action_url text,
  read_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.platform_notifications enable row level security;

drop policy if exists "Users read own notifications" on public.platform_notifications;
create policy "Users read own notifications"
on public.platform_notifications for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Users update own notifications" on public.platform_notifications;
create policy "Users update own notifications"
on public.platform_notifications for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Platform admins manage notifications" on public.platform_notifications;
create policy "Platform admins manage notifications"
on public.platform_notifications for all to authenticated
using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()))
with check (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));

create index if not exists platform_notifications_user_created_idx on public.platform_notifications (user_id, created_at desc);
create index if not exists platform_notifications_user_unread_idx on public.platform_notifications (user_id, read_at) where read_at is null;

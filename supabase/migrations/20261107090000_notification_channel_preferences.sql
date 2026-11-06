-- Notification channel preferences and browser push subscriptions.
-- All three channels are enabled by default; users can disable each independently.
create table if not exists public.platform_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  push_enabled boolean not null default true,
  email_enabled boolean not null default true,
  marketing_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.platform_notification_preferences enable row level security;

create policy "Users can read their notification preferences"
  on public.platform_notification_preferences for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their notification preferences"
  on public.platform_notification_preferences for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their notification preferences"
  on public.platform_notification_preferences for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.platform_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists platform_push_subscriptions_user_id_idx
  on public.platform_push_subscriptions(user_id);

alter table public.platform_push_subscriptions enable row level security;

create policy "Users can read their own push subscriptions"
  on public.platform_push_subscriptions for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can register their own push subscriptions"
  on public.platform_push_subscriptions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own push subscriptions"
  on public.platform_push_subscriptions for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can remove their own push subscriptions"
  on public.platform_push_subscriptions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.set_notification_preferences_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger platform_notification_preferences_updated_at
before update on public.platform_notification_preferences
for each row execute function public.set_notification_preferences_updated_at();

create trigger platform_push_subscriptions_updated_at
before update on public.platform_push_subscriptions
for each row execute function public.set_notification_preferences_updated_at();

revoke all on public.platform_notification_preferences from anon;
revoke all on public.platform_push_subscriptions from anon;
grant select, insert, update on public.platform_notification_preferences to authenticated;
grant select, insert, update, delete on public.platform_push_subscriptions to authenticated;

insert into public.platform_notification_preferences (user_id, push_enabled, email_enabled, marketing_enabled)
select id, true, true, true from auth.users
on conflict (user_id) do nothing;

create or replace function public.create_default_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.platform_notification_preferences (user_id, push_enabled, email_enabled, marketing_enabled)
  values (new.id, true, true, true)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_default_notification_preferences() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_notification_preferences on auth.users;
create trigger on_auth_user_created_notification_preferences
after insert on auth.users
for each row execute function public.create_default_notification_preferences();

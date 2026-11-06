-- Phase 4: immutable legal consent audit trail for account registration.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.legal_consent_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  terms_version text not null check (char_length(terms_version) between 1 and 40),
  privacy_version text not null check (char_length(privacy_version) between 1 and 40),
  accepted_at timestamptz not null,
  capture_source text not null default 'signup'
    check (capture_source in ('signup', 'google_oauth', 'backfill')),
  recorded_at timestamptz not null default now(),
  unique (user_id, terms_version, privacy_version)
);

comment on table public.legal_consent_audit is
  'Append-only audit of the terms and privacy document versions accepted during account registration.';

alter table public.legal_consent_audit enable row level security;
revoke all on public.legal_consent_audit from anon, public;
grant select on public.legal_consent_audit to authenticated;

drop policy if exists "Platform admins can view legal consent audit" on public.legal_consent_audit;
create policy "Platform admins can view legal consent audit"
on public.legal_consent_audit
for select
to authenticated
using (
  exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = (select auth.uid())
  )
);

create or replace function private.capture_legal_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acceptance jsonb;
  v_terms text;
  v_privacy text;
  v_accepted_at timestamptz;
  v_source text;
begin
  v_acceptance := coalesce(new.raw_user_meta_data -> 'legal_acceptance', '{}'::jsonb);
  v_terms := nullif(btrim(v_acceptance ->> 'terms_version'), '');
  v_privacy := nullif(btrim(v_acceptance ->> 'privacy_version'), '');

  if v_terms is null or v_privacy is null then
    return new;
  end if;

  v_accepted_at := new.created_at;
  begin
    if nullif(v_acceptance ->> 'accepted_at', '') is not null then
      v_accepted_at := (v_acceptance ->> 'accepted_at')::timestamptz;
    end if;
  exception when others then
    v_accepted_at := new.created_at;
  end;

  v_source := case
    when new.raw_app_meta_data ->> 'provider' = 'google' then 'google_oauth'
    else 'signup'
  end;

  insert into public.legal_consent_audit (
    user_id, terms_version, privacy_version, accepted_at, capture_source
  )
  values (new.id, v_terms, v_privacy, coalesce(v_accepted_at, now()), v_source)
  on conflict (user_id, terms_version, privacy_version) do nothing;

  return new;
end;
$$;

revoke all on function private.capture_legal_consent() from public, anon, authenticated;

drop trigger if exists capture_legal_consent_on_auth_user on auth.users;
create trigger capture_legal_consent_on_auth_user
after insert or update of raw_user_meta_data on auth.users
for each row
execute function private.capture_legal_consent();

-- Preserve consent metadata already recorded on existing accounts.
insert into public.legal_consent_audit (
  user_id, terms_version, privacy_version, accepted_at, capture_source
)
select
  u.id,
  nullif(btrim(u.raw_user_meta_data #>> '{legal_acceptance,terms_version}'), ''),
  nullif(btrim(u.raw_user_meta_data #>> '{legal_acceptance,privacy_version}'), ''),
  case
    when coalesce(u.raw_user_meta_data #>> '{legal_acceptance,accepted_at}', '') ~
      '^\\d{4}-\\d{2}-\\d{2}T'
    then (u.raw_user_meta_data #>> '{legal_acceptance,accepted_at}')::timestamptz
    else u.created_at
  end,
  'backfill'
from auth.users u
where nullif(btrim(u.raw_user_meta_data #>> '{legal_acceptance,terms_version}'), '') is not null
  and nullif(btrim(u.raw_user_meta_data #>> '{legal_acceptance,privacy_version}'), '') is not null
on conflict (user_id, terms_version, privacy_version) do nothing;

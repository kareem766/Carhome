create table if not exists public.rental_offer_history (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null,
  request_id uuid not null,
  organization_id uuid not null,
  event_type text not null check (event_type in ('edited','withdrawn','deleted')),
  offer_snapshot jsonb not null,
  occurred_at timestamptz not null default now()
);

create index if not exists rental_offer_history_request_idx
  on public.rental_offer_history (request_id, occurred_at desc);

alter table public.rental_offer_history enable row level security;
grant select on public.rental_offer_history to authenticated;

drop policy if exists "Offer participants can read accepted offer history" on public.rental_offer_history;
create policy "Offer participants can read accepted offer history"
on public.rental_offer_history
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_memberships m
    where m.user_id = (select auth.uid())
      and (
        m.organization_id = rental_offer_history.organization_id
        or exists (
          select 1
          from public.rental_requests r
          where r.id = rental_offer_history.request_id
            and r.organization_id = m.organization_id
        )
      )
  )
  or exists (
    select 1 from public.platform_admins pa
    where pa.user_id = (select auth.uid())
  )
);

create or replace function public.capture_accepted_rental_offer_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  captured_event text;
begin
  if old.status = 'accepted' then
    if tg_op = 'DELETE' then
      captured_event := 'deleted';
    elsif old.status is distinct from new.status then
      captured_event := 'withdrawn';
    elsif old.monthly_price_egp is distinct from new.monthly_price_egp
       or old.yearly_price_egp is distinct from new.yearly_price_egp
       or old.vehicle_count is distinct from new.vehicle_count
       or old.message is distinct from new.message
       or old.organization_id is distinct from new.organization_id
       or old.request_id is distinct from new.request_id then
      captured_event := 'edited';
    else
      return new;
    end if;

    insert into public.rental_offer_history
      (offer_id, request_id, organization_id, event_type, offer_snapshot, occurred_at)
    values
      (old.id, old.request_id, old.organization_id, captured_event, to_jsonb(old), now());
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.capture_accepted_rental_offer_history() from public, anon, authenticated;
drop trigger if exists capture_accepted_rental_offer_history on public.rental_offers;
create trigger capture_accepted_rental_offer_history
before update or delete on public.rental_offers
for each row execute function public.capture_accepted_rental_offer_history();

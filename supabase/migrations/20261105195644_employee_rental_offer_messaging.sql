-- Employee/provider private chat for a specific monthly-with-driver offer.
-- The employee and the user who submitted the provider offer are the only participants.

create table public.employee_rental_offer_messages (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.employee_rental_offers(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index employee_rental_offer_messages_offer_created_idx
  on public.employee_rental_offer_messages (offer_id, created_at);

alter table public.employee_rental_offer_messages enable row level security;

revoke all on table public.employee_rental_offer_messages from anon, authenticated;
grant select, insert on table public.employee_rental_offer_messages to authenticated;

create policy "employee offer participants read messages"
on public.employee_rental_offer_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.employee_rental_offers o
    where o.id = employee_rental_offer_messages.offer_id
      and (
        o.created_by = (select auth.uid())
        or exists (
          select 1
          from public.employee_rental_requests r
          where r.id = o.request_id
            and r.employee_user_id = (select auth.uid())
        )
        or exists (
          select 1 from public.platform_admins a
          where a.user_id = (select auth.uid())
        )
      )
  )
);

create policy "employee offer participants send messages"
on public.employee_rental_offer_messages
for insert
to authenticated
with check (
  sender_user_id = (select auth.uid())
  and exists (
    select 1
    from public.employee_rental_offers o
    where o.id = employee_rental_offer_messages.offer_id
      and o.status in ('submitted', 'accepted')
      and (
        o.created_by = (select auth.uid())
        or exists (
          select 1
          from public.employee_rental_requests r
          where r.id = o.request_id
            and r.employee_user_id = (select auth.uid())
        )
      )
  )
);

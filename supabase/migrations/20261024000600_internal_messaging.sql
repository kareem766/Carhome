-- Internal messaging for company/provider conversations; no phone numbers are exposed.
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.rental_requests(id) on delete cascade,
  company_organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (company_organization_id <> provider_organization_id),
  unique (request_id, company_organization_id, provider_organization_id)
);
alter table public.conversations enable row level security;
create policy "conversation participants can read conversations"
  on public.conversations for select to authenticated
  using (exists (select 1 from public.organization_memberships m where m.user_id = auth.uid() and m.organization_id in (conversations.company_organization_id, conversations.provider_organization_id)));
create policy "company members can start conversations with offer providers"
  on public.conversations for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id where m.user_id=auth.uid() and m.organization_id=conversations.company_organization_id and o.organization_type='company')
    and exists (select 1 from public.organizations o where o.id=conversations.provider_organization_id and o.organization_type in ('individual_owner','fleet_supplier'))
    and status = 'open'
    and exists (select 1 from public.rental_requests r where r.id=conversations.request_id and r.organization_id=conversations.company_organization_id)
    and exists (select 1 from public.rental_offers o where o.request_id=conversations.request_id and o.organization_id=conversations.provider_organization_id)
  );
create policy "conversation participants can update status"
  on public.conversations for update to authenticated
  using (exists (select 1 from public.organization_memberships m where m.user_id=auth.uid() and m.organization_id in (conversations.company_organization_id, conversations.provider_organization_id)))
  with check (exists (select 1 from public.organization_memberships m where m.user_id=auth.uid() and m.organization_id in (conversations.company_organization_id, conversations.provider_organization_id)));

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_organization_id uuid not null references public.organizations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
alter table public.messages enable row level security;
create policy "conversation participants can read messages"
  on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c join public.organization_memberships m on m.organization_id in (c.company_organization_id,c.provider_organization_id) where c.id=messages.conversation_id and m.user_id=auth.uid()));
create policy "conversation participants can send messages"
  on public.messages for insert to authenticated
  with check (
    sender_id=auth.uid()
    and exists (select 1 from public.conversations c join public.organization_memberships m on m.organization_id=messages.sender_organization_id and m.user_id=auth.uid() where c.id=messages.conversation_id and messages.sender_organization_id in (c.company_organization_id,c.provider_organization_id) and c.status='open')
  );
create policy "members can see related organization names"
  on public.organizations for select to authenticated
  using (
    exists (select 1 from public.organization_memberships m where m.organization_id = organizations.id and m.user_id = auth.uid())
    or exists (
      select 1 from public.rental_offers o
      join public.rental_requests r on r.id = o.request_id
      join public.organization_memberships m on m.organization_id = r.organization_id
      where o.organization_id = organizations.id and m.user_id = auth.uid()
    )
    or exists (
      select 1 from public.conversations c
      join public.organization_memberships m on m.organization_id in (c.company_organization_id,c.provider_organization_id)
      where organizations.id in (c.company_organization_id,c.provider_organization_id) and m.user_id = auth.uid()
    )
  );

create index if not exists conversations_company_idx on public.conversations(company_organization_id,updated_at desc);
create index if not exists conversations_provider_idx on public.conversations(provider_organization_id,updated_at desc);
create index if not exists messages_conversation_idx on public.messages(conversation_id,created_at);

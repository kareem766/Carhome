create table if not exists public.public_support_requests (
  id uuid primary key default gen_random_uuid(),
  request_code text not null unique,
  contact_name text not null,
  contact_email text not null,
  account_email text not null,
  phone text,
  subject text not null default 'طلب مراجعة إيقاف الحساب',
  message text not null,
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists public_support_requests_created_at_idx
  on public.public_support_requests (created_at desc);
create index if not exists public_support_requests_contact_email_created_idx
  on public.public_support_requests (lower(contact_email), created_at desc);

alter table public.public_support_requests enable row level security;

drop policy if exists "platform admins can view public support requests" on public.public_support_requests;
create policy "platform admins can view public support requests"
  on public.public_support_requests for select to authenticated
  using (public.support_is_platform_admin());

drop policy if exists "platform admins can update public support requests" on public.public_support_requests;
create policy "platform admins can update public support requests"
  on public.public_support_requests for update to authenticated
  using (public.support_is_platform_admin())
  with check (public.support_is_platform_admin());

revoke all on public.public_support_requests from anon, authenticated;
grant select, update on public.public_support_requests to authenticated;

-- Manual transfer tracking and explicit platform-admin review access.
-- Admins are provisioned manually by a trusted operator; no client insert policy exists.
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
create policy "platform admins can read admin roster"
  on public.platform_admins for select to authenticated
  using (user_id = auth.uid());

create table if not exists public.vehicle_payment_submissions (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  amount_egp numeric(12,2) not null default 300 check (amount_egp > 0),
  period_months integer not null default 1 check (period_months between 1 and 24),
  check (amount_egp = 300 * period_months),
  transfer_method text not null check (transfer_method in ('instapay','vodafone_cash','bank_transfer')),
  transfer_reference text not null check (char_length(btrim(transfer_reference)) between 3 and 160),
  proof_path text check (proof_path is null or char_length(proof_path) <= 500),
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  admin_notes text check (admin_notes is null or char_length(admin_notes) <= 1000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.vehicle_payment_submissions enable row level security;
create policy "vehicle owners can submit transfer references"
  on public.vehicle_payment_submissions for insert to authenticated
  with check (
    submitted_by = auth.uid()
    and exists (select 1 from public.vehicles v join public.organization_memberships m on m.organization_id = v.organization_id where v.id = vehicle_payment_submissions.vehicle_id and v.organization_id = vehicle_payment_submissions.organization_id and m.user_id = auth.uid() and v.created_by = auth.uid())
    and review_status = 'pending' and reviewed_by is null and reviewed_at is null
  );
create policy "submitters and admins can read payment submissions"
  on public.vehicle_payment_submissions for select to authenticated
  using (
    submitted_by = auth.uid()
    or exists (select 1 from public.platform_admins a where a.user_id = auth.uid())
  );
create policy "platform admins can review transfer submissions"
  on public.vehicle_payment_submissions for update to authenticated
  using (exists (select 1 from public.platform_admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.platform_admins a where a.user_id = auth.uid()));

create policy "platform admins can read organizations"
  on public.organizations for select to authenticated
  using (exists (select 1 from public.platform_admins a where a.user_id = auth.uid()));

create policy "platform admins can manage vehicles"
  on public.vehicles for all to authenticated
  using (exists (select 1 from public.platform_admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.platform_admins a where a.user_id = auth.uid()));

create or replace function public.prevent_client_vehicle_admin_field_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and not exists (select 1 from public.platform_admins a where a.user_id = auth.uid())
     and (new.review_status is distinct from old.review_status or new.payment_status is distinct from old.payment_status) then
    raise exception 'Only platform administrators can change vehicle review or payment status';
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_client_vehicle_admin_field_changes() from public;
create trigger vehicles_protect_admin_fields
before update on public.vehicles
for each row execute function public.prevent_client_vehicle_admin_field_changes();

create index if not exists vehicle_payment_submissions_status_idx on public.vehicle_payment_submissions(review_status, created_at);
create index if not exists vehicle_payment_submissions_vehicle_idx on public.vehicle_payment_submissions(vehicle_id, created_at desc);

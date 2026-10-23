-- Carhome vehicle registration and company rental requests.
-- Reviewed migration only: do not apply to shared/production without explicit approval.
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  make text not null check (char_length(btrim(make)) between 1 and 80),
  model text not null check (char_length(btrim(model)) between 1 and 100),
  model_year integer not null check (model_year between 1990 and 2100),
  vehicle_type text not null check (char_length(btrim(vehicle_type)) between 1 and 80),
  transmission text not null check (transmission in ('automatic','manual')),
  seats integer not null check (seats between 2 and 60),
  governorate text not null check (char_length(btrim(governorate)) between 1 and 80),
  address text not null check (char_length(btrim(address)) between 1 and 300),
  monthly_price_egp numeric(12,2) not null check (monthly_price_egp >= 0),
  yearly_price_egp numeric(12,2) check (yearly_price_egp is null or yearly_price_egp >= 0),
  with_driver boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 2000),
  review_status text not null default 'pending_review' check (review_status in ('pending_review','approved','rejected','paused')),
  payment_status text not null default 'pending' check (payment_status in ('pending','submitted','verified','waived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.vehicles enable row level security;
create policy "vehicle owners can read their organization vehicles"
  on public.vehicles for select to authenticated
  using (exists (select 1 from public.organization_memberships m where m.organization_id = vehicles.organization_id and m.user_id = auth.uid()));
create policy "vehicle owners can insert their own organization vehicles"
  on public.vehicles for insert to authenticated
  with check (created_by = auth.uid() and exists (select 1 from public.organization_memberships m join public.organizations o on o.id = m.organization_id where m.organization_id = vehicles.organization_id and m.user_id = auth.uid() and o.organization_type in ('individual_owner','fleet_supplier') and vehicles.review_status = 'pending_review' and vehicles.payment_status = 'pending'));
create policy "vehicle owners can update their pending vehicles"
  on public.vehicles for update to authenticated
  using (created_by = auth.uid() and review_status in ('pending_review','rejected') and exists (select 1 from public.organization_memberships m where m.organization_id = vehicles.organization_id and m.user_id = auth.uid()))
  with check (created_by = auth.uid() and review_status in ('pending_review','rejected') and exists (select 1 from public.organization_memberships m where m.organization_id = vehicles.organization_id and m.user_id = auth.uid()));
create policy "companies can view approved vehicles"
  on public.vehicles for select to authenticated
  using (review_status = 'approved' and exists (select 1 from public.organization_memberships m join public.organizations o on o.id = m.organization_id where m.user_id = auth.uid() and o.organization_type = 'company' and rental_requests.status = 'open'));

create table if not exists public.rental_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 140),
  vehicle_type text not null check (char_length(btrim(vehicle_type)) between 1 and 80),
  quantity integer not null check (quantity between 1 and 500),
  duration_type text not null check (duration_type in ('monthly','yearly')),
  duration_months integer not null check (duration_months between 1 and 60),
  governorate text not null check (char_length(btrim(governorate)) between 1 and 80),
  with_driver boolean not null default false,
  details text check (details is null or char_length(details) <= 3000),
  status text not null default 'open' check (status in ('open','reviewing','awarded','cancelled','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.rental_requests enable row level security;
create policy "company members can read their own rental requests"
  on public.rental_requests for select to authenticated
  using (exists (select 1 from public.organization_memberships m where m.organization_id = rental_requests.organization_id and m.user_id = auth.uid()));
create policy "company members can create rental requests"
  on public.rental_requests for insert to authenticated
  with check (created_by = auth.uid() and exists (select 1 from public.organization_memberships m join public.organizations o on o.id = m.organization_id where m.organization_id = rental_requests.organization_id and m.user_id = auth.uid() and o.organization_type = 'company'));
create policy "company members can update own requests"
  on public.rental_requests for update to authenticated
  using (created_by = auth.uid() and exists (select 1 from public.organization_memberships m where m.organization_id = rental_requests.organization_id and m.user_id = auth.uid()))
  with check (created_by = auth.uid() and exists (select 1 from public.organization_memberships m where m.organization_id = rental_requests.organization_id and m.user_id = auth.uid()));

create table if not exists public.rental_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.rental_requests(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  monthly_price_egp numeric(12,2) not null check (monthly_price_egp >= 0),
  yearly_price_egp numeric(12,2) check (yearly_price_egp is null or yearly_price_egp >= 0),
  vehicle_count integer not null default 1 check (vehicle_count between 1 and 500),
  message text check (message is null or char_length(message) <= 2000),
  status text not null default 'submitted' check (status in ('submitted','accepted','rejected','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, organization_id)
);
alter table public.rental_offers enable row level security;
create policy "request companies and offer suppliers can read offers"
  on public.rental_offers for select to authenticated
  using (
    exists (select 1 from public.organization_memberships m where m.organization_id = rental_offers.organization_id and m.user_id = auth.uid())
    or exists (select 1 from public.rental_requests r join public.organization_memberships m on m.organization_id = r.organization_id where r.id = rental_offers.request_id and m.user_id = auth.uid())
  );
create policy "fleet suppliers can offer on open requests"
  on public.rental_offers for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (select 1 from public.organization_memberships m join public.organizations o on o.id = m.organization_id where m.organization_id = rental_offers.organization_id and m.user_id = auth.uid() and o.organization_type in ('individual_owner','fleet_supplier'))
    and rental_offers.status = 'submitted'\n    and exists (select 1 from public.rental_requests r where r.id = rental_offers.request_id and r.status = 'open')
  );
create policy "offer creators can update their offers"
  on public.rental_offers for update to authenticated
  using (created_by = auth.uid() and exists (select 1 from public.organization_memberships m where m.organization_id = rental_offers.organization_id and m.user_id = auth.uid()))
  with check (created_by = auth.uid() and exists (select 1 from public.organization_memberships m where m.organization_id = rental_offers.organization_id and m.user_id = auth.uid()));

create index if not exists vehicles_review_status_idx on public.vehicles(review_status, governorate);
create index if not exists vehicles_org_idx on public.vehicles(organization_id);
create index if not exists rental_requests_status_idx on public.rental_requests(status, governorate);
create index if not exists rental_offers_request_idx on public.rental_offers(request_id);

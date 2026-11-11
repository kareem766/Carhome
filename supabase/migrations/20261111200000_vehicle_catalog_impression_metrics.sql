-- Privacy-preserving catalog impression metrics for individual vehicle owners.
-- One event per viewing organization, vehicle, and UTC day. No IP or user identifiers are stored.
create table if not exists public.vehicle_catalog_impressions (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  viewer_organization_id uuid not null references public.organizations(id) on delete cascade,
  viewed_on date not null default (timezone('utc', now()))::date,
  viewed_at timestamptz not null default now(),
  constraint vehicle_catalog_impressions_daily_unique unique (vehicle_id, viewer_organization_id, viewed_on)
);
create index if not exists vehicle_catalog_impressions_vehicle_day_idx
  on public.vehicle_catalog_impressions (vehicle_id, viewed_on desc);
alter table public.vehicle_catalog_impressions enable row level security;
revoke all on public.vehicle_catalog_impressions from anon, authenticated;

create or replace function public.record_vehicle_catalog_impressions(p_vehicle_ids uuid[])
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org_id uuid;
begin
  select om.organization_id into v_org_id
  from public.organization_memberships om
  join public.organizations o on o.id = om.organization_id
  where om.user_id = auth.uid()
    and o.organization_type in ('company', 'fleet_supplier')
    and o.approval_status = 'approved'
  limit 1;
  if v_org_id is null or coalesce(array_length(p_vehicle_ids, 1), 0) = 0 then return; end if;
  insert into public.vehicle_catalog_impressions (vehicle_id, viewer_organization_id)
  select distinct v.id, v_org_id
  from unnest(p_vehicle_ids) requested(id)
  join public.vehicles v on v.id = requested.id
  where v.organization_id <> v_org_id
    and v.review_status = 'approved'
    and v.payment_status in ('verified', 'waived')
    and v.registration_expires_at is not null
    and v.registration_expires_at > now()
    and (v.license_expiry_date is null or v.license_expiry_date >= current_date)
  on conflict (vehicle_id, viewer_organization_id, viewed_on) do nothing;
end; $$;

create or replace function public.get_owner_vehicle_catalog_metrics(p_vehicle_ids uuid[])
returns table (vehicle_id uuid, impressions bigint, unique_viewers bigint, impressions_30d bigint)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_owner_org_id uuid;
begin
  select om.organization_id into v_owner_org_id
  from public.organization_memberships om
  join public.organizations o on o.id = om.organization_id
  where om.user_id = auth.uid() and o.organization_type = 'individual_owner'
  limit 1;
  if v_owner_org_id is null then raise exception 'Owner access required' using errcode = '42501'; end if;
  return query
  select v.id, count(i.id)::bigint, count(distinct i.viewer_organization_id)::bigint,
         count(i.id) filter (where i.viewed_on >= (timezone('utc', now()))::date - 29)::bigint
  from public.vehicles v
  left join public.vehicle_catalog_impressions i on i.vehicle_id = v.id
  where v.organization_id = v_owner_org_id
    and (p_vehicle_ids is null or v.id = any(p_vehicle_ids))
  group by v.id;
end; $$;
revoke all on function public.record_vehicle_catalog_impressions(uuid[]) from public, anon;
revoke all on function public.get_owner_vehicle_catalog_metrics(uuid[]) from public, anon;
grant execute on function public.record_vehicle_catalog_impressions(uuid[]) to authenticated;
grant execute on function public.get_owner_vehicle_catalog_metrics(uuid[]) to authenticated;

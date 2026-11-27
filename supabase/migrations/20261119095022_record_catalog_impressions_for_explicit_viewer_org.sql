create or replace function public.record_vehicle_catalog_impressions(
  p_vehicle_ids uuid[],
  p_viewer_organization_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if auth.uid() is null or p_viewer_organization_id is null then
    raise exception 'Authenticated organization context required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.organization_memberships om
    join public.organizations o on o.id = om.organization_id
    where om.user_id = auth.uid()
      and om.organization_id = p_viewer_organization_id
      and o.organization_type in ('company', 'fleet_supplier')
      and o.approval_status = 'approved'
  ) then
    raise exception 'Approved company or fleet membership required' using errcode = '42501';
  end if;

  if coalesce(array_length(p_vehicle_ids, 1), 0) = 0 then
    return;
  end if;

  insert into public.vehicle_catalog_impressions (vehicle_id, viewer_organization_id)
  select distinct v.id, p_viewer_organization_id
  from unnest(p_vehicle_ids) requested(id)
  join public.vehicles v on v.id = requested.id
  where v.organization_id <> p_viewer_organization_id
    and v.review_status = 'approved'
    and v.payment_status in ('verified', 'waived')
    and v.registration_expires_at is not null
    and v.registration_expires_at > now()
    and (v.license_expiry_date is null or v.license_expiry_date >= current_date)
  on conflict (vehicle_id, viewer_organization_id, viewed_on) do nothing;
end;
$function$;

revoke all on function public.record_vehicle_catalog_impressions(uuid[], uuid) from public, anon;
grant execute on function public.record_vehicle_catalog_impressions(uuid[], uuid) to authenticated;

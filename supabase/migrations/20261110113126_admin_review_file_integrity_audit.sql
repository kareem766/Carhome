create or replace function public.mycar_admin_get_review_file_audit()
returns table (
  entity_type text,
  entity_id text,
  file_path text,
  file_exists boolean,
  content_type text,
  file_size_bytes bigint
)
language plpgsql
stable
security definer
set search_path = public, storage, pg_temp
as $$
begin
  if not exists (
    select 1 from public.platform_admins a
    where a.user_id = (select auth.uid())
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    'vehicle'::text,
    vi.vehicle_id::text,
    vi.storage_path,
    (o.id is not null),
    coalesce(o.metadata ->> 'mimetype', ''),
    case when coalesce(o.metadata ->> 'size', '') ~ '^[0-9]+$'
      then (o.metadata ->> 'size')::bigint else null end
  from public.vehicle_images vi
  left join storage.objects o
    on o.bucket_id = 'vehicle-images' and o.name = vi.storage_path

  union all

  select
    'payment'::text,
    p.id::text,
    p.proof_path,
    (o.id is not null),
    coalesce(o.metadata ->> 'mimetype', ''),
    case when coalesce(o.metadata ->> 'size', '') ~ '^[0-9]+$'
      then (o.metadata ->> 'size')::bigint else null end
  from public.vehicle_payment_submissions p
  left join storage.objects o
    on o.bucket_id = 'payment-proofs' and o.name = p.proof_path
  where p.proof_path is not null and btrim(p.proof_path) <> '';
end;
$$;

revoke all on function public.mycar_admin_get_review_file_audit() from public, anon;
grant execute on function public.mycar_admin_get_review_file_audit() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'];

drop policy if exists "vehicle owners upload payment proofs" on storage.objects;
create policy "vehicle owners upload payment proofs"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'payment-proofs'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1 from public.vehicles v
    join public.organization_memberships m on m.organization_id = v.organization_id
    where v.id::text = (storage.foldername(name))[2]
      and v.organization_id::text = (storage.foldername(name))[1]
      and v.created_by = (select auth.uid())
      and m.user_id = (select auth.uid())
  )
);

drop policy if exists "owners and platform admins read payment proofs" on storage.objects;
create policy "owners and platform admins read payment proofs"
on storage.objects for select to authenticated
using (
  bucket_id = 'payment-proofs'
  and (
    exists (
      select 1 from public.vehicle_payment_submissions p
      where p.proof_path = name
        and p.submitted_by = (select auth.uid())
    )
    or exists (
      select 1 from public.platform_admins a
      where a.user_id = (select auth.uid())
    )
  )
);
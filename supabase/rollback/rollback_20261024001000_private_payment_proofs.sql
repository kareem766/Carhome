drop policy if exists "owners and platform admins read payment proofs" on storage.objects;
drop policy if exists "vehicle owners upload payment proofs" on storage.objects;
delete from storage.buckets where id = 'payment-proofs';
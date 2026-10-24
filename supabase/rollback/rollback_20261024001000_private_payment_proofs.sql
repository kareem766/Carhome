drop policy if exists "owners and platform admins read payment proofs" on storage.objects;
drop policy if exists "vehicle owners upload payment proofs" on storage.objects;
-- Keep the private bucket and stored receipts intact during rollback to avoid data loss.
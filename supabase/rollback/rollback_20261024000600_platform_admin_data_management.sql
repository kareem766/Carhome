-- Remove only the platform-admin policies introduced by 20261024000600.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles',
    'organizations',
    'organization_memberships',
    'rental_requests',
    'rental_offers',
    'conversations',
    'messages',
    'vehicle_images',
    'vehicle_payment_submissions'
  ]
  loop
    execute format('drop policy if exists "platform admins manage all rows" on public.%I', t);
  end loop;
end
$$;

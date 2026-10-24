-- Allow only registered platform administrators to manage platform business data.
-- The platform_admins roster itself is intentionally excluded to prevent self-promotion.
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
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "platform admins manage all rows" on public.%I', t);
    execute format(
      'create policy "platform admins manage all rows" on public.%I for all to authenticated using (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()))) with check (exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())))',
      t
    );
  end loop;
end
$$;

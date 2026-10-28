
-- Add indexes to foreign keys used by managed sourcing request, subscription and offer lookups.
create index if not exists managed_sourcing_requests_created_by_idx on public.managed_sourcing_requests(created_by);
create index if not exists managed_sourcing_requests_package_idx on public.managed_sourcing_requests(package_id);
create index if not exists managed_sourcing_requests_subscription_idx on public.managed_sourcing_requests(subscription_id);
create index if not exists managed_sourcing_requests_assigned_to_idx on public.managed_sourcing_requests(assigned_to);
create index if not exists managed_sourcing_offers_vehicle_idx on public.managed_sourcing_offers(vehicle_id);
create index if not exists managed_sourcing_offers_supplier_idx on public.managed_sourcing_offers(supplier_organization_id);
create index if not exists managed_sourcing_offers_created_by_idx on public.managed_sourcing_offers(created_by);
create index if not exists managed_sourcing_actions_offer_idx on public.managed_sourcing_actions(offer_id);
create index if not exists managed_sourcing_actions_created_by_idx on public.managed_sourcing_actions(created_by);
create index if not exists managed_sourcing_updates_created_by_idx on public.managed_sourcing_updates(created_by);
create index if not exists managed_sourcing_subscriptions_created_by_idx on public.managed_sourcing_subscriptions(created_by);
create index if not exists managed_sourcing_subscriptions_package_idx on public.managed_sourcing_subscriptions(package_id);
create index if not exists managed_sourcing_internal_notes_created_by_idx on public.managed_sourcing_internal_notes(created_by);

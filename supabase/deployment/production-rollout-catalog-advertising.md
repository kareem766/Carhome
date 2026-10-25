# Carhome catalog and advertising rollout

## Scope
- Vehicle catalog for approved vehicles.
- Direct company-to-provider conversations linked to a vehicle.
- Configurable advertising plans and vehicle promotion requests.

## Deployment order
1. Apply `20261024213000_catalog_direct_chat_advertising.sql` to the production Supabase project.
2. Verify `conversations.vehicle_id`, `advertising_plans`, and `vehicle_promotions` exist and RLS is enabled for the two new tables.
3. Deploy the latest `feat/carhome-customer-experience` commit to Vercel Production.
4. Verify the production deployment reaches `READY` and the production alias points to that deployment.
5. Smoke-test catalog visibility, starting a direct conversation, and the admin advertising-plan workflow.

## Rollback
Use `supabase/rollback/rollback_20261024213000_catalog_direct_chat_advertising.sql` only if rollback is necessary. It deliberately deletes direct-to-vehicle conversations created by this migration before restoring `conversations.request_id` to NOT NULL. Back up/review those records before running rollback.

## Payment behavior
Advertising requests remain pending until an administrator reviews the request and manually verifies payment. This rollout does not automate payment collection.
# Carhome catalog and advertising rollout

## Scope
- Vehicle catalog for approved vehicles.
- Direct company-to-provider conversations linked to a vehicle.
- Configurable advertising plans and vehicle promotion requests.

## Production database status
Verified on 2026-10-25 against the production Supabase project:
- `public.advertising_plans` exists.
- `public.vehicle_promotions` exists.
- `conversations.request_id` is nullable.
- `conversations_vehicle_participants_unique_idx` exists.
- Supabase migration history includes `catalog_direct_chat_advertising` (version `20261025055159`).
The migration was already applied in Production, so it was not re-applied.

## Deployment order
1. Confirm the production schema and migration history (completed as above).
2. Deploy the latest `feat/carhome-customer-experience` commit to Vercel Production.
3. Verify the production deployment reaches `READY` and the production alias points to that deployment.
4. Smoke-test catalog visibility, starting a direct conversation, and the admin advertising-plan workflow.

## Rollback
Use `supabase/rollback/rollback_20261024213000_catalog_direct_chat_advertising.sql` only if rollback is necessary. It deliberately deletes direct-to-vehicle conversations created by this migration before restoring `conversations.request_id` to NOT NULL. Back up/review those records before running rollback.

## Payment behavior
Advertising requests remain pending until an administrator reviews the request and manually verifies payment. This rollout does not automate payment collection.

-- Rollback for 20261024000500_vehicle_payment_review.sql
drop trigger if exists vehicles_protect_admin_fields on public.vehicles;
drop function if exists public.prevent_client_vehicle_admin_field_changes();
drop policy if exists "platform admins can manage vehicles" on public.vehicles;
drop policy if exists "platform admins can read organizations" on public.organizations;
drop table if exists public.vehicle_payment_submissions;
drop table if exists public.platform_admins;

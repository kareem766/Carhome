-- Rollback for 20261025000100_vehicle_gps_availability.sql
-- WARNING: this removes GPS availability data collected after deployment.
ALTER TABLE public.vehicles
  DROP COLUMN IF EXISTS has_gps;

-- Rollback for 20261025000200_gps_legacy_unknown.sql
UPDATE public.vehicles SET has_gps = false WHERE has_gps IS NULL;
ALTER TABLE public.vehicles ALTER COLUMN has_gps SET DEFAULT false;
ALTER TABLE public.vehicles ALTER COLUMN has_gps SET NOT NULL;
COMMENT ON COLUMN public.vehicles.has_gps IS
  'Whether the vehicle is equipped with a GPS tracking device, as declared during registration.';

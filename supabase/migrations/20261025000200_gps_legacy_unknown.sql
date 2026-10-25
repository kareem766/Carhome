-- Existing listings predate the GPS question, so their status must remain unknown.
ALTER TABLE public.vehicles ALTER COLUMN has_gps DROP DEFAULT;
ALTER TABLE public.vehicles ALTER COLUMN has_gps DROP NOT NULL;
UPDATE public.vehicles SET has_gps = NULL WHERE created_at < TIMESTAMPTZ '2026-10-25 09:22:54+00';
COMMENT ON COLUMN public.vehicles.has_gps IS
  'Whether the vehicle has GPS. NULL means the vehicle was registered before GPS status was collected.';

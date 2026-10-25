-- Add a structured GPS availability field to vehicle listings.
-- Safe for existing records: defaults to false and does not change RLS.
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS has_gps boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.vehicles.has_gps IS
  'Whether the vehicle is equipped with a GPS tracking device, as declared during registration.';

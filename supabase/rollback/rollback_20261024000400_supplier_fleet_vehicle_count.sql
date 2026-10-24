ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_fleet_vehicle_count_nonnegative;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS fleet_vehicle_count;

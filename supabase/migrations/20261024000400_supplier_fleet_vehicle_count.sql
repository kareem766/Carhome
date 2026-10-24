ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS fleet_vehicle_count integer;
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_fleet_vehicle_count_nonnegative;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_fleet_vehicle_count_nonnegative CHECK (fleet_vehicle_count IS NULL OR fleet_vehicle_count >= 0);

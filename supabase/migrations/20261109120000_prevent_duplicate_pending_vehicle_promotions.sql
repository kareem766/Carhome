-- Prevent duplicate in-review advertisement requests for the same vehicle.
-- Existing pending rows were checked before adding this constraint.
create unique index if not exists vehicle_promotions_one_pending_per_vehicle_uidx
  on public.vehicle_promotions (vehicle_id)
  where status = 'pending_review';

CREATE INDEX IF NOT EXISTS company_vehicle_alerts_created_by_idx ON public.company_vehicle_alerts(created_by);
CREATE INDEX IF NOT EXISTS company_vehicle_alert_matches_vehicle_id_idx ON public.company_vehicle_alert_matches(vehicle_id);

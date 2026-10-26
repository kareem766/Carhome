alter table public.platform_settings
  add column if not exists owner_vehicle_monthly_fee_egp integer not null default 300
  check (owner_vehicle_monthly_fee_egp > 0);

alter table public.platform_settings
  add column if not exists supplier_vehicle_registration_fee_egp integer not null default 150
  check (supplier_vehicle_registration_fee_egp > 0);

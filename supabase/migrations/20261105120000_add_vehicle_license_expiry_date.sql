alter table public.vehicles
  add column if not exists license_expiry_date date;

comment on column public.vehicles.license_expiry_date is
  'Vehicle license expiration date entered during vehicle registration.';

-- Expand the existing promotional carousel audience list for the unified banner center.
-- Existing rows and their current audience targeting remain unchanged.
alter table public.platform_promo_slides
  drop constraint if exists platform_promo_slides_audience_roles_check;

alter table public.platform_promo_slides
  add constraint platform_promo_slides_audience_roles_check
  check (
    cardinality(audience_roles) > 0
    and audience_roles <@ array[
      'individual_owner',
      'fleet_supplier',
      'employee',
      'company',
      'company_employee'
    ]::text[]
  );

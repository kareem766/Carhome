-- Extend promotional slide audiences to company accounts without changing existing slides.
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

alter table public.platform_promo_slides
  alter column audience_roles
  set default array[
    'individual_owner',
    'fleet_supplier',
    'employee',
    'company',
    'company_employee'
  ]::text[];

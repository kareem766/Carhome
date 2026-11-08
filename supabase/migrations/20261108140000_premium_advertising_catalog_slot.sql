-- Distinguish standard catalog promotions from the dedicated premium advertising slot.
ALTER TABLE public.advertising_plans
  ADD COLUMN IF NOT EXISTS placement_type text NOT NULL DEFAULT 'standard';

ALTER TABLE public.advertising_plans
  DROP CONSTRAINT IF EXISTS advertising_plans_placement_type_check;

ALTER TABLE public.advertising_plans
  ADD CONSTRAINT advertising_plans_placement_type_check
  CHECK (placement_type IN ('standard', 'premium'));

CREATE OR REPLACE FUNCTION private.can_view_catalog_vehicle(
  target_vehicle_id uuid,
  target_organization_id uuid DEFAULT NULL::uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.vehicles v
      JOIN public.organizations provider ON provider.id = v.organization_id
     WHERE v.id = target_vehicle_id
       AND (target_organization_id IS NULL OR v.organization_id = target_organization_id)
       AND v.review_status = 'approved'
       AND v.payment_status IN ('verified', 'waived')
       AND v.registration_expires_at IS NOT NULL
       AND v.registration_expires_at > now()
       AND (v.license_expiry_date IS NULL OR v.license_expiry_date >= current_date)
       AND provider.approval_status = 'approved'
       AND provider.organization_type IN (
         'individual_owner'::public.organization_type,
         'fleet_supplier'::public.organization_type
       )
       AND EXISTS (
         SELECT 1
           FROM public.organization_memberships viewer
           JOIN public.organizations viewer_org ON viewer_org.id = viewer.organization_id
          WHERE viewer.user_id = (SELECT auth.uid())
            AND viewer_org.organization_type IN (
              'company'::public.organization_type,
              'fleet_supplier'::public.organization_type,
              'individual_owner'::public.organization_type
            )
            AND viewer_org.approval_status = 'approved'
       )
  );
$function$;

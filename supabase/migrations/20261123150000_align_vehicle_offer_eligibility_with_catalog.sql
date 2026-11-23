-- Keep offer/request eligibility consistent with the catalog visibility helper.
-- The catalog requires a present, unexpired registration date for every provider type.
-- Previously, the RLS policies allowed NULL registration_expires_at for owners and
-- fleet suppliers, which could make a vehicle eligible for offers while invisible in catalog.

DROP POLICY IF EXISTS "approved providers submit offers for open employee requests"
  ON public.employee_rental_offers;

CREATE POLICY "approved providers submit offers for open employee requests"
ON public.employee_rental_offers
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND status = 'submitted'
  AND driver_included = true
  AND EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    JOIN public.organizations o ON o.id = m.organization_id
    JOIN public.vehicles v ON v.organization_id = o.id
    JOIN public.employee_rental_requests r ON r.id = employee_rental_offers.request_id
    WHERE m.user_id = (SELECT auth.uid())
      AND m.organization_id = employee_rental_offers.organization_id
      AND v.id = employee_rental_offers.vehicle_id
      AND o.organization_type IN (
        'individual_owner'::public.organization_type,
        'fleet_supplier'::public.organization_type
      )
      AND o.approval_status = 'approved'
      AND v.review_status = 'approved'
      AND v.with_driver = true
      AND v.payment_status IN ('verified', 'waived')
      AND (v.license_expiry_date IS NULL OR v.license_expiry_date >= CURRENT_DATE)
      AND v.registration_expires_at IS NOT NULL
      AND v.registration_expires_at > now()
      AND (
        r.vehicle_type = 'أخرى'
        OR lower(btrim(v.vehicle_type)) = lower(btrim(r.vehicle_type))
        OR (r.vehicle_type = 'فان / ميكروباص' AND v.vehicle_type IN ('فان', 'ميكروباص'))
      )
      AND v.seats >= r.seats
      AND v.governorate = r.governorate
      AND r.status = 'open'
  )
);

DROP POLICY IF EXISTS "approved providers with eligible vehicles can offer on open req"
  ON public.rental_offers;

CREATE POLICY "approved providers with eligible vehicles can offer on open req"
ON public.rental_offers
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND status = 'submitted'
  AND EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    JOIN public.organizations o ON o.id = m.organization_id
    JOIN public.rental_requests r ON r.id = rental_offers.request_id
    WHERE m.organization_id = rental_offers.organization_id
      AND m.user_id = (SELECT auth.uid())
      AND o.organization_type IN (
        'individual_owner'::public.organization_type,
        'fleet_supplier'::public.organization_type
      )
      AND o.approval_status = 'approved'
      AND r.status = 'open'
      AND (
        SELECT count(*)
        FROM public.vehicles v
        WHERE v.organization_id = o.id
          AND v.review_status = 'approved'
          AND v.payment_status IN ('verified', 'waived')
          AND (v.license_expiry_date IS NULL OR v.license_expiry_date >= CURRENT_DATE)
          AND v.registration_expires_at IS NOT NULL
          AND v.registration_expires_at > now()
          AND v.governorate = r.governorate
          AND (
            r.vehicle_type = 'أخرى'
            OR lower(btrim(v.vehicle_type)) = lower(btrim(r.vehicle_type))
            OR (r.vehicle_type = 'فان / ميكروباص' AND v.vehicle_type IN ('فان', 'ميكروباص'))
            OR (r.vehicle_type = 'نقل' AND v.vehicle_type LIKE 'نقل%')
          )
          AND (NOT r.with_driver OR v.with_driver = true)
      ) >= rental_offers.vehicle_count
  )
);

DROP POLICY IF EXISTS "eligible providers can view matching open rental requests"
  ON public.rental_requests;

CREATE POLICY "eligible providers can view matching open rental requests"
ON public.rental_requests
FOR SELECT
TO authenticated
USING (
  status = 'open'
  AND EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    JOIN public.organizations o ON o.id = m.organization_id
    JOIN public.vehicles v ON v.organization_id = m.organization_id
    WHERE m.user_id = (SELECT auth.uid())
      AND o.organization_type IN (
        'individual_owner'::public.organization_type,
        'fleet_supplier'::public.organization_type
      )
      AND o.approval_status = 'approved'
      AND v.review_status = 'approved'
      AND v.payment_status IN ('verified', 'waived')
      AND (v.license_expiry_date IS NULL OR v.license_expiry_date >= CURRENT_DATE)
      AND v.registration_expires_at IS NOT NULL
      AND v.registration_expires_at > now()
      AND v.governorate = rental_requests.governorate
      AND (
        rental_requests.vehicle_type = 'أخرى'
        OR lower(btrim(v.vehicle_type)) = lower(btrim(rental_requests.vehicle_type))
        OR (rental_requests.vehicle_type = 'فان / ميكروباص' AND v.vehicle_type IN ('فان', 'ميكروباص'))
        OR (rental_requests.vehicle_type = 'نقل' AND v.vehicle_type LIKE 'نقل%')
      )
      AND (NOT rental_requests.with_driver OR v.with_driver = true)
  )
);

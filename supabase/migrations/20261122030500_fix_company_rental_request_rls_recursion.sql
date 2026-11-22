-- Avoid recursive RLS evaluation when a company creates a rental request.
-- Monthly quotas are enforced by the SECURITY DEFINER trigger
-- enforce_company_rental_request_quota(), which serializes submissions per company.
-- Keeping a self-query against rental_requests inside its own INSERT policy
-- re-enters the same policy and raises "infinite recursion detected in policy".

DROP POLICY IF EXISTS "company members can create rental requests" ON public.rental_requests;

CREATE POLICY "company members can create rental requests"
ON public.rental_requests
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND status = 'open'
  AND EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    JOIN public.organizations o ON o.id = m.organization_id
    WHERE m.organization_id = rental_requests.organization_id
      AND m.user_id = (SELECT auth.uid())
      AND o.organization_type = 'company'
      AND o.approval_status = 'approved'
  )
  AND (
    NOT COALESCE(
      (SELECT ps.company_subscription_required
       FROM public.platform_settings ps
       WHERE ps.id = true),
      false
    )
    OR public.company_subscription_is_current(organization_id)
  )
);

-- The quota trigger remains the single authoritative quota enforcement layer.
-- It applies the free-tier limit or the active paid-plan allowance atomically.

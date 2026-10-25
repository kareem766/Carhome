-- Allow an authenticated organization creator to read their own row before the
-- initial owner membership is created. This is required for INSERT ... RETURNING
-- and for the initial-owner membership policy's EXISTS check.
DROP POLICY IF EXISTS organizations_select_authorized ON public.organizations;

CREATE POLICY organizations_select_authorized
ON public.organizations
FOR SELECT
TO authenticated
USING (
  created_by = (SELECT auth.uid())
  OR private.can_view_organization(id)
);

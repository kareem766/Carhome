-- Restore the original organization SELECT policy.
DROP POLICY IF EXISTS organizations_select_authorized ON public.organizations;

CREATE POLICY organizations_select_authorized
ON public.organizations
FOR SELECT
TO authenticated
USING (private.can_view_organization(id));

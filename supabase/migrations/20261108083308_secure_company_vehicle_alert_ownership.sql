DROP POLICY IF EXISTS "company owners update plan vehicle alerts" ON public.company_vehicle_alerts;
CREATE POLICY "company owners update plan vehicle alerts"
ON public.company_vehicle_alerts FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    JOIN public.organizations o ON o.id = m.organization_id
    WHERE m.organization_id = company_vehicle_alerts.organization_id
      AND m.user_id = (SELECT auth.uid())
      AND m.role = 'owner'
      AND o.organization_type = 'company'
  )
  AND public.company_has_plan_feature(organization_id, 'smart_alerts')
)
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    JOIN public.organizations o ON o.id = m.organization_id
    WHERE m.organization_id = company_vehicle_alerts.organization_id
      AND m.user_id = (SELECT auth.uid())
      AND m.role = 'owner'
      AND o.organization_type = 'company'
  )
  AND public.company_has_plan_feature(organization_id, 'smart_alerts')
);

DROP POLICY IF EXISTS "company owners delete plan vehicle alerts" ON public.company_vehicle_alerts;
CREATE POLICY "company owners delete plan vehicle alerts"
ON public.company_vehicle_alerts FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    JOIN public.organizations o ON o.id = m.organization_id
    WHERE m.organization_id = company_vehicle_alerts.organization_id
      AND m.user_id = (SELECT auth.uid())
      AND m.role = 'owner'
      AND o.organization_type = 'company'
  )
);

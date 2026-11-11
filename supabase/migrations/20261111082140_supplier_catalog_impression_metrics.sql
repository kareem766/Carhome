-- Expose catalog impression aggregates to the owning fleet supplier only.
CREATE OR REPLACE FUNCTION public.get_supplier_vehicle_catalog_metrics(p_vehicle_ids uuid[])
RETURNS TABLE(vehicle_id uuid, impressions bigint, unique_viewers bigint, impressions_30d bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_supplier_org_id uuid;
BEGIN
  SELECT om.organization_id INTO v_supplier_org_id
  FROM public.organization_memberships om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.user_id = auth.uid()
    AND o.organization_type = 'fleet_supplier'::public.organization_type
    AND o.approval_status = 'approved'
  LIMIT 1;

  IF v_supplier_org_id IS NULL THEN
    RAISE EXCEPTION 'Approved fleet supplier access required' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT v.id,
         count(i.id)::bigint,
         count(DISTINCT i.viewer_organization_id)::bigint,
         count(i.id) FILTER (WHERE i.viewed_on >= (timezone('utc', now()))::date - 29)::bigint
  FROM public.vehicles v
  LEFT JOIN public.vehicle_catalog_impressions i ON i.vehicle_id = v.id
  WHERE v.organization_id = v_supplier_org_id
    AND (p_vehicle_ids IS NULL OR v.id = ANY(p_vehicle_ids))
  GROUP BY v.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_supplier_vehicle_catalog_metrics(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_supplier_vehicle_catalog_metrics(uuid[]) TO authenticated;

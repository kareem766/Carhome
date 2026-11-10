-- Owner vehicle self-service management with a review-safe update RPC.
-- Approved vehicle edits are returned to review before they can reappear in the catalog.
CREATE OR REPLACE FUNCTION public.owner_update_vehicle_details(p_vehicle_id uuid, p_updates jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_vehicle public.vehicles%ROWTYPE;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'object' THEN RAISE EXCEPTION 'Invalid vehicle update payload'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_updates) AS k(key)
    WHERE key NOT IN ('make','model','model_year','vehicle_type','governorate','address','transmission','seats','license_expiry_date','monthly_price_egp','yearly_price_egp','with_driver','has_gps','notes')
  ) THEN RAISE EXCEPTION 'Unsupported vehicle field'; END IF;

  SELECT v.* INTO v_vehicle
  FROM public.vehicles v
  JOIN public.organizations o ON o.id = v.organization_id
  JOIN public.organization_memberships m ON m.organization_id = o.id
  WHERE v.id = p_vehicle_id AND v.created_by = v_user_id AND m.user_id = v_user_id
    AND o.organization_type = 'individual_owner'::public.organization_type
  FOR UPDATE OF v;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vehicle not found or not owned by this account'; END IF;
  IF v_vehicle.review_status NOT IN ('approved','rejected','pending_review','pending_payment') THEN
    RAISE EXCEPTION 'This vehicle cannot be edited in its current state';
  END IF;

  UPDATE public.vehicles
  SET make = COALESCE(NULLIF(btrim(p_updates->>'make'), ''), make),
      model = COALESCE(NULLIF(btrim(p_updates->>'model'), ''), model),
      model_year = COALESCE(NULLIF(p_updates->>'model_year','')::integer, model_year),
      vehicle_type = COALESCE(NULLIF(btrim(p_updates->>'vehicle_type'), ''), vehicle_type),
      governorate = COALESCE(NULLIF(btrim(p_updates->>'governorate'), ''), governorate),
      address = COALESCE(NULLIF(btrim(p_updates->>'address'), ''), address),
      transmission = COALESCE(NULLIF(p_updates->>'transmission',''), transmission),
      seats = COALESCE(NULLIF(p_updates->>'seats','')::integer, seats),
      license_expiry_date = CASE WHEN p_updates ? 'license_expiry_date' THEN NULLIF(p_updates->>'license_expiry_date','')::date ELSE license_expiry_date END,
      monthly_price_egp = COALESCE(NULLIF(p_updates->>'monthly_price_egp','')::numeric, monthly_price_egp),
      yearly_price_egp = CASE WHEN p_updates ? 'yearly_price_egp' THEN NULLIF(p_updates->>'yearly_price_egp','')::numeric ELSE yearly_price_egp END,
      with_driver = COALESCE((p_updates->>'with_driver')::boolean, with_driver),
      has_gps = COALESCE((p_updates->>'has_gps')::boolean, has_gps),
      notes = CASE WHEN p_updates ? 'notes' THEN NULLIF(btrim(p_updates->>'notes'),'') ELSE notes END,
      review_status = CASE WHEN review_status IN ('approved','rejected') THEN 'pending_review' ELSE review_status END,
      updated_at = now()
  WHERE id = p_vehicle_id
  RETURNING * INTO v_vehicle;

  RETURN jsonb_build_object('id',v_vehicle.id,'review_status',v_vehicle.review_status,'payment_status',v_vehicle.payment_status);
END;
$function$;
REVOKE ALL ON FUNCTION public.owner_update_vehicle_details(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_update_vehicle_details(uuid,jsonb) TO authenticated;

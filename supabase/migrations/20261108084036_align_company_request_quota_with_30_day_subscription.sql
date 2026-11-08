CREATE OR REPLACE FUNCTION public.company_current_subscription_period(p_organization_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object('starts_at', s.starts_at, 'ends_at', s.ends_at)
  FROM public.company_subscriptions s
  JOIN public.platform_subscription_plans p ON p.id = s.plan_id AND p.is_active = true
  WHERE s.organization_id = p_organization_id
    AND s.status = 'active'
    AND s.payment_status IN ('verified','waived')
    AND s.starts_at <= now()
    AND s.ends_at > now()
    AND (
      EXISTS (SELECT 1 FROM public.platform_admins a WHERE a.user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.organization_memberships m
        WHERE m.organization_id = s.organization_id
          AND m.user_id = auth.uid()
      )
    )
  ORDER BY s.ends_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.company_current_subscription_period(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_current_subscription_period(uuid) TO authenticated;

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
    NOT COALESCE((SELECT ps.company_subscription_required FROM public.platform_settings ps WHERE ps.id = true), false)
    OR public.company_subscription_is_current(organization_id)
  )
  AND (
    NOT public.company_subscription_is_current(organization_id)
    OR COALESCE(
      NULLIF(public.company_current_plan_limits(organization_id)->>'monthly_requests', 'unlimited')::integer,
      2147483647
    ) > (
      SELECT count(*)::integer
      FROM public.rental_requests rr
      WHERE rr.organization_id = rental_requests.organization_id
        AND rr.created_at >= ((public.company_current_subscription_period(rental_requests.organization_id)->>'starts_at')::timestamptz)
        AND rr.created_at < ((public.company_current_subscription_period(rental_requests.organization_id)->>'ends_at')::timestamptz)
    )
  )
);

CREATE OR REPLACE FUNCTION public.company_reuse_rental_request(p_request_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request public.rental_requests%rowtype;
  v_limits jsonb;
  v_period jsonb;
  v_limit integer;
  v_count integer;
  v_new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'يجب تسجيل الدخول أولاً'; END IF;

  SELECT r.* INTO v_request
  FROM public.rental_requests r
  JOIN public.organization_memberships m ON m.organization_id = r.organization_id
  JOIN public.organizations o ON o.id = r.organization_id
  WHERE r.id = p_request_id
    AND m.user_id = auth.uid()
    AND o.organization_type = 'company'
    AND o.approval_status = 'approved'
  LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود أو لا تملك صلاحية الوصول إليه'; END IF;
  IF NOT public.company_has_plan_feature(v_request.organization_id, 'request_reuse') THEN
    RAISE EXCEPTION 'إعادة استخدام الطلبات متاحة ضمن الباقة الاحترافية وباقة المؤسسات فقط';
  END IF;

  v_limits := public.company_current_plan_limits(v_request.organization_id);
  v_period := public.company_current_subscription_period(v_request.organization_id);
  IF v_limits IS NULL OR v_limits = '{}'::jsonb OR v_period IS NULL THEN
    RAISE EXCEPTION 'يلزم وجود اشتراك سارٍ لاستخدام هذه الميزة';
  END IF;

  IF COALESCE(v_limits->>'monthly_requests','') <> 'unlimited' THEN
    v_limit := COALESCE(NULLIF(v_limits->>'monthly_requests','')::integer, 0);
    SELECT count(*)::integer INTO v_count
    FROM public.rental_requests r
    WHERE r.organization_id = v_request.organization_id
      AND r.created_at >= (v_period->>'starts_at')::timestamptz
      AND r.created_at < (v_period->>'ends_at')::timestamptz;
    IF v_count >= v_limit THEN
      RAISE EXCEPTION 'وصلت شركتك إلى الحد المسموح لطلبات التأجير خلال مدة اشتراكك الحالية';
    END IF;
  END IF;

  INSERT INTO public.rental_requests (
    organization_id, created_by, title, details, vehicle_type, quantity,
    duration_type, duration_months, governorate, with_driver, status
  ) VALUES (
    v_request.organization_id, auth.uid(), v_request.title, v_request.details,
    v_request.vehicle_type, v_request.quantity, v_request.duration_type,
    v_request.duration_months, v_request.governorate, v_request.with_driver, 'open'
  ) RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

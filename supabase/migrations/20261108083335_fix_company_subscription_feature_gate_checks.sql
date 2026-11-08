CREATE OR REPLACE FUNCTION public.company_reuse_rental_request(p_request_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request public.rental_requests%rowtype;
  v_limits jsonb;
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
  IF v_limits IS NULL OR v_limits = '{}'::jsonb THEN
    RAISE EXCEPTION 'يلزم وجود اشتراك سارٍ لاستخدام هذه الميزة';
  END IF;

  IF COALESCE(v_limits->>'monthly_requests','') <> 'unlimited' THEN
    v_limit := COALESCE(NULLIF(v_limits->>'monthly_requests','')::integer, 0);
    SELECT count(*)::integer INTO v_count
    FROM public.rental_requests r
    WHERE r.organization_id = v_request.organization_id
      AND r.created_at >= date_trunc('month', now())
      AND r.created_at < date_trunc('month', now()) + interval '1 month';
    IF v_count >= v_limit THEN
      RAISE EXCEPTION 'وصلت شركتك إلى الحد الشهري لطلبات التأجير في باقتك الحالية';
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

CREATE OR REPLACE FUNCTION public.notify_companies_for_matching_vehicle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_alert public.company_vehicle_alerts%rowtype;
  v_match_id uuid;
BEGIN
  IF NEW.review_status <> 'approved'
     OR NEW.payment_status NOT IN ('verified','waived')
     OR (NEW.license_expiry_date IS NOT NULL AND NEW.license_expiry_date < CURRENT_DATE)
     OR (NEW.registration_expires_at IS NOT NULL AND NEW.registration_expires_at <= now()) THEN
    RETURN NEW;
  END IF;

  FOR v_alert IN
    SELECT a.*
    FROM public.company_vehicle_alerts a
    WHERE a.is_active = true
      AND (a.governorate IS NULL OR lower(btrim(a.governorate)) = lower(btrim(NEW.governorate)))
      AND (a.vehicle_type IS NULL OR lower(btrim(a.vehicle_type)) = lower(btrim(NEW.vehicle_type)))
      AND (a.with_driver IS NULL OR a.with_driver = NEW.with_driver)
      AND EXISTS (
        SELECT 1
        FROM public.company_subscriptions s
        JOIN public.platform_subscription_plans p ON p.id = s.plan_id AND p.is_active = true
        WHERE s.organization_id = a.organization_id
          AND s.status = 'active'
          AND s.payment_status IN ('verified','waived')
          AND s.starts_at <= now()
          AND s.ends_at > now()
          AND p.limits->'smart_alerts' = 'true'::jsonb
      )
  LOOP
    INSERT INTO public.company_vehicle_alert_matches(alert_id, vehicle_id)
    VALUES (v_alert.id, NEW.id)
    ON CONFLICT (alert_id, vehicle_id) DO NOTHING
    RETURNING id INTO v_match_id;

    IF v_match_id IS NOT NULL THEN
      PERFORM public.notify_organization_members(
        v_alert.organization_id,
        'سيارة جديدة تطابق تنبيه شركتك',
        'تم اعتماد سيارة جديدة تطابق معايير البحث المحفوظة. افتح كتالوج السيارات لمراجعة التفاصيل.',
        'vehicle',
        '/workspace/catalog',
        NEW.created_by
      );
    END IF;
    v_match_id := NULL;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Company plan entitlements and subscription promo-code support.
CREATE OR REPLACE FUNCTION public.company_has_plan_feature(
  p_organization_id uuid,
  p_feature text
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limits jsonb;
BEGIN
  IF auth.uid() IS NULL OR p_organization_id IS NULL OR p_feature IS NULL THEN
    RETURN false;
  END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM public.platform_admins a WHERE a.user_id = auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      JOIN public.organizations o ON o.id = m.organization_id
      WHERE m.organization_id = p_organization_id
        AND m.user_id = auth.uid()
        AND o.organization_type = 'company'
    )
  ) THEN
    RETURN false;
  END IF;

  SELECT p.limits INTO v_limits
  FROM public.company_subscriptions s
  JOIN public.platform_subscription_plans p ON p.id = s.plan_id AND p.is_active = true
  WHERE s.organization_id = p_organization_id
    AND s.status = 'active'
    AND s.payment_status IN ('verified','waived')
    AND s.starts_at <= now()
    AND s.ends_at > now()
  ORDER BY s.ends_at DESC
  LIMIT 1;

  IF v_limits IS NULL THEN RETURN false; END IF;

  RETURN CASE p_feature
    WHEN 'advanced_reports' THEN COALESCE(v_limits->>'reports' = 'advanced', false)
    WHEN 'smart_alerts' THEN COALESCE(v_limits->'smart_alerts' = 'true'::jsonb, false)
    WHEN 'request_reuse' THEN COALESCE(v_limits->'request_reuse' = 'true'::jsonb, false)
    WHEN 'priority_support' THEN COALESCE(v_limits->>'support' = 'priority', false)
    ELSE COALESCE(v_limits->p_feature = 'true'::jsonb, false)
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.company_has_plan_feature(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_has_plan_feature(uuid,text) TO authenticated;

UPDATE public.platform_subscription_plans
SET limits = limits || '{"smart_alerts":false,"request_reuse":false}'::jsonb,
    updated_at = now()
WHERE slug = 'company-basic';

UPDATE public.platform_subscription_plans
SET limits = limits || '{"smart_alerts":true,"request_reuse":true}'::jsonb,
    updated_at = now()
WHERE slug IN ('company-professional','company-enterprise');

DROP POLICY IF EXISTS "companies can submit their own subscription requests" ON public.company_subscriptions;
CREATE POLICY "companies can submit their own subscription requests"
ON public.company_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND status = 'pending'
  AND payment_status = 'submitted'
  AND billing_cycle = 'monthly'
  AND starts_at IS NULL
  AND ends_at IS NULL
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
  AND payment_reference IS NOT NULL
  AND char_length(btrim(payment_reference)) BETWEEN 3 AND 100
  AND payment_transfer_date IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    JOIN public.organizations o ON o.id = m.organization_id
    WHERE m.organization_id = company_subscriptions.organization_id
      AND m.user_id = (SELECT auth.uid())
      AND m.role = 'owner'
      AND o.organization_type = 'company'
      AND o.approval_status = 'approved'
  )
  AND EXISTS (
    SELECT 1
    FROM public.platform_subscription_plans p
    WHERE p.id = company_subscriptions.plan_id
      AND p.is_active = true
      AND company_subscriptions.plan_name = p.name
      AND company_subscriptions.original_amount_egp = p.monthly_price
      AND company_subscriptions.amount_egp = company_subscriptions.final_amount_egp
      AND company_subscriptions.final_amount_egp = p.monthly_price - company_subscriptions.discount_amount_egp
      AND company_subscriptions.discount_amount_egp >= 0
      AND (
        (NULLIF(btrim(company_subscriptions.coupon_code), '') IS NULL AND company_subscriptions.discount_amount_egp = 0)
        OR
        (NULLIF(btrim(company_subscriptions.coupon_code), '') IS NOT NULL AND company_subscriptions.discount_amount_egp > 0)
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

REVOKE ALL ON FUNCTION public.company_reuse_rental_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_reuse_rental_request(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.company_vehicle_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  governorate text,
  vehicle_type text,
  with_driver boolean,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_vehicle_alerts_org_active_idx
  ON public.company_vehicle_alerts (organization_id, is_active);

CREATE TABLE IF NOT EXISTS public.company_vehicle_alert_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.company_vehicle_alerts(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  notified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alert_id, vehicle_id)
);

ALTER TABLE public.company_vehicle_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_vehicle_alert_matches ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_vehicle_alerts TO authenticated;
REVOKE ALL ON public.company_vehicle_alert_matches FROM anon, authenticated;

DROP POLICY IF EXISTS "company members read their vehicle alerts" ON public.company_vehicle_alerts;
CREATE POLICY "company members read their vehicle alerts"
ON public.company_vehicle_alerts FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_memberships m
    WHERE m.organization_id = company_vehicle_alerts.organization_id
      AND m.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "company owners manage plan vehicle alerts" ON public.company_vehicle_alerts;
CREATE POLICY "company owners manage plan vehicle alerts"
ON public.company_vehicle_alerts FOR INSERT TO authenticated
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.organization_memberships m
    JOIN public.organizations o ON o.id = m.organization_id
    WHERE m.organization_id = company_vehicle_alerts.organization_id
      AND m.user_id = (SELECT auth.uid())
      AND m.role = 'owner'
      AND o.organization_type = 'company'
  )
  AND public.company_has_plan_feature(organization_id, 'smart_alerts')
);

DROP POLICY IF EXISTS "company owners update plan vehicle alerts" ON public.company_vehicle_alerts;
CREATE POLICY "company owners update plan vehicle alerts"
ON public.company_vehicle_alerts FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_memberships m
    WHERE m.organization_id = company_vehicle_alerts.organization_id
      AND m.user_id = (SELECT auth.uid())
      AND m.role = 'owner'
  )
  AND public.company_has_plan_feature(organization_id, 'smart_alerts')
)
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND public.company_has_plan_feature(organization_id, 'smart_alerts')
);

DROP POLICY IF EXISTS "company owners delete plan vehicle alerts" ON public.company_vehicle_alerts;
CREATE POLICY "company owners delete plan vehicle alerts"
ON public.company_vehicle_alerts FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_memberships m
    WHERE m.organization_id = company_vehicle_alerts.organization_id
      AND m.user_id = (SELECT auth.uid())
      AND m.role = 'owner'
  )
  AND public.company_has_plan_feature(organization_id, 'smart_alerts')
);

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
      AND public.company_has_plan_feature(a.organization_id, 'smart_alerts')
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

REVOKE ALL ON FUNCTION public.notify_companies_for_matching_vehicle() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS company_vehicle_smart_alert_notification ON public.vehicles;
CREATE TRIGGER company_vehicle_smart_alert_notification
AFTER INSERT OR UPDATE OF review_status, payment_status ON public.vehicles
FOR EACH ROW
EXECUTE FUNCTION public.notify_companies_for_matching_vehicle();

-- Free company tier: 3 rental requests per Cairo calendar month and no team members.
-- Paid plans retain the allowances stored in platform_subscription_plans.limits.
-- Limits are enforced in PostgreSQL so direct Data API writes cannot bypass the UI.

CREATE OR REPLACE FUNCTION public.enforce_company_rental_request_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limits jsonb;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_limit integer;
  v_raw_limit text;
  v_count integer;
BEGIN
  IF NEW.organization_id IS NULL OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.platform_admins a
    WHERE a.user_id = auth.uid()
  ) THEN
    RETURN NEW;
  END IF;

  -- Serialize requests for one company to prevent concurrent submissions
  -- from exceeding the monthly allowance.
  PERFORM 1
  FROM public.organizations o
  WHERE o.id = NEW.organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الشركة المرتبطة بالطلب غير موجودة';
  END IF;

  SELECT p.limits, s.starts_at, s.ends_at
    INTO v_limits, v_starts_at, v_ends_at
  FROM public.company_subscriptions s
  JOIN public.platform_subscription_plans p
    ON p.id = s.plan_id AND p.is_active = true
  WHERE s.organization_id = NEW.organization_id
    AND s.status = 'active'
    AND s.payment_status IN ('verified', 'waived')
    AND s.starts_at <= now()
    AND s.ends_at > now()
  ORDER BY s.ends_at DESC
  LIMIT 1;

  IF v_limits IS NULL THEN
    -- Free tier: 3 requests per calendar month in Egypt time.
    v_limit := 3;
    v_starts_at := date_trunc('month', now() AT TIME ZONE 'Africa/Cairo')
                   AT TIME ZONE 'Africa/Cairo';
    v_ends_at := (date_trunc('month', now() AT TIME ZONE 'Africa/Cairo') + interval '1 month')
                 AT TIME ZONE 'Africa/Cairo';
  ELSE
    v_raw_limit := v_limits ->> 'monthly_requests';
    IF v_raw_limit = 'unlimited' THEN
      RETURN NEW;
    END IF;
    v_limit := COALESCE(NULLIF(v_raw_limit, '')::integer, 0);
  END IF;

  IF v_limit < 1 THEN
    RAISE EXCEPTION 'لا تسمح باقتك الحالية بإنشاء طلبات تأجير جديدة';
  END IF;

  SELECT count(*)::integer
    INTO v_count
  FROM public.rental_requests r
  WHERE r.organization_id = NEW.organization_id
    AND r.created_at >= v_starts_at
    AND r.created_at < v_ends_at
    AND (TG_OP = 'INSERT' OR r.id <> NEW.id);

  IF v_count >= v_limit THEN
    IF v_limits IS NULL THEN
      RAISE EXCEPTION 'وصلت شركتك إلى الحد المجاني (3 طلبات خلال الشهر الحالي). اشترك في إحدى باقات الشركات لمتابعة نشر الطلبات.';
    ELSE
      RAISE EXCEPTION 'وصلت شركتك إلى الحد المسموح لطلبات التأجير في باقتك الحالية';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rental_requests_enforce_company_quota ON public.rental_requests;
CREATE TRIGGER rental_requests_enforce_company_quota
BEFORE INSERT OR UPDATE OF organization_id, created_at
ON public.rental_requests
FOR EACH ROW
EXECUTE FUNCTION public.enforce_company_rental_request_quota();

CREATE OR REPLACE FUNCTION public.enforce_company_team_member_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limits jsonb;
  v_limit integer;
  v_raw_limit text;
  v_count integer;
  v_is_company boolean;
BEGIN
  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT (o.organization_type = 'company')
    INTO v_is_company
  FROM public.organizations o
  WHERE o.id = NEW.organization_id
  FOR UPDATE;

  IF NOT COALESCE(v_is_company, false) THEN
    RETURN NEW;
  END IF;

  -- Preserve an existing owner membership and allow the first owner row
  -- during company registration; never allow a second owner for the org.
  IF NEW.role = 'owner' THEN
    IF TG_OP = 'UPDATE' AND OLD.role = 'owner' THEN
      RETURN NEW;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.organization_memberships m
      WHERE m.organization_id = NEW.organization_id
        AND m.role = 'owner'
        AND m.user_id <> NEW.user_id
    ) THEN
      RAISE EXCEPTION 'يوجد مالك بالفعل لهذا الحساب';
    END IF;
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.platform_admins a
    WHERE a.user_id = auth.uid()
  ) THEN
    RETURN NEW;
  END IF;

  SELECT p.limits
    INTO v_limits
  FROM public.company_subscriptions s
  JOIN public.platform_subscription_plans p
    ON p.id = s.plan_id AND p.is_active = true
  WHERE s.organization_id = NEW.organization_id
    AND s.status = 'active'
    AND s.payment_status IN ('verified', 'waived')
    AND s.starts_at <= now()
    AND s.ends_at > now()
  ORDER BY s.ends_at DESC
  LIMIT 1;

  IF v_limits IS NULL THEN
    RAISE EXCEPTION 'إضافة أعضاء الفريق (مديرين أو موظفين) متاحة بعد تفعيل باقة مدفوعة. يمكنك الاشتراك من صفحة باقات الشركات.';
  END IF;

  v_raw_limit := v_limits ->> 'team_members';
  IF v_raw_limit = 'unlimited' THEN
    RETURN NEW;
  END IF;

  v_limit := COALESCE(NULLIF(v_raw_limit, '')::integer, 0);
  SELECT count(*)::integer
    INTO v_count
  FROM public.organization_memberships m
  WHERE m.organization_id = NEW.organization_id
    AND m.role <> 'owner'
    AND (TG_OP = 'INSERT' OR m.id <> NEW.id);

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'وصلت شركتك إلى الحد الأقصى لأعضاء الفريق في باقتك الحالية';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organization_memberships_enforce_company_quota ON public.organization_memberships;
CREATE TRIGGER organization_memberships_enforce_company_quota
BEFORE INSERT OR UPDATE OF organization_id, role
ON public.organization_memberships
FOR EACH ROW
EXECUTE FUNCTION public.enforce_company_team_member_quota();

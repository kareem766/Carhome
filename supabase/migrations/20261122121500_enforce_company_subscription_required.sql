-- Enforce the platform owner's company subscription requirement for new rental requests.
-- Existing free-tier quota behavior remains unchanged while the setting is false.
CREATE OR REPLACE FUNCTION app_private.enforce_company_subscription_required()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_required boolean := false;
BEGIN
  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.platform_admins a
    WHERE a.user_id = auth.uid()
  ) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(ps.company_subscription_required, false)
    INTO v_required
  FROM public.platform_settings ps
  WHERE ps.id = true;

  IF NOT v_required THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_subscriptions s
    WHERE s.organization_id = NEW.organization_id
      AND s.status = 'active'
      AND s.payment_status IN ('verified', 'waived')
      AND s.starts_at <= now()
      AND s.ends_at > now()
  ) THEN
    RAISE EXCEPTION 'تشترط المنصة وجود اشتراك شركة نشط ومعتمد قبل نشر طلبات تأجير جديدة. يمكنك مراجعة باقات الشركات وإتمام الاشتراك.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_private.enforce_company_subscription_required() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS rental_requests_require_company_subscription ON public.rental_requests;
CREATE TRIGGER rental_requests_require_company_subscription
BEFORE INSERT OR UPDATE OF organization_id
ON public.rental_requests
FOR EACH ROW
EXECUTE FUNCTION app_private.enforce_company_subscription_required();

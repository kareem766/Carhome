CREATE OR REPLACE FUNCTION public.enforce_company_priority_support()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_company boolean;
  v_has_priority boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    JOIN public.organizations o ON o.id = m.organization_id
    WHERE m.user_id = NEW.user_id
      AND o.organization_type = 'company'
  ) INTO v_is_company;

  IF NOT v_is_company THEN RETURN NEW; END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    JOIN public.organizations o ON o.id = m.organization_id
    JOIN public.company_subscriptions s ON s.organization_id = m.organization_id
    JOIN public.platform_subscription_plans p ON p.id = s.plan_id AND p.is_active = true
    WHERE m.user_id = NEW.user_id
      AND o.organization_type = 'company'
      AND s.status = 'active'
      AND s.payment_status IN ('verified','waived')
      AND s.starts_at <= now()
      AND s.ends_at > now()
      AND p.limits->>'support' = 'priority'
  ) INTO v_has_priority;

  IF v_has_priority THEN
    NEW.priority := 'high';
  ELSIF NEW.priority = 'high' THEN
    NEW.priority := 'normal';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_company_priority_support() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS enforce_company_priority_support_before_insert ON public.support_tickets;
CREATE TRIGGER enforce_company_priority_support_before_insert
BEFORE INSERT ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.enforce_company_priority_support();

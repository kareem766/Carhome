-- Enable the existing yearly company subscription option end-to-end.
-- Preserve current plans, prices, subscriptions, coupons and review workflow.
CREATE OR REPLACE FUNCTION public.enforce_company_subscription_30_day_term()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_term interval;
BEGIN
  IF NEW.status = 'active' THEN
    IF NEW.payment_status NOT IN ('verified','waived') THEN
      RAISE EXCEPTION 'لا يمكن تفعيل اشتراك الشركة قبل اعتماد الدفع';
    END IF;
    v_term := CASE WHEN NEW.billing_cycle = 'yearly'
      THEN interval '1 year' ELSE interval '30 days' END;
    IF TG_OP = 'INSERT'
       OR OLD.status IS DISTINCT FROM 'active'
       OR OLD.payment_status NOT IN ('verified','waived') THEN
      NEW.starts_at := now();
      NEW.ends_at := NEW.starts_at + v_term;
    ELSIF NEW.ends_at IS NULL OR NEW.starts_at IS NULL THEN
      NEW.starts_at := COALESCE(NEW.starts_at, now());
      NEW.ends_at := NEW.starts_at + v_term;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

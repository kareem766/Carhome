-- Enforce the requested vehicle quantity across accepted company offers.
-- Lock the parent request so concurrent company members cannot over-award it.
CREATE OR REPLACE FUNCTION public.company_respond_to_rental_offer(p_offer_id uuid, p_status text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_request_id uuid;
  v_company_org uuid;
  v_request_quantity integer;
  v_offer_count integer;
  v_accepted_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'يجب تسجيل الدخول'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('accepted','rejected') THEN
    RAISE EXCEPTION 'حالة الرد غير صالحة';
  END IF;

  SELECT m.organization_id INTO v_company_org
  FROM public.organization_memberships m
  JOIN public.organizations o ON o.id = m.organization_id
  WHERE m.user_id = v_uid
    AND o.organization_type = 'company'::public.organization_type
  ORDER BY m.created_at
  LIMIT 1;

  IF v_company_org IS NULL THEN
    RAISE EXCEPTION 'هذه العملية متاحة لحسابات الشركات فقط';
  END IF;

  -- Serialize all acceptances for the same request.
  SELECT r.id, r.quantity, ro.vehicle_count
    INTO v_request_id, v_request_quantity, v_offer_count
  FROM public.rental_offers ro
  JOIN public.rental_requests r ON r.id = ro.request_id
  WHERE ro.id = p_offer_id
    AND r.organization_id = v_company_org
    AND r.status IN ('open','reviewing')
  FOR UPDATE OF r;

  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'العرض غير موجود أو لا تملك الشركة صلاحية الرد عليه';
  END IF;

  IF p_status = 'accepted' THEN
    SELECT COALESCE(sum(ro.vehicle_count), 0)::integer
      INTO v_accepted_count
    FROM public.rental_offers ro
    WHERE ro.request_id = v_request_id
      AND ro.status = 'accepted';

    IF v_accepted_count + v_offer_count > v_request_quantity THEN
      RAISE EXCEPTION 'عدد السيارات في العرض يتجاوز الكمية المتبقية في الطلب';
    END IF;
  END IF;

  UPDATE public.rental_offers
  SET status = p_status, updated_at = now()
  WHERE id = p_offer_id
    AND request_id = v_request_id
    AND status = 'submitted';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'تم الرد على هذا العرض مسبقًا أو لم يعد متاحًا';
  END IF;

  -- Keep the request open for additional suppliers until its quantity is filled.
  IF p_status = 'accepted' AND v_accepted_count + v_offer_count = v_request_quantity THEN
    UPDATE public.rental_requests
    SET status = 'awarded', updated_at = now()
    WHERE id = v_request_id
      AND status IN ('open','reviewing');
  END IF;

  RETURN true;
END;
$function$;

-- The old notification trigger used the unsupported type 'rental_request_update'.
-- Use the allowed 'request' type and human-readable Arabic status descriptions.
CREATE OR REPLACE FUNCTION app_private.notify_rental_request_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  notification_body text;
BEGIN
  IF new.status IS DISTINCT FROM old.status THEN
    notification_body := CASE new.status
      WHEN 'awarded' THEN 'تمت الترسية على طلب ' || coalesce(new.title, 'التأجير') || '. تابع تفاصيل الطلب من لوحة شركتك.'
      WHEN 'closed' THEN 'تم إغلاق طلب ' || coalesce(new.title, 'التأجير') || '.'
      WHEN 'cancelled' THEN 'تم إلغاء طلب ' || coalesce(new.title, 'التأجير') || '.'
      WHEN 'reviewing' THEN 'طلب ' || coalesce(new.title, 'التأجير') || ' قيد المراجعة.'
      ELSE 'تم تحديث حالة طلب ' || coalesce(new.title, 'التأجير') || ' إلى: ' || new.status || '.'
    END;

    PERFORM app_private.notify_organization_members(
      new.organization_id,
      'تحديث حالة طلب التأجير',
      notification_body,
      'request',
      '/workspace/company/requests',
      new.created_by
    );
  END IF;
  RETURN new;
END;
$function$;

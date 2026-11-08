-- Apply paid vehicle-registration periods consistently to individual owners and fleet suppliers.
CREATE OR REPLACE FUNCTION public.apply_vehicle_registration_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_type public.organization_type;
  v_months integer;
BEGIN
  IF NEW.review_status = 'approved' AND OLD.review_status IS DISTINCT FROM NEW.review_status THEN
    SELECT o.organization_type INTO v_type
      FROM public.vehicles v
      JOIN public.organizations o ON o.id = v.organization_id
     WHERE v.id = NEW.vehicle_id AND v.organization_id = NEW.organization_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Vehicle registration payment does not match a vehicle organization';
    END IF;
    v_months := GREATEST(COALESCE(NEW.period_months, 1), 1);
    UPDATE public.vehicles
       SET payment_status = 'verified',
           registration_expires_at =
             GREATEST(COALESCE(registration_expires_at, now()), now())
             + make_interval(months => v_months),
           updated_at = now()
     WHERE id = NEW.vehicle_id AND organization_id = NEW.organization_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Start the advertising clock only after both administrative approval and payment verification.
CREATE OR REPLACE FUNCTION app_private.set_vehicle_promotion_period()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_duration_days integer;
  v_was_activated boolean := false;
BEGIN
  IF NEW.status = 'approved' AND NEW.payment_status IN ('verified', 'waived') THEN
    SELECT p.duration_days INTO v_duration_days
      FROM public.advertising_plans p
     WHERE p.id = NEW.advertising_plan_id AND p.is_active = true;
    IF v_duration_days IS NULL OR v_duration_days < 1 THEN
      RAISE EXCEPTION 'The selected advertising plan is unavailable or has no valid duration';
    END IF;
    IF TG_OP = 'INSERT' THEN
      v_was_activated := true;
    ELSE
      v_was_activated := OLD.status IS DISTINCT FROM 'approved'
        OR OLD.payment_status NOT IN ('verified', 'waived');
    END IF;
    IF v_was_activated OR NEW.starts_at IS NULL OR NEW.ends_at IS NULL THEN
      IF v_was_activated OR NEW.starts_at IS NULL THEN
        NEW.starts_at := now();
      END IF;
      NEW.ends_at := NEW.starts_at + make_interval(days => v_duration_days);
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS vehicle_promotions_set_period ON public.vehicle_promotions;
CREATE TRIGGER vehicle_promotions_set_period
BEFORE INSERT OR UPDATE OF status, payment_status, advertising_plan_id, starts_at, ends_at
ON public.vehicle_promotions
FOR EACH ROW EXECUTE FUNCTION app_private.set_vehicle_promotion_period();

ALTER TABLE public.vehicle_promotions
  DROP CONSTRAINT IF EXISTS vehicle_promotions_approved_period_required;
ALTER TABLE public.vehicle_promotions
  ADD CONSTRAINT vehicle_promotions_approved_period_required
  CHECK (
    status <> 'approved'
    OR payment_status NOT IN ('verified', 'waived')
    OR (starts_at IS NOT NULL AND ends_at IS NOT NULL AND ends_at > starts_at)
  );

CREATE OR REPLACE FUNCTION public.notify_vehicle_promotion_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN
      PERFORM public.notify_organization_members(
        NEW.organization_id, 'تم اعتماد باقة الإعلان',
        'تم اعتماد طلب الترويج وستظهر السيارة ضمن نتائج الترويج وفق مدة الباقة.',
        'promotion', '/workspace/catalog'
      );
    ELSIF NEW.status IN ('rejected', 'declined') THEN
      PERFORM public.notify_organization_members(
        NEW.organization_id, 'لم تتم الموافقة على الإعلان',
        'لم تتم الموافقة على طلب الترويج. يرجى مراجعة الملاحظات في حسابك.',
        'promotion', '/workspace/catalog'
      );
    ELSIF NEW.status = 'expired' THEN
      PERFORM public.notify_organization_members(
        NEW.organization_id, 'انتهت باقة إعلان سيارتك',
        'انتهت مدة باقة الإعلان. يمكنك اختيار باقة جديدة لتجديد الترويج.',
        'promotion_expired', '/workspace/catalog'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.can_view_catalog_vehicle(
  target_vehicle_id uuid,
  target_organization_id uuid DEFAULT NULL::uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.vehicles v
      JOIN public.organizations provider ON provider.id = v.organization_id
     WHERE v.id = target_vehicle_id
       AND (target_organization_id IS NULL OR v.organization_id = target_organization_id)
       AND v.review_status = 'approved'
       AND v.payment_status IN ('verified', 'waived')
       AND v.registration_expires_at IS NOT NULL
       AND v.registration_expires_at > now()
       AND (v.license_expiry_date IS NULL OR v.license_expiry_date >= current_date)
       AND provider.approval_status = 'approved'
       AND provider.organization_type IN (
         'individual_owner'::public.organization_type,
         'fleet_supplier'::public.organization_type
       )
       AND EXISTS (
         SELECT 1
           FROM public.organization_memberships viewer
           JOIN public.organizations viewer_org ON viewer_org.id = viewer.organization_id
          WHERE viewer.user_id = (SELECT auth.uid())
            AND viewer_org.organization_type IN (
              'company'::public.organization_type,
              'fleet_supplier'::public.organization_type
            )
            AND viewer_org.approval_status = 'approved'
       )
  );
$function$;

CREATE OR REPLACE FUNCTION app_private.send_expiry_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  sent_count integer := 0;
  item record;
  days_left integer;
  cairo_today date := (now() at time zone 'Africa/Cairo')::date;
BEGIN
  UPDATE public.vehicle_promotions
     SET status = 'expired', updated_at = now()
   WHERE status = 'approved'
     AND payment_status IN ('verified', 'waived')
     AND ends_at IS NOT NULL AND ends_at <= now();

  FOR item IN
    SELECT vp.id, vp.organization_id, vp.created_by, vp.ends_at, v.make, v.model
      FROM public.vehicle_promotions vp
      JOIN public.vehicles v ON v.id = vp.vehicle_id
     WHERE vp.status = 'approved'
       AND vp.payment_status IN ('verified', 'waived')
       AND vp.ends_at IS NOT NULL
       AND (vp.ends_at at time zone 'Africa/Cairo')::date
           IN (cairo_today + 7, cairo_today + 3, cairo_today + 1)
  LOOP
    days_left := (item.ends_at at time zone 'Africa/Cairo')::date - cairo_today;
    PERFORM app_private.notify_organization_members(
      item.organization_id,
      CASE WHEN days_left = 1 THEN 'إعلان سيارتك ينتهي غدًا' ELSE 'اقترب موعد انتهاء إعلان سيارتك' END,
      'يتبقى ' || days_left || ' أيام على انتهاء إعلان ' || item.make || ' ' || item.model || '. يمكنك تجديد الباقة من حسابك.',
      'advertisement_expiring_' || days_left, '/workspace/owner/vehicles', item.created_by
    );
    sent_count := sent_count + 1;
  END LOOP;

  FOR item IN
    SELECT cs.id, cs.organization_id, cs.created_by, cs.ends_at, cs.plan_name
      FROM public.company_subscriptions cs
     WHERE cs.status = 'active' AND cs.ends_at IS NOT NULL
       AND (cs.ends_at at time zone 'Africa/Cairo')::date
           IN (cairo_today + 7, cairo_today + 3, cairo_today + 1)
  LOOP
    days_left := (item.ends_at at time zone 'Africa/Cairo')::date - cairo_today;
    PERFORM app_private.notify_organization_members(
      item.organization_id,
      CASE WHEN days_left = 1 THEN 'اشتراك شركتك ينتهي غدًا' ELSE 'اقترب موعد انتهاء اشتراك شركتك' END,
      'يتبقى ' || days_left || ' أيام على انتهاء اشتراك ' || COALESCE(item.plan_name, 'الشركة') || '. جدد الاشتراك لتجنب انقطاع المزايا.',
      'subscription_expiring_' || days_left, '/workspace/company', item.created_by
    );
    sent_count := sent_count + 1;
  END LOOP;

  FOR item IN
    SELECT v.id, v.organization_id, v.created_by, v.registration_expires_at, v.make, v.model
      FROM public.vehicles v
     WHERE v.review_status = 'approved' AND v.registration_expires_at IS NOT NULL
       AND (v.registration_expires_at at time zone 'Africa/Cairo')::date
           IN (cairo_today + 7, cairo_today + 3, cairo_today + 1)
  LOOP
    days_left := (item.registration_expires_at at time zone 'Africa/Cairo')::date - cairo_today;
    PERFORM app_private.notify_organization_members(
      item.organization_id,
      CASE WHEN days_left = 1 THEN 'رسوم تسجيل سيارتك تنتهي غدًا' ELSE 'اقترب موعد تجديد تسجيل السيارة' END,
      'يتبقى ' || days_left || ' أيام على انتهاء تسجيل ' || item.make || ' ' || item.model || '. استكمل التجديد من حسابك.',
      'vehicle_registration_expiring_' || days_left, '/workspace/owner/vehicles', item.created_by
    );
    sent_count := sent_count + 1;
  END LOOP;

  RETURN sent_count;
END;
$function$;

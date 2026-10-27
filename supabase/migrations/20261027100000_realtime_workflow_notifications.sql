-- Realtime in-app notifications for My Car approval and workflow events.
-- All notification writes are performed by database triggers so clients cannot spoof approvals.
CREATE OR REPLACE FUNCTION public.notify_organization_members(
  p_organization_id uuid,
  p_title text,
  p_body text,
  p_type text,
  p_action_url text DEFAULT '/workspace/catalog',
  p_exclude_user uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.platform_notifications (user_id, title, body, notification_type, action_url)
  SELECT DISTINCT m.user_id, p_title, p_body, p_type, p_action_url
  FROM public.organization_memberships m
  WHERE m.organization_id = p_organization_id
    AND m.user_id IS NOT NULL
    AND (p_exclude_user IS NULL OR m.user_id <> p_exclude_user);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_organization_members(uuid,text,text,text,text,uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_organization_approval_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE label text;
BEGIN
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    IF NEW.approval_status = 'approved' THEN
      label := 'تم اعتماد الحساب';
      PERFORM public.notify_organization_members(NEW.id, label, 'تمت مراجعة حسابك واعتماده. يمكنك الآن استخدام خدمات المنصة المتاحة لحسابك.', 'account', '/workspace/catalog');
    ELSIF NEW.approval_status = 'rejected' THEN
      PERFORM public.notify_organization_members(NEW.id, 'تعذر اعتماد الحساب', 'تم رفض الحساب بعد المراجعة. يرجى مراجعة الملاحظات الظاهرة في حسابك أو التواصل مع إدارة المنصة.', 'account', '/workspace/catalog');
    ELSIF NEW.approval_status = 'suspended' THEN
      PERFORM public.notify_organization_members(NEW.id, 'تم إيقاف الحساب مؤقتًا', 'تم تغيير حالة الحساب. يرجى مراجعة إدارة المنصة لمعرفة التفاصيل.', 'account', '/workspace/catalog');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_organization_approval_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS organizations_notify_approval_change ON public.organizations;
CREATE TRIGGER organizations_notify_approval_change
AFTER UPDATE OF approval_status ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.notify_organization_approval_change();

CREATE OR REPLACE FUNCTION public.notify_vehicle_review_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE vehicle_label text;
BEGIN
  IF NEW.review_status IS DISTINCT FROM OLD.review_status THEN
    vehicle_label := concat_ws(' ', NEW.make, NEW.model, NEW.model_year::text);
    IF NEW.review_status = 'approved' THEN
      PERFORM public.notify_organization_members(NEW.organization_id, 'تم اعتماد سيارتك', 'تم اعتماد السيارة ' || vehicle_label || ' وأصبحت مؤهلة للظهور وفق حالة التسجيل والدفع.', 'vehicle', '/workspace/catalog');
    ELSIF NEW.review_status = 'rejected' THEN
      PERFORM public.notify_organization_members(NEW.organization_id, 'تحتاج السيارة إلى تعديل', 'لم تتم الموافقة على السيارة ' || vehicle_label || '. يرجى مراجعة الملاحظات في لوحة التحكم.', 'vehicle', '/workspace/catalog');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_vehicle_review_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS vehicles_notify_review_change ON public.vehicles;
CREATE TRIGGER vehicles_notify_review_change
AFTER UPDATE OF review_status ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.notify_vehicle_review_change();

CREATE OR REPLACE FUNCTION public.notify_vehicle_payment_review_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE vehicle_label text;
BEGIN
  IF NEW.review_status IS DISTINCT FROM OLD.review_status THEN
    SELECT concat_ws(' ', make, model, model_year::text) INTO vehicle_label
    FROM public.vehicles WHERE id = NEW.vehicle_id;
    IF NEW.review_status IN ('approved','verified') THEN
      PERFORM public.notify_organization_members(NEW.organization_id, 'تم اعتماد بيانات الدفع', 'تمت مراجعة بيانات تحويل رسوم تسجيل السيارة ' || COALESCE(vehicle_label,'') || ' واعتمادها.', 'payment', '/workspace/catalog');
    ELSIF NEW.review_status IN ('rejected','declined') THEN
      PERFORM public.notify_organization_members(NEW.organization_id, 'بيانات الدفع تحتاج إلى مراجعة', 'لم يتم اعتماد بيانات التحويل المرسلة. يرجى مراجعة الملاحظات وإعادة الإرسال عند الحاجة.', 'payment', '/workspace/catalog');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_vehicle_payment_review_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS vehicle_payment_submissions_notify_review_change ON public.vehicle_payment_submissions;
CREATE TRIGGER vehicle_payment_submissions_notify_review_change
AFTER UPDATE OF review_status ON public.vehicle_payment_submissions
FOR EACH ROW EXECUTE FUNCTION public.notify_vehicle_payment_review_change();

CREATE OR REPLACE FUNCTION public.notify_company_subscription_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    IF NEW.payment_status IN ('verified','approved','waived') OR NEW.status = 'active' THEN
      PERFORM public.notify_organization_members(NEW.organization_id, 'تم تفعيل اشتراك الشركة', 'تم اعتماد الدفع أو تفعيل الاشتراك. يمكنك الآن استخدام مزايا الباقة المتاحة.', 'subscription', '/workspace/subscriptions');
    ELSIF NEW.payment_status IN ('rejected','declined') THEN
      PERFORM public.notify_organization_members(NEW.organization_id, 'تعذر اعتماد دفع الاشتراك', 'لم يتم اعتماد عملية الدفع الخاصة بالاشتراك. يرجى مراجعة الملاحظات في صفحة الاشتراكات.', 'payment', '/workspace/subscriptions');
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'active' THEN
      PERFORM public.notify_organization_members(NEW.organization_id, 'اشتراكك نشط الآن', 'تم تفعيل اشتراك الشركة بنجاح.', 'subscription', '/workspace/subscriptions');
    ELSIF NEW.status IN ('expired','cancelled','suspended') THEN
      PERFORM public.notify_organization_members(NEW.organization_id, 'تحديث حالة الاشتراك', 'تم تحديث حالة اشتراك الشركة. راجع صفحة الاشتراكات لمعرفة التفاصيل.', 'subscription', '/workspace/subscriptions');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_company_subscription_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS company_subscriptions_notify_change ON public.company_subscriptions;
CREATE TRIGGER company_subscriptions_notify_change
AFTER UPDATE OF payment_status, status ON public.company_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.notify_company_subscription_change();

CREATE OR REPLACE FUNCTION public.notify_vehicle_promotion_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('approved','active') THEN
      PERFORM public.notify_organization_members(NEW.organization_id, 'تم اعتماد باقة الإعلان', 'تم اعتماد طلب الترويج وستظهر السيارة ضمن نتائج الترويج وفق مدة الباقة.', 'promotion', '/workspace/catalog');
    ELSIF NEW.status IN ('rejected','declined') THEN
      PERFORM public.notify_organization_members(NEW.organization_id, 'لم تتم الموافقة على الإعلان', 'لم تتم الموافقة على طلب الترويج. يرجى مراجعة الملاحظات في حسابك.', 'promotion', '/workspace/catalog');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_vehicle_promotion_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS vehicle_promotions_notify_change ON public.vehicle_promotions;
CREATE TRIGGER vehicle_promotions_notify_change
AFTER UPDATE OF status ON public.vehicle_promotions
FOR EACH ROW EXECUTE FUNCTION public.notify_vehicle_promotion_change();

-- Supabase Realtime delivers inserted notifications immediately to signed-in clients.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'platform_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_notifications;
  END IF;
END $$;

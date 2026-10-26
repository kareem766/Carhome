-- My Car commercial launch readiness safeguards.
-- Idempotent companion migration for the security/expiry/subscription fixes.
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS registration_expires_at timestamptz;
COMMENT ON COLUMN public.vehicles.registration_expires_at IS 'Paid-through timestamp for individual-owner vehicle registration.';

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS vodafone_cash_number text,
  ADD COLUMN IF NOT EXISTS instapay_number text;
UPDATE public.platform_settings
SET vodafone_cash_number = COALESCE(NULLIF(vodafone_cash_number,''),'01096656281'),
    instapay_number = COALESCE(NULLIF(instapay_number,''),'01208987035')
WHERE id = true;

CREATE OR REPLACE FUNCTION public.guard_organization_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.organization_type IS DISTINCT FROM OLD.organization_type
     AND NOT EXISTS (SELECT 1 FROM public.platform_admins a WHERE a.user_id = (SELECT auth.uid())) THEN
    RAISE EXCEPTION 'Only platform administrators can change organization type' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS organizations_guard_identity ON public.organizations;
CREATE TRIGGER organizations_guard_identity BEFORE UPDATE OF organization_type ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.guard_organization_identity();

CREATE OR REPLACE FUNCTION public.guard_organization_approval_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins a WHERE a.user_id = (SELECT auth.uid())) THEN
    IF TG_OP = 'INSERT' AND NEW.approval_status IS DISTINCT FROM 'pending_review' THEN
      RAISE EXCEPTION 'New organizations must start pending review' USING ERRCODE = '42501';
    ELSIF TG_OP = 'UPDATE' AND NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
      RAISE EXCEPTION 'Only platform administrators can change organization approval status' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS organizations_guard_approval_status ON public.organizations;
CREATE TRIGGER organizations_guard_approval_status BEFORE INSERT OR UPDATE OF approval_status ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.guard_organization_approval_status();
REVOKE EXECUTE ON FUNCTION public.guard_organization_approval_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_organization_identity() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "vehicle owners can insert their own organization vehicles" ON public.vehicles;
CREATE POLICY "vehicle owners can insert their own organization vehicles" ON public.vehicles FOR INSERT TO authenticated
WITH CHECK (
  created_by = (SELECT auth.uid()) AND review_status = 'pending_review' AND payment_status = 'pending'
  AND EXISTS (SELECT 1 FROM public.organization_memberships m JOIN public.organizations o ON o.id=m.organization_id
    WHERE m.organization_id=vehicles.organization_id AND m.user_id=(SELECT auth.uid())
      AND o.organization_type IN ('individual_owner','fleet_supplier') AND o.approval_status='approved')
);

DROP POLICY IF EXISTS "company members can create rental requests" ON public.rental_requests;
CREATE POLICY "company members can create rental requests" ON public.rental_requests FOR INSERT TO authenticated
WITH CHECK (
  created_by=(SELECT auth.uid()) AND status='open'
  AND EXISTS (SELECT 1 FROM public.organization_memberships m JOIN public.organizations o ON o.id=m.organization_id
    WHERE m.organization_id=rental_requests.organization_id AND m.user_id=(SELECT auth.uid())
      AND o.organization_type='company' AND o.approval_status='approved')
  AND EXISTS (SELECT 1 FROM public.company_subscriptions s WHERE s.organization_id=rental_requests.organization_id
    AND s.status='active' AND s.payment_status IN ('verified','waived') AND s.starts_at<=now() AND s.ends_at>now())
);

DROP POLICY IF EXISTS "fleet suppliers can offer on open requests" ON public.rental_offers;
CREATE POLICY "fleet suppliers can offer on open requests" ON public.rental_offers FOR INSERT TO authenticated
WITH CHECK (
  created_by=(SELECT auth.uid()) AND status='submitted'
  AND EXISTS (SELECT 1 FROM public.organization_memberships m JOIN public.organizations o ON o.id=m.organization_id
    WHERE m.organization_id=rental_offers.organization_id AND m.user_id=(SELECT auth.uid())
      AND o.organization_type IN ('individual_owner','fleet_supplier') AND o.approval_status='approved')
  AND EXISTS (SELECT 1 FROM public.vehicles v JOIN public.organizations provider ON provider.id=v.organization_id
    WHERE v.organization_id=rental_offers.organization_id AND v.review_status='approved'
      AND (provider.organization_type='fleet_supplier' OR (v.payment_status IN ('verified','waived')
      AND (v.registration_expires_at IS NULL OR v.registration_expires_at>now()))))
  AND EXISTS (SELECT 1 FROM public.rental_requests r WHERE r.id=rental_offers.request_id AND r.status='open')
);

DROP POLICY IF EXISTS "organization members can view approved vehicles" ON public.vehicles;
CREATE POLICY "organization members can view approved vehicles" ON public.vehicles FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.organization_memberships own_m WHERE own_m.organization_id=vehicles.organization_id AND own_m.user_id=(SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.platform_admins a WHERE a.user_id=(SELECT auth.uid()))
  OR (review_status='approved'
    AND EXISTS (SELECT 1 FROM public.organization_memberships vm JOIN public.organizations viewer_org ON viewer_org.id=vm.organization_id
      WHERE vm.user_id=(SELECT auth.uid()) AND viewer_org.organization_type='company' AND viewer_org.approval_status='approved')
    AND EXISTS (SELECT 1 FROM public.organizations provider WHERE provider.id=vehicles.organization_id
      AND provider.approval_status='approved'
      AND (provider.organization_type='fleet_supplier' OR (vehicles.payment_status IN ('verified','waived')
      AND (vehicles.registration_expires_at IS NULL OR vehicles.registration_expires_at>now()))))
);

DROP POLICY IF EXISTS "vehicle owners can request promotions" ON public.vehicle_promotions;
CREATE POLICY "vehicle owners can request promotions" ON public.vehicle_promotions FOR INSERT TO authenticated
WITH CHECK (
  created_by=(SELECT auth.uid()) AND status='pending_review' AND payment_status='pending'
  AND starts_at IS NULL AND ends_at IS NULL
  AND EXISTS (SELECT 1 FROM public.organization_memberships m JOIN public.organizations o ON o.id=m.organization_id
    JOIN public.vehicles v ON v.organization_id=m.organization_id
    WHERE m.user_id=(SELECT auth.uid()) AND m.organization_id=vehicle_promotions.organization_id
      AND v.id=vehicle_promotions.vehicle_id AND o.organization_type IN ('individual_owner','fleet_supplier')
      AND o.approval_status='approved' AND v.review_status='approved'
      AND (o.organization_type='fleet_supplier' OR (v.payment_status IN ('verified','waived')
      AND (v.registration_expires_at IS NULL OR v.registration_expires_at>now()))))
  AND EXISTS (SELECT 1 FROM public.advertising_plans p WHERE p.id=vehicle_promotions.advertising_plan_id AND p.is_active=true)
);

CREATE OR REPLACE FUNCTION public.apply_vehicle_registration_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_type public.organization_type;
BEGIN
  IF NEW.review_status='approved' AND OLD.review_status IS DISTINCT FROM NEW.review_status THEN
    SELECT o.organization_type INTO v_type FROM public.vehicles v JOIN public.organizations o ON o.id=v.organization_id
      WHERE v.id=NEW.vehicle_id AND v.organization_id=NEW.organization_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Vehicle registration payment does not match a vehicle organization'; END IF;
    UPDATE public.vehicles SET payment_status='verified',
      registration_expires_at=CASE WHEN v_type='individual_owner'
        THEN GREATEST(COALESCE(registration_expires_at,now()),now())+make_interval(months=>GREATEST(COALESCE(NEW.period_months,1),1))
        ELSE registration_expires_at END,
      updated_at=now()
    WHERE id=NEW.vehicle_id AND organization_id=NEW.organization_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS vehicle_payment_submission_approved ON public.vehicle_payment_submissions;
CREATE TRIGGER vehicle_payment_submission_approved AFTER UPDATE OF review_status ON public.vehicle_payment_submissions
FOR EACH ROW EXECUTE FUNCTION public.apply_vehicle_registration_payment();
REVOKE EXECUTE ON FUNCTION public.apply_vehicle_registration_payment() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "vehicle_images_select_authorized" ON public.vehicle_images;
CREATE POLICY "vehicle_images_select_authorized" ON public.vehicle_images FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.organization_memberships own_m WHERE own_m.organization_id=vehicle_images.organization_id AND own_m.user_id=(SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.platform_admins a WHERE a.user_id=(SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.vehicles v JOIN public.organizations provider ON provider.id=v.organization_id
    JOIN public.organization_memberships viewer ON viewer.user_id=(SELECT auth.uid())
    JOIN public.organizations viewer_org ON viewer_org.id=viewer.organization_id
    WHERE viewer_org.organization_type='company' AND viewer_org.approval_status='approved'
      AND v.id=vehicle_images.vehicle_id AND v.organization_id=vehicle_images.organization_id
      AND v.review_status='approved' AND provider.approval_status='approved'
      AND (provider.organization_type='fleet_supplier' OR (v.payment_status IN ('verified','waived')
      AND (v.registration_expires_at IS NULL OR v.registration_expires_at>now())))
);

DROP POLICY IF EXISTS "company members can start direct vehicle conversations" ON public.conversations;
CREATE POLICY "company members can start direct vehicle conversations" ON public.conversations FOR INSERT TO authenticated
WITH CHECK (
  request_id IS NULL AND vehicle_id IS NOT NULL AND created_by=(SELECT auth.uid()) AND status='open'
  AND EXISTS (SELECT 1 FROM public.organization_memberships m JOIN public.organizations company ON company.id=m.organization_id
    WHERE m.user_id=(SELECT auth.uid()) AND m.organization_id=conversations.company_organization_id
      AND company.organization_type='company' AND company.approval_status='approved')
  AND EXISTS (SELECT 1 FROM public.vehicles v JOIN public.organizations provider ON provider.id=v.organization_id
    WHERE v.id=conversations.vehicle_id AND v.organization_id=conversations.provider_organization_id
      AND v.review_status='approved' AND provider.approval_status='approved'
      AND (provider.organization_type='fleet_supplier' OR (v.payment_status IN ('verified','waived')
      AND (v.registration_expires_at IS NULL OR v.registration_expires_at>now())))
      AND v.organization_id<>conversations.company_organization_id)
);

DROP POLICY IF EXISTS "companies can submit their own subscription requests" ON public.company_subscriptions;
CREATE POLICY "companies can submit their own subscription requests" ON public.company_subscriptions FOR INSERT TO authenticated
WITH CHECK (
  created_by=(SELECT auth.uid()) AND status='pending' AND payment_status='submitted'
  AND starts_at IS NULL AND ends_at IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL
  AND payment_reference IS NOT NULL AND char_length(btrim(payment_reference)) BETWEEN 3 AND 100
  AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id=company_subscriptions.organization_id
    AND o.created_by=(SELECT auth.uid()) AND o.organization_type='company' AND o.approval_status='approved')
  AND EXISTS (SELECT 1 FROM public.platform_subscription_plans p WHERE p.id=company_subscriptions.plan_id AND p.is_active=true
    AND company_subscriptions.amount_egp=CASE company_subscriptions.billing_cycle WHEN 'monthly' THEN p.monthly_price WHEN 'yearly' THEN p.yearly_price END
    AND company_subscriptions.plan_name=p.name)
);

CREATE INDEX IF NOT EXISTS vehicles_registration_expires_idx ON public.vehicles(registration_expires_at);
CREATE INDEX IF NOT EXISTS company_subscriptions_active_expiry_idx ON public.company_subscriptions(organization_id,status,payment_status,ends_at);

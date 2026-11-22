-- Allow company owners to submit both monthly and yearly subscription payments.
-- The previous INSERT policy only accepted monthly billing even though yearly
-- plans and the one-year activation trigger are already supported.

DROP POLICY IF EXISTS "companies can submit their own subscription requests"
ON public.company_subscriptions;

CREATE POLICY "companies can submit their own subscription requests"
ON public.company_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND status = 'pending'
  AND payment_status = 'submitted'
  AND billing_cycle IN ('monthly', 'yearly')
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
      AND company_subscriptions.original_amount_egp =
        CASE
          WHEN company_subscriptions.billing_cycle = 'yearly' THEN p.yearly_price
          ELSE p.monthly_price
        END
      AND company_subscriptions.amount_egp = company_subscriptions.final_amount_egp
      AND company_subscriptions.final_amount_egp =
        CASE
          WHEN company_subscriptions.billing_cycle = 'yearly' THEN p.yearly_price
          ELSE p.monthly_price
        END - company_subscriptions.discount_amount_egp
      AND company_subscriptions.discount_amount_egp >= 0
      AND (
        (
          NULLIF(btrim(company_subscriptions.coupon_code), '') IS NULL
          AND company_subscriptions.discount_amount_egp = 0
        )
        OR (
          NULLIF(btrim(company_subscriptions.coupon_code), '') IS NOT NULL
          AND company_subscriptions.discount_amount_egp > 0
        )
      )
  )
);

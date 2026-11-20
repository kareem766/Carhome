-- Standardize new vehicle registration submissions at EGP 150 per month.
-- Preserve historical submissions (including their original EGP 300/month values)
-- so existing admin reviews and payment records remain editable.
ALTER TABLE public.vehicle_payment_submissions
  ALTER COLUMN amount_egp SET DEFAULT 150;

ALTER TABLE public.vehicle_payment_submissions
  DROP CONSTRAINT IF EXISTS vehicle_payment_submissions_check;

ALTER TABLE public.vehicle_payment_submissions
  ADD CONSTRAINT vehicle_payment_submissions_fee_matches_period_check
  CHECK (
    (
      created_at < TIMESTAMPTZ '2026-11-20 21:54:00+00'
      AND amount_egp IN (150 * period_months, 300 * period_months)
    )
    OR
    (
      created_at >= TIMESTAMPTZ '2026-11-20 21:54:00+00'
      AND amount_egp = 150 * period_months
    )
  ) NOT VALID;

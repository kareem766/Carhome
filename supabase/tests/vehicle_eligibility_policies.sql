-- Regression checks for vehicle eligibility parity.
-- Run after applying migrations with: psql "$DATABASE_URL" -f supabase/tests/vehicle_eligibility_policies.sql
DO $$
DECLARE
  policy_row record;
  policy_expression text;
  expected_policies text[][] := ARRAY[
    ARRAY['employee_rental_offers', 'approved providers submit offers for open employee requests', 'with_check'],
    ARRAY['rental_offers', 'approved providers with eligible vehicles can offer on open req', 'with_check'],
    ARRAY['rental_requests', 'eligible providers can view matching open rental requests', 'qual']
  ];
  i integer;
BEGIN
  FOR i IN 1..array_length(expected_policies, 1) LOOP
    SELECT *
      INTO policy_row
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = expected_policies[i][1]
       AND policyname = expected_policies[i][2];

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Missing expected policy: %.%', expected_policies[i][1], expected_policies[i][2];
    END IF;

    policy_expression := CASE expected_policies[i][3]
      WHEN 'qual' THEN coalesce(policy_row.qual, '')
      ELSE coalesce(policy_row.with_check, '')
    END;

    IF position('registration_expires_at IS NOT NULL' IN policy_expression) = 0
       OR position('registration_expires_at > now()' IN policy_expression) = 0
       OR position('registration_expires_at IS NULL' IN policy_expression) > 0 THEN
      RAISE EXCEPTION 'Policy %.% does not enforce a present, unexpired registration date',
        expected_policies[i][1], expected_policies[i][2];
    END IF;
  END LOOP;
END;
$$;

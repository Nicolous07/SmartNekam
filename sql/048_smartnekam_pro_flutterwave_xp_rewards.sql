-- SmartNekam SQL 048: Pro subscriptions, verified Flutterwave payments, and XP-to-Pro rewards.
-- Additive migration. Run in Supabase SQL Editor after the existing SmartNekam schema.

BEGIN;

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  price numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  currency text NOT NULL DEFAULT 'TZS',
  billing_interval text NOT NULL DEFAULT 'monthly',
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS price numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'TZS';
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS billing_interval text NOT NULL DEFAULT 'monthly';
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS subscription_plans_slug_uidx ON public.subscription_plans(slug);

-- Extend the interval constraint from SQL 011 while preserving its existing values.
ALTER TABLE public.subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_interval_check;
ALTER TABLE public.subscription_plans
  ADD CONSTRAINT subscription_plans_interval_check
  CHECK (billing_interval IN ('daily', 'weekly', 'monthly', 'quarterly', 'annual', 'yearly', 'one_time'));

INSERT INTO public.subscription_plans(name, slug, price, currency, billing_interval, is_active, display_order, description, features)
VALUES
  ('SmartNekam Pro — Daily', 'smartnekam-pro-daily', 500, 'TZS', 'daily', true, 1, 'Ufikiaji wa Pro kwa siku moja.', '{"access":"pro","features":["premium_courses","library_marking_schemes"]}'::jsonb),
  ('SmartNekam Pro — Weekly', 'smartnekam-pro-weekly', 1500, 'TZS', 'weekly', true, 2, 'Ufikiaji wa Pro kwa siku saba.', '{"access":"pro","features":["premium_courses","library_marking_schemes"]}'::jsonb),
  ('SmartNekam Pro — Monthly', 'smartnekam-pro-monthly', 3000, 'TZS', 'monthly', true, 3, 'Mpango wa Pro wa mwezi mmoja.', '{"access":"pro","features":["premium_courses","library_marking_schemes"]}'::jsonb),
  ('SmartNekam Pro — 3 Months', 'smartnekam-pro-quarterly', 8000, 'TZS', 'quarterly', true, 4, 'Ufikiaji wa Pro kwa miezi mitatu.', '{"access":"pro","features":["premium_courses","library_marking_schemes"]}'::jsonb),
  ('SmartNekam Pro — Yearly', 'smartnekam-pro-yearly', 25000, 'TZS', 'yearly', true, 5, 'Ufikiaji wa Pro kwa mwaka mmoja.', '{"access":"pro","features":["premium_courses","library_marking_schemes"]}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  currency = EXCLUDED.currency,
  billing_interval = EXCLUDED.billing_interval,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  updated_at = pg_catalog.now();

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  transaction_type text NOT NULL DEFAULT 'subscription',
  provider text NOT NULL DEFAULT 'flutterwave',
  status text NOT NULL DEFAULT 'pending',
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'TZS',
  provider_reference text,
  description text NOT NULL DEFAULT '',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS subscription_plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS provider_transaction_id text;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS idempotency_key uuid DEFAULT gen_random_uuid();

-- SQL 011 permits a fixed provider/status set; extend it for Flutterwave.
ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_provider_check;
ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_provider_check
  CHECK (provider IN ('mpesa', 'tigopesa', 'airtel_money', 'stripe', 'bank_transfer', 'manual', 'flutterwave'));

ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_status_check;
ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_status_check
  CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded'));
CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_provider_reference_uidx
  ON public.payment_transactions(provider, provider_reference)
  WHERE provider_reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_provider_transaction_uidx
  ON public.payment_transactions(provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

-- SQL 011 records provider events and only allowed a fixed list before this upgrade.
ALTER TABLE public.payment_provider_events
  DROP CONSTRAINT IF EXISTS payment_provider_events_provider_check;
ALTER TABLE public.payment_provider_events
  ADD CONSTRAINT payment_provider_events_provider_check
  CHECK (provider IN ('mpesa', 'tigopesa', 'airtel_money', 'stripe', 'bank_transfer', 'manual', 'flutterwave'));

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'payment';
CREATE INDEX IF NOT EXISTS user_subscriptions_profile_period_idx
  ON public.user_subscriptions(profile_id, status, current_period_end DESC);

CREATE TABLE IF NOT EXISTS public.xp_reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reward_code text NOT NULL,
  xp_required integer NOT NULL CHECK (xp_required > 0),
  reward_days integer NOT NULL CHECK (reward_days > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, reward_code)
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_reward_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_plans_read_active_authenticated ON public.subscription_plans;
CREATE POLICY subscription_plans_read_active_authenticated
  ON public.subscription_plans FOR SELECT TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS payment_transactions_read_own ON public.payment_transactions;
CREATE POLICY payment_transactions_read_own
  ON public.payment_transactions FOR SELECT TO authenticated USING (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS user_subscriptions_read_own ON public.user_subscriptions;
CREATE POLICY user_subscriptions_read_own
  ON public.user_subscriptions FOR SELECT TO authenticated USING (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS xp_reward_claims_read_own ON public.xp_reward_claims;
CREATE POLICY xp_reward_claims_read_own
  ON public.xp_reward_claims FOR SELECT TO authenticated USING (profile_id = (SELECT auth.uid()));

GRANT SELECT ON public.subscription_plans TO authenticated;
GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT SELECT ON public.user_subscriptions TO authenticated;
GRANT SELECT ON public.xp_reward_claims TO authenticated;

-- Called only by the trusted server after Flutterwave transaction verification.
-- A row lock and the successful-status check make callback + webhook idempotent.
CREATE OR REPLACE FUNCTION public.confirm_flutterwave_subscription_payment(
  p_tx_ref text,
  p_provider_transaction_id text,
  p_paid_amount numeric,
  p_paid_currency text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tx record;
  v_plan public.subscription_plans%ROWTYPE;
  v_subscription_id uuid;
  v_current_period_end timestamptz;
  v_period_start timestamptz;
  v_period_end timestamptz;
BEGIN
  IF NULLIF(pg_catalog.btrim(COALESCE(p_tx_ref, '')), '') IS NULL
     OR NULLIF(pg_catalog.btrim(COALESCE(p_provider_transaction_id, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Payment reference haijakamilika.' USING ERRCODE = '22023';
  END IF;

  SELECT t.id, t.profile_id, t.status, t.amount, t.currency, t.subscription_plan_id, t.provider
    INTO v_tx
  FROM public.payment_transactions t
  WHERE t.provider = 'flutterwave' AND t.provider_reference = p_tx_ref
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment reference haijapatikana.' USING ERRCODE = 'P0002';
  END IF;

  IF v_tx.status = 'succeeded' THEN
    RETURN pg_catalog.jsonb_build_object('success', true, 'already_processed', true);
  END IF;

  IF v_tx.status NOT IN ('pending', 'processing') THEN
    RAISE EXCEPTION 'Transaction hii haiwezi kuthibitishwa kutoka status yake ya sasa.' USING ERRCODE = '22023';
  END IF;

  IF pg_catalog.round(COALESCE(p_paid_amount, -1)::numeric, 2) <> pg_catalog.round(v_tx.amount::numeric, 2)
     OR pg_catalog.upper(COALESCE(p_paid_currency, '')) <> pg_catalog.upper(v_tx.currency) THEN
    RAISE EXCEPTION 'Kiasi au currency ya malipo haifanani na order.' USING ERRCODE = '22023';
  END IF;

  SELECT p.* INTO v_plan
  FROM public.subscription_plans p
  WHERE p.id = v_tx.subscription_plan_id AND p.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription plan haijapatikana au haijawashwa.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.payment_transactions
  SET status = 'succeeded',
      paid_at = pg_catalog.now(),
      provider_transaction_id = p_provider_transaction_id
  WHERE id = v_tx.id;

  UPDATE public.user_subscriptions
  SET status = 'expired'
  WHERE profile_id = v_tx.profile_id
    AND status IN ('active', 'trialing')
    AND (current_period_end IS NULL OR current_period_end <= pg_catalog.now());

  SELECT s.id, s.current_period_end
    INTO v_subscription_id, v_current_period_end
  FROM public.user_subscriptions s
  WHERE s.profile_id = v_tx.profile_id
    AND s.status = 'active'
    AND s.current_period_end > pg_catalog.now()
  ORDER BY s.current_period_end DESC
  LIMIT 1
  FOR UPDATE;

  v_period_start := CASE
    WHEN v_subscription_id IS NOT NULL AND v_current_period_end > pg_catalog.now()
      THEN v_current_period_end
    ELSE pg_catalog.now()
  END;

  v_period_end := CASE v_plan.billing_interval
    WHEN 'daily' THEN v_period_start + interval '1 day'
    WHEN 'weekly' THEN v_period_start + interval '7 days'
    WHEN 'monthly' THEN v_period_start + interval '1 month'
    WHEN 'quarterly' THEN v_period_start + interval '3 months'
    WHEN 'yearly' THEN v_period_start + interval '1 year'
    ELSE NULL
  END;

  IF v_period_end IS NULL THEN
    RAISE EXCEPTION 'Billing interval ya plan haitambuliwi.' USING ERRCODE = '22023';
  END IF;

  IF v_subscription_id IS NULL THEN
    INSERT INTO public.user_subscriptions(
      profile_id, plan_id, status, current_period_start, current_period_end, cancel_at_period_end, source
    )
    VALUES (
      v_tx.profile_id, v_plan.id, 'active', v_period_start, v_period_end, false, 'payment'
    );
  ELSE
    UPDATE public.user_subscriptions
    SET plan_id = v_plan.id,
        current_period_end = v_period_end,
        status = 'active',
        cancel_at_period_end = false,
        source = 'payment'
    WHERE id = v_subscription_id;
  END IF;

  RETURN pg_catalog.jsonb_build_object('success', true, 'already_processed', false, 'period_end', v_period_end);
END;
$function$;

REVOKE ALL ON FUNCTION public.confirm_flutterwave_subscription_payment(text, text, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_flutterwave_subscription_payment(text, text, numeric, text) FROM anon;
REVOKE ALL ON FUNCTION public.confirm_flutterwave_subscription_payment(text, text, numeric, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_flutterwave_subscription_payment(text, text, numeric, text) TO service_role;

-- These four milestones grant actual time-limited Pro access, not cash.
CREATE OR REPLACE FUNCTION public.claim_xp_reward(p_reward_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_xp integer;
  v_profile_status text;
  v_required_xp integer;
  v_reward_days integer;
  v_plan_slug text;
  v_plan_id uuid;
  v_claim_id uuid;
  v_subscription_id uuid;
  v_current_period_end timestamptz;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Ingia kwanza ili kudai zawadi.' USING ERRCODE = '28000';
  END IF;

  SELECT p.xp, p.status INTO v_xp, v_profile_status
  FROM public.profiles p WHERE p.id = v_user_id;

  IF NOT FOUND OR v_profile_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Akaunti active inahitajika kudai zawadi.' USING ERRCODE = '42501';
  END IF;

  CASE p_reward_code
    WHEN 'pro_notes_3_days' THEN v_required_xp := 250; v_reward_days := 3; v_plan_slug := 'smartnekam-pro-daily';
    WHEN 'pro_week_7_days' THEN v_required_xp := 1000; v_reward_days := 7; v_plan_slug := 'smartnekam-pro-weekly';
    WHEN 'pro_month_30_days' THEN v_required_xp := 2000; v_reward_days := 30; v_plan_slug := 'smartnekam-pro-monthly';
    WHEN 'pro_3_months_90_days' THEN v_required_xp := 5000; v_reward_days := 90; v_plan_slug := 'smartnekam-pro-quarterly';
    ELSE RAISE EXCEPTION 'Zawadi hii haijapatikana au bado haiwezi kudaiwa.' USING ERRCODE = '22023';
  END CASE;

  IF COALESCE(v_xp, 0) < v_required_xp THEN
    RAISE EXCEPTION 'Bado hujafikisha XP zinazohitajika kwa zawadi hii.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.xp_reward_claims(profile_id, reward_code, xp_required, reward_days)
  VALUES (v_user_id, p_reward_code, v_required_xp, v_reward_days)
  ON CONFLICT (profile_id, reward_code) DO NOTHING
  RETURNING id INTO v_claim_id;

  IF v_claim_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'already_claimed', true);
  END IF;

  SELECT p.id INTO v_plan_id
  FROM public.subscription_plans p
  WHERE p.slug = v_plan_slug AND p.is_active = true;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Plan ya zawadi haijapatikana.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.user_subscriptions
  SET status = 'expired'
  WHERE profile_id = v_user_id
    AND status IN ('active', 'trialing')
    AND (current_period_end IS NULL OR current_period_end <= pg_catalog.now());

  SELECT s.id, s.current_period_end
    INTO v_subscription_id, v_current_period_end
  FROM public.user_subscriptions s
  WHERE s.profile_id = v_user_id
    AND s.status = 'active'
    AND s.current_period_end > pg_catalog.now()
  ORDER BY s.current_period_end DESC
  LIMIT 1
  FOR UPDATE;

  IF v_subscription_id IS NOT NULL THEN
    v_start := v_current_period_end;
    v_end := v_current_period_end + pg_catalog.make_interval(days => v_reward_days);
    UPDATE public.user_subscriptions SET current_period_end = v_end WHERE id = v_subscription_id;
  ELSE
    v_start := pg_catalog.now();
    v_end := v_start + pg_catalog.make_interval(days => v_reward_days);
    INSERT INTO public.user_subscriptions(
      profile_id, plan_id, status, current_period_start, current_period_end, cancel_at_period_end, source
    )
    VALUES (v_user_id, v_plan_id, 'active', v_start, v_end, false, 'xp_reward');
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'already_claimed', false,
    'reward_code', p_reward_code,
    'days_added', v_reward_days,
    'period_end', v_end
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_xp_reward(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_xp_reward(text) TO authenticated;


-- Central Pro entitlement check, used to open paid-for Premium courses.
CREATE OR REPLACE FUNCTION public.has_active_smartnekam_pro()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_subscriptions us
    JOIN public.subscription_plans sp ON sp.id = us.plan_id
    WHERE us.profile_id = (SELECT auth.uid())
      AND us.status = 'active'
      AND us.current_period_end IS NOT NULL
      AND us.current_period_end > pg_catalog.now()
      AND sp.is_active = true
      AND sp.slug LIKE 'smartnekam-pro-%'
  );
$function$;

REVOKE ALL ON FUNCTION public.has_active_smartnekam_pro() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_active_smartnekam_pro() FROM anon;
GRANT EXECUTE ON FUNCTION public.has_active_smartnekam_pro() TO authenticated;

-- Keep approved papers readable, but protect the marking-scheme file path so
-- it is only signed/readable by an active Pro subscriber or its uploader.
DROP POLICY IF EXISTS learning_resources_read_own_or_approved ON storage.objects;
CREATE POLICY learning_resources_read_own_or_approved
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'learning-resources'
  AND (
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.notes n
      WHERE n.storage_path = name AND n.status = 'approved'
    )
    OR EXISTS (
      SELECT 1 FROM public.past_papers p
      WHERE p.storage_path = name AND p.status = 'approved'
    )
    OR EXISTS (
      SELECT 1 FROM public.past_papers p
      WHERE p.marking_scheme_path = name
        AND p.status = 'approved'
        AND public.has_active_smartnekam_pro()
    )
  )
);

-- Idempotent course access: free courses stay free; Pro subscriptions unlock
-- all published Premium courses without requiring a separate course payment.
CREATE OR REPLACE FUNCTION public.enroll_in_course_with_pro(p_course_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_access_type text;
  v_enrollment_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Ingia kwenye SmartNekam kwanza.' USING ERRCODE = '28000';
  END IF;

  SELECT c.access_type::text
    INTO v_access_type
  FROM public.courses c
  WHERE c.id = p_course_id AND c.status = 'published';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kozi haijapatikana au haijachapishwa.' USING ERRCODE = 'P0002';
  END IF;

  IF v_access_type <> 'free' AND NOT public.has_active_smartnekam_pro() THEN
    RAISE EXCEPTION 'Kozi hii inahitaji SmartNekam Pro active.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.course_enrollments(course_id, student_id, status)
  VALUES (p_course_id, v_user_id, 'active')
  ON CONFLICT (course_id, student_id) DO UPDATE
    SET status = 'active', cancelled_at = NULL
    WHERE public.course_enrollments.status = 'cancelled'
  RETURNING id INTO v_enrollment_id;

  IF v_enrollment_id IS NULL THEN
    SELECT e.id INTO v_enrollment_id
    FROM public.course_enrollments e
    WHERE e.course_id = p_course_id AND e.student_id = v_user_id;
  END IF;

  RETURN v_enrollment_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.enroll_in_course_with_pro(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enroll_in_course_with_pro(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.enroll_in_course_with_pro(uuid) TO authenticated;

COMMIT;

-- Verification queries after running:
-- SELECT slug, price, currency, billing_interval, is_active FROM public.subscription_plans ORDER BY display_order;
-- SELECT to_regclass('public.payment_transactions'), to_regclass('public.user_subscriptions'), to_regclass('public.xp_reward_claims');

-- SmartNekam | SQL 011: Certificates, Wallet, Subscriptions and Payment Records
-- Prerequisites: SQL 001A-001B and SQL 002-010 completed successfully.
-- Run this ENTIRE file in Supabase Dashboard > SQL Editor > New query.
-- Re-runnable during development. Does not drop existing tables or user data.
-- IMPORTANT: this migration creates payment records and trusted server-side hooks;
-- it does NOT by itself connect M-Pesa, Tigo Pesa, Airtel Money, or a card processor.
-- Payment-provider callbacks and secrets must be handled by a server-side Edge Function.
-- Certificate Storage paths: <recipient_profile_uuid>/<certificate_uuid>/<filename>.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Billing administration helper (super_admin only)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_smartnekam_billing_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = (SELECT auth.uid())
          AND p.role = 'super_admin'
          AND p.status = 'active'
    );
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.is_smartnekam_billing_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_smartnekam_billing_admin() TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. Subscription plan catalogue
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(80) NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    price NUMERIC(14,2) NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'TZS',
    billing_interval VARCHAR(20) NOT NULL DEFAULT 'monthly',
    features JSONB NOT NULL DEFAULT '{}'::JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 100,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT subscription_plans_name_not_blank CHECK (length(btrim(name)) > 0),
    CONSTRAINT subscription_plans_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT subscription_plans_price_check CHECK (price >= 0),
    CONSTRAINT subscription_plans_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT subscription_plans_interval_check CHECK (billing_interval IN ('monthly', 'quarterly', 'annual', 'one_time')),
    CONSTRAINT subscription_plans_features_object_check CHECK (jsonb_typeof(features) = 'object'),
    CONSTRAINT subscription_plans_display_order_check CHECK (display_order >= 0)
);

CREATE INDEX IF NOT EXISTS subscription_plans_active_display_idx
    ON public.subscription_plans (is_active, display_order, price);

DROP TRIGGER IF EXISTS subscription_plans_set_updated_at ON public.subscription_plans;
CREATE TRIGGER subscription_plans_set_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. User subscriptions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
    status VARCHAR(24) NOT NULL DEFAULT 'pending_payment',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    provider_subscription_reference TEXT,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_subscriptions_status_check CHECK (status IN ('pending_payment', 'trialing', 'active', 'past_due', 'cancelled', 'expired')),
    CONSTRAINT user_subscriptions_period_check CHECK (current_period_end IS NULL OR current_period_start IS NULL OR current_period_end > current_period_start),
    CONSTRAINT user_subscriptions_end_check CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX IF NOT EXISTS user_subscriptions_profile_status_idx
    ON public.user_subscriptions (profile_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS user_subscriptions_period_end_idx
    ON public.user_subscriptions (current_period_end)
    WHERE status IN ('active', 'trialing');
CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_one_active_per_profile_idx
    ON public.user_subscriptions (profile_id)
    WHERE status IN ('active', 'trialing');
CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_provider_reference_unique_idx
    ON public.user_subscriptions (provider_subscription_reference)
    WHERE provider_subscription_reference IS NOT NULL;

DROP TRIGGER IF EXISTS user_subscriptions_set_updated_at ON public.user_subscriptions;
CREATE TRIGGER user_subscriptions_set_updated_at
BEFORE UPDATE ON public.user_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Payment transactions and provider webhook idempotency
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    subscription_id UUID REFERENCES public.user_subscriptions(id) ON DELETE SET NULL,
    transaction_type VARCHAR(24) NOT NULL,
    provider VARCHAR(24) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    amount NUMERIC(14,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'TZS',
    idempotency_key UUID NOT NULL,
    provider_reference TEXT,
    checkout_url TEXT,
    description TEXT NOT NULL DEFAULT '',
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT payment_transactions_type_check CHECK (transaction_type IN ('subscription', 'wallet_topup', 'course_purchase', 'mentor_booking', 'other')),
    CONSTRAINT payment_transactions_provider_check CHECK (provider IN ('mpesa', 'tigopesa', 'airtel_money', 'stripe', 'bank_transfer', 'manual')),
    CONSTRAINT payment_transactions_status_check CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded')),
    CONSTRAINT payment_transactions_amount_check CHECK (amount > 0),
    CONSTRAINT payment_transactions_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT payment_transactions_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object'),
    CONSTRAINT payment_transactions_idempotency_unique UNIQUE (profile_id, idempotency_key),
    CONSTRAINT payment_transactions_checkout_url_check CHECK (checkout_url IS NULL OR checkout_url ~* '^https?://')
);

CREATE INDEX IF NOT EXISTS payment_transactions_profile_created_idx
    ON public.payment_transactions (profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_transactions_status_created_idx
    ON public.payment_transactions (status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_provider_reference_unique_idx
    ON public.payment_transactions (provider, provider_reference)
    WHERE provider_reference IS NOT NULL;

DROP TRIGGER IF EXISTS payment_transactions_set_updated_at ON public.payment_transactions;
CREATE TRIGGER payment_transactions_set_updated_at
BEFORE UPDATE ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.payment_provider_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(24) NOT NULL,
    event_id TEXT NOT NULL,
    event_type VARCHAR(120) NOT NULL DEFAULT 'unknown',
    payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    processing_status VARCHAR(20) NOT NULL DEFAULT 'received',
    processing_error TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    CONSTRAINT payment_provider_events_provider_check CHECK (provider IN ('mpesa', 'tigopesa', 'airtel_money', 'stripe', 'bank_transfer', 'manual')),
    CONSTRAINT payment_provider_events_status_check CHECK (processing_status IN ('received', 'processing', 'processed', 'failed', 'ignored')),
    CONSTRAINT payment_provider_events_payload_object_check CHECK (jsonb_typeof(payload) = 'object'),
    CONSTRAINT payment_provider_events_provider_event_unique UNIQUE (provider, event_id)
);
CREATE INDEX IF NOT EXISTS payment_provider_events_status_idx
    ON public.payment_provider_events (processing_status, received_at);

-- -----------------------------------------------------------------------------
-- 5. Wallet accounts and immutable ledger
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallet_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    currency CHAR(3) NOT NULL DEFAULT 'TZS',
    available_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT wallet_accounts_profile_currency_unique UNIQUE (profile_id, currency),
    CONSTRAINT wallet_accounts_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT wallet_accounts_balance_nonnegative CHECK (available_balance >= 0),
    CONSTRAINT wallet_accounts_status_check CHECK (status IN ('active', 'frozen', 'closed'))
);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_account_id UUID NOT NULL REFERENCES public.wallet_accounts(id) ON DELETE RESTRICT,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    direction VARCHAR(8) NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    currency CHAR(3) NOT NULL,
    category VARCHAR(24) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'posted',
    idempotency_key UUID NOT NULL,
    external_reference TEXT,
    description TEXT NOT NULL DEFAULT '',
    balance_after NUMERIC(14,2) NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT wallet_transactions_direction_check CHECK (direction IN ('credit', 'debit')),
    CONSTRAINT wallet_transactions_amount_check CHECK (amount > 0),
    CONSTRAINT wallet_transactions_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT wallet_transactions_category_check CHECK (category IN ('top_up', 'purchase', 'subscription', 'course_purchase', 'mentor_booking', 'refund', 'adjustment', 'payout', 'other')),
    CONSTRAINT wallet_transactions_status_check CHECK (status IN ('posted', 'reversed')),
    CONSTRAINT wallet_transactions_balance_check CHECK (balance_after >= 0),
    CONSTRAINT wallet_transactions_idempotency_unique UNIQUE (profile_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS wallet_transactions_profile_created_idx
    ON public.wallet_transactions (profile_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_external_reference_unique_idx
    ON public.wallet_transactions (external_reference)
    WHERE external_reference IS NOT NULL;

DROP TRIGGER IF EXISTS wallet_accounts_set_updated_at ON public.wallet_accounts;
CREATE TRIGGER wallet_accounts_set_updated_at
BEFORE UPDATE ON public.wallet_accounts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Create a default TZS wallet for new profiles and backfill existing profiles.
CREATE OR REPLACE FUNCTION public.ensure_smartnekam_wallet_for_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    INSERT INTO public.wallet_accounts (profile_id, currency)
    VALUES (NEW.id, 'TZS')
    ON CONFLICT (profile_id, currency) DO NOTHING;
    RETURN NEW;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.ensure_smartnekam_wallet_for_profile() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS profiles_create_smartnekam_wallet ON public.profiles;
CREATE TRIGGER profiles_create_smartnekam_wallet
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.ensure_smartnekam_wallet_for_profile();

INSERT INTO public.wallet_accounts (profile_id, currency)
SELECT p.id, 'TZS'
FROM public.profiles AS p
ON CONFLICT (profile_id, currency) DO NOTHING;

-- Trusted ledger post: callable only by service_role (normally via an Edge Function).
CREATE OR REPLACE FUNCTION public.post_smartnekam_wallet_transaction(
    p_profile_id UUID,
    p_direction TEXT,
    p_amount NUMERIC,
    p_currency TEXT,
    p_category TEXT,
    p_idempotency_key UUID,
    p_external_reference TEXT DEFAULT NULL,
    p_description TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_direction TEXT := pg_catalog.lower(pg_catalog.btrim(p_direction));
    v_currency TEXT := pg_catalog.upper(pg_catalog.btrim(p_currency));
    v_category TEXT := pg_catalog.lower(pg_catalog.btrim(p_category));
    v_account_id UUID;
    v_balance NUMERIC(14,2);
    v_new_balance NUMERIC(14,2);
    v_account_status TEXT;
    v_existing public.wallet_transactions%ROWTYPE;
    v_transaction_id UUID;
BEGIN
    IF p_profile_id IS NULL OR p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'Profile and idempotency key are required.';
    END IF;
    IF v_direction IS NULL OR v_direction NOT IN ('credit', 'debit') THEN
        RAISE EXCEPTION 'Direction must be credit or debit.';
    END IF;
    IF p_amount IS NULL OR p_amount <= 0 OR p_amount <> round(p_amount, 2) THEN
        RAISE EXCEPTION 'Amount must be positive and have at most two decimal places.';
    END IF;
    IF v_currency !~ '^[A-Z]{3}$' THEN
        RAISE EXCEPTION 'Currency must be a three-letter uppercase code.';
    END IF;
    IF v_category IS NULL OR v_category NOT IN ('top_up', 'purchase', 'subscription', 'course_purchase', 'mentor_booking', 'refund', 'adjustment', 'payout', 'other') THEN
        RAISE EXCEPTION 'Invalid wallet transaction category.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles AS p WHERE p.id = p_profile_id) THEN
        RAISE EXCEPTION 'Profile does not exist.';
    END IF;

    SELECT * INTO v_existing
    FROM public.wallet_transactions AS wt
    WHERE wt.profile_id = p_profile_id
      AND wt.idempotency_key = p_idempotency_key;
    IF FOUND THEN
        IF v_existing.direction IS DISTINCT FROM v_direction
           OR v_existing.amount IS DISTINCT FROM p_amount
           OR v_existing.currency IS DISTINCT FROM v_currency
           OR v_existing.category IS DISTINCT FROM v_category
           OR v_existing.external_reference IS DISTINCT FROM p_external_reference THEN
            RAISE EXCEPTION 'Idempotency key has already been used for a different wallet transaction.';
        END IF;
        RETURN v_existing.id;
    END IF;

    INSERT INTO public.wallet_accounts (profile_id, currency)
    VALUES (p_profile_id, v_currency)
    ON CONFLICT (profile_id, currency) DO NOTHING;

    SELECT wa.id, wa.available_balance, wa.status
      INTO v_account_id, v_balance, v_account_status
    FROM public.wallet_accounts AS wa
    WHERE wa.profile_id = p_profile_id
      AND wa.currency = v_currency
    FOR UPDATE;

    IF v_account_status <> 'active' THEN
        RAISE EXCEPTION 'Wallet account is not active.';
    END IF;

    IF v_direction = 'debit' AND v_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient wallet balance.';
    END IF;

    v_new_balance := CASE WHEN v_direction = 'credit' THEN v_balance + p_amount ELSE v_balance - p_amount END;

    INSERT INTO public.wallet_transactions (
        wallet_account_id, profile_id, direction, amount, currency, category,
        idempotency_key, external_reference, description, balance_after, created_by
    ) VALUES (
        v_account_id, p_profile_id, v_direction, p_amount, v_currency, v_category,
        p_idempotency_key, p_external_reference, COALESCE(p_description, ''), v_new_balance, auth.uid()
    ) RETURNING id INTO v_transaction_id;

    UPDATE public.wallet_accounts
    SET available_balance = v_new_balance
    WHERE id = v_account_id;

    RETURN v_transaction_id;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.post_smartnekam_wallet_transaction(UUID, TEXT, NUMERIC, TEXT, TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_smartnekam_wallet_transaction(UUID, TEXT, NUMERIC, TEXT, TEXT, UUID, TEXT, TEXT) TO service_role;

-- -----------------------------------------------------------------------------
-- 6. Certificates with limited public QR verification
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_code TEXT NOT NULL UNIQUE DEFAULT ('SNK-' || pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(gen_random_uuid()::text, '-', ''), 1, 16))),
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    title VARCHAR(200) NOT NULL,
    certificate_type VARCHAR(32) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    issuer_name VARCHAR(160) NOT NULL DEFAULT 'SmartNekam',
    course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
    opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
    achievement_id UUID REFERENCES public.achievements(id) ON DELETE SET NULL,
    artifact_path TEXT,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    revoke_reason TEXT,
    created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT certificates_code_format CHECK (certificate_code ~ '^SNK-[A-F0-9]{16}$'),
    CONSTRAINT certificates_title_not_blank CHECK (length(btrim(title)) > 0),
    CONSTRAINT certificates_type_check CHECK (certificate_type IN ('course_completion', 'competition', 'achievement', 'mentor', 'other')),
    CONSTRAINT certificates_issuer_not_blank CHECK (length(btrim(issuer_name)) > 0),
    CONSTRAINT certificates_status_check CHECK (status IN ('active', 'revoked')),
    CONSTRAINT certificates_dates_check CHECK (expires_at IS NULL OR expires_at > issued_at),
    CONSTRAINT certificates_revocation_check CHECK ((status = 'active' AND revoked_at IS NULL) OR (status = 'revoked' AND revoked_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS certificates_recipient_issued_idx
    ON public.certificates (recipient_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS certificates_course_idx
    ON public.certificates (course_id) WHERE course_id IS NOT NULL;

-- The QR verifier reveals only certificate-level information, not contact details or files.
CREATE OR REPLACE FUNCTION public.verify_smartnekam_certificate(p_code TEXT)
RETURNS TABLE (
    is_valid BOOLEAN,
    certificate_code TEXT,
    holder_name TEXT,
    certificate_title TEXT,
    certificate_type TEXT,
    issuer_name TEXT,
    issued_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    verification_result TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_certificate public.certificates%ROWTYPE;
    v_holder_name TEXT;
BEGIN
    IF p_code IS NULL OR pg_catalog.length(pg_catalog.btrim(p_code)) = 0 THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT,
                            NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, 'not_found'::TEXT;
        RETURN;
    END IF;

    SELECT c.* INTO v_certificate
    FROM public.certificates AS c
    WHERE c.certificate_code = pg_catalog.upper(pg_catalog.btrim(p_code))
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT,
                            NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, 'not_found'::TEXT;
        RETURN;
    END IF;

    SELECT p.full_name INTO v_holder_name
    FROM public.profiles AS p
    WHERE p.id = v_certificate.recipient_id;

    RETURN QUERY SELECT
        (v_certificate.status = 'active' AND (v_certificate.expires_at IS NULL OR v_certificate.expires_at >= pg_catalog.now())),
        v_certificate.certificate_code,
        v_holder_name,
        v_certificate.title::TEXT,
        v_certificate.certificate_type::TEXT,
        v_certificate.issuer_name::TEXT,
        v_certificate.issued_at,
        v_certificate.expires_at,
        CASE
            WHEN v_certificate.status = 'revoked' THEN 'revoked'
            WHEN v_certificate.expires_at IS NOT NULL AND v_certificate.expires_at < pg_catalog.now() THEN 'expired'
            ELSE 'valid'
        END;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.verify_smartnekam_certificate(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_smartnekam_certificate(TEXT) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7. Trusted subscription operations
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_smartnekam_subscription_payment_request(
    p_plan_id UUID,
    p_provider TEXT,
    p_idempotency_key UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_profile_id UUID := auth.uid();
    v_provider TEXT := pg_catalog.lower(pg_catalog.btrim(p_provider));
    v_plan public.subscription_plans%ROWTYPE;
    v_existing public.payment_transactions%ROWTYPE;
    v_existing_plan_id UUID;
    v_subscription_id UUID;
    v_payment_id UUID;
BEGIN
    IF v_profile_id IS NULL THEN
        RAISE EXCEPTION 'You must be signed in to start a subscription.';
    END IF;
    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'An idempotency key is required.';
    END IF;
    IF v_provider IS NULL OR v_provider NOT IN ('mpesa', 'tigopesa', 'airtel_money', 'stripe', 'bank_transfer') THEN
        RAISE EXCEPTION 'Unsupported payment provider.';
    END IF;

    SELECT sp.* INTO v_plan
    FROM public.subscription_plans AS sp
    WHERE sp.id = p_plan_id AND sp.is_active = TRUE
    FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Subscription plan was not found or is inactive.';
    END IF;
    IF v_plan.price <= 0 THEN
        RAISE EXCEPTION 'Free plans do not require a payment request.';
    END IF;

    SELECT pt.* INTO v_existing
    FROM public.payment_transactions AS pt
    WHERE pt.profile_id = v_profile_id
      AND pt.idempotency_key = p_idempotency_key;
    IF FOUND THEN
        SELECT us.plan_id INTO v_existing_plan_id
        FROM public.user_subscriptions AS us
        WHERE us.id = v_existing.subscription_id;
        IF v_existing.transaction_type IS DISTINCT FROM 'subscription'
           OR v_existing.provider IS DISTINCT FROM v_provider
           OR v_existing.amount IS DISTINCT FROM v_plan.price
           OR v_existing.currency IS DISTINCT FROM v_plan.currency
           OR v_existing_plan_id IS DISTINCT FROM p_plan_id THEN
            RAISE EXCEPTION 'Idempotency key has already been used for a different request.';
        END IF;
        RETURN v_existing.id;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.user_subscriptions AS us
        WHERE us.profile_id = v_profile_id
          AND us.status IN ('active', 'trialing')
    ) THEN
        RAISE EXCEPTION 'An active subscription already exists for this account.';
    END IF;

    INSERT INTO public.user_subscriptions (profile_id, plan_id, status)
    VALUES (v_profile_id, p_plan_id, 'pending_payment')
    RETURNING id INTO v_subscription_id;

    INSERT INTO public.payment_transactions (
        profile_id, subscription_id, transaction_type, provider, status,
        amount, currency, idempotency_key, description
    ) VALUES (
        v_profile_id, v_subscription_id, 'subscription', v_provider, 'pending',
        v_plan.price, v_plan.currency, p_idempotency_key,
        'SmartNekam subscription: ' || v_plan.name
    ) RETURNING id INTO v_payment_id;

    RETURN v_payment_id;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.create_smartnekam_subscription_payment_request(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_smartnekam_subscription_payment_request(UUID, TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.start_smartnekam_free_subscription(p_plan_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_profile_id UUID := auth.uid();
    v_plan public.subscription_plans%ROWTYPE;
    v_subscription_id UUID;
    v_started_at TIMESTAMPTZ := pg_catalog.now();
    v_period_end TIMESTAMPTZ;
BEGIN
    IF v_profile_id IS NULL THEN
        RAISE EXCEPTION 'You must be signed in to start a subscription.';
    END IF;

    SELECT sp.* INTO v_plan
    FROM public.subscription_plans AS sp
    WHERE sp.id = p_plan_id AND sp.is_active = TRUE
    FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Subscription plan was not found or is inactive.';
    END IF;
    IF v_plan.price <> 0 THEN
        RAISE EXCEPTION 'This plan is not free.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.user_subscriptions AS us
        WHERE us.profile_id = v_profile_id AND us.status IN ('active', 'trialing')
    ) THEN
        RAISE EXCEPTION 'An active subscription already exists for this account.';
    END IF;

    v_period_end := CASE v_plan.billing_interval
        WHEN 'monthly' THEN v_started_at + INTERVAL '1 month'
        WHEN 'quarterly' THEN v_started_at + INTERVAL '3 months'
        WHEN 'annual' THEN v_started_at + INTERVAL '1 year'
        ELSE NULL
    END;

    INSERT INTO public.user_subscriptions (
        profile_id, plan_id, status, current_period_start, current_period_end, started_at
    ) VALUES (
        v_profile_id, p_plan_id, 'active', v_started_at, v_period_end, v_started_at
    ) RETURNING id INTO v_subscription_id;

    RETURN v_subscription_id;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.start_smartnekam_free_subscription(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_smartnekam_free_subscription(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_smartnekam_subscription_cancellation(p_subscription_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_profile_id UUID := auth.uid();
    v_subscription_id UUID;
BEGIN
    IF v_profile_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    UPDATE public.user_subscriptions AS us
    SET cancel_at_period_end = TRUE
    WHERE us.id = p_subscription_id
      AND us.profile_id = v_profile_id
      AND us.status IN ('active', 'trialing')
    RETURNING us.id INTO v_subscription_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active subscription not found for this account.';
    END IF;
    RETURN TRUE;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.request_smartnekam_subscription_cancellation(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_smartnekam_subscription_cancellation(UUID) TO authenticated;

-- Trusted finalizer; only service_role may report a verified provider result.
-- It must be called by a server-side payment webhook/Edge Function after provider verification.
CREATE OR REPLACE FUNCTION public.finalize_smartnekam_payment(
    p_payment_id UUID,
    p_provider_result TEXT,
    p_provider_reference TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_payment public.payment_transactions%ROWTYPE;
    v_subscription public.user_subscriptions%ROWTYPE;
    v_interval TEXT;
    v_period_start TIMESTAMPTZ;
    v_period_end TIMESTAMPTZ;
BEGIN
    IF p_provider_result NOT IN ('succeeded', 'failed', 'cancelled') THEN
        RAISE EXCEPTION 'Provider result must be succeeded, failed, or cancelled.';
    END IF;

    SELECT pt.* INTO v_payment
    FROM public.payment_transactions AS pt
    WHERE pt.id = p_payment_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment transaction not found.';
    END IF;

    -- Duplicate successful callbacks must not extend a subscription or credit a wallet twice.
    IF v_payment.status = 'succeeded' AND p_provider_result = 'succeeded' THEN
        IF p_provider_reference IS NOT NULL
           AND v_payment.provider_reference IS NOT NULL
           AND v_payment.provider_reference IS DISTINCT FROM p_provider_reference THEN
            RAISE EXCEPTION 'Provider reference does not match the already completed payment.';
        END IF;
        RETURN TRUE;
    END IF;
    IF v_payment.status = 'refunded' THEN
        RAISE EXCEPTION 'A refunded payment cannot be finalized again.';
    END IF;

    UPDATE public.payment_transactions AS pt
    SET status = p_provider_result,
        provider_reference = COALESCE(p_provider_reference, pt.provider_reference),
        paid_at = CASE WHEN p_provider_result = 'succeeded' THEN COALESCE(pt.paid_at, pg_catalog.now()) ELSE pt.paid_at END
    WHERE pt.id = p_payment_id;

    IF v_payment.transaction_type = 'subscription' AND v_payment.subscription_id IS NOT NULL THEN
        SELECT us.* INTO v_subscription
        FROM public.user_subscriptions AS us
        WHERE us.id = v_payment.subscription_id
        FOR UPDATE;

        IF p_provider_result = 'succeeded' THEN
            SELECT sp.billing_interval INTO v_interval
            FROM public.subscription_plans AS sp
            WHERE sp.id = v_subscription.plan_id;
            v_period_start := COALESCE(v_subscription.current_period_start, pg_catalog.now());
            v_period_end := CASE v_interval
                WHEN 'monthly' THEN v_period_start + INTERVAL '1 month'
                WHEN 'quarterly' THEN v_period_start + INTERVAL '3 months'
                WHEN 'annual' THEN v_period_start + INTERVAL '1 year'
                ELSE NULL
            END;
            UPDATE public.user_subscriptions
            SET status = 'active',
                current_period_start = v_period_start,
                current_period_end = v_period_end,
                started_at = COALESCE(started_at, v_period_start),
                ended_at = NULL
            WHERE id = v_subscription.id;
        ELSIF p_provider_result = 'cancelled' THEN
            UPDATE public.user_subscriptions
            SET status = 'cancelled', ended_at = pg_catalog.now()
            WHERE id = v_subscription.id AND status = 'pending_payment';
        ELSE
            UPDATE public.user_subscriptions
            SET status = 'expired', ended_at = pg_catalog.now()
            WHERE id = v_subscription.id AND status = 'pending_payment';
        END IF;
    ELSIF v_payment.transaction_type = 'wallet_topup' AND p_provider_result = 'succeeded' THEN
        PERFORM public.post_smartnekam_wallet_transaction(
            v_payment.profile_id,
            'credit',
            v_payment.amount,
            v_payment.currency::TEXT,
            'top_up',
            v_payment.id,
            'payment:' || v_payment.id::TEXT,
            'Wallet top-up via ' || v_payment.provider
        );
    END IF;

    RETURN TRUE;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.finalize_smartnekam_payment(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_smartnekam_payment(UUID, TEXT, TEXT) TO service_role;

-- -----------------------------------------------------------------------------
-- 8. Private certificate artifact bucket
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'smartnekam-certificates',
    'smartnekam-certificates',
    FALSE,
    10485760,
    ARRAY['application/pdf', 'image/png', 'image/jpeg']::TEXT[]
)
ON CONFLICT (id) DO UPDATE
SET public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS smartnekam_cert_files_select_owner_or_moderator ON storage.objects;
CREATE POLICY smartnekam_cert_files_select_owner_or_moderator
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'smartnekam-certificates'
    AND (
        (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
        OR public.is_smartnekam_moderator()
    )
);

DROP POLICY IF EXISTS smartnekam_cert_files_insert_moderator ON storage.objects;
CREATE POLICY smartnekam_cert_files_insert_moderator
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'smartnekam-certificates'
    AND public.is_smartnekam_moderator()
    AND EXISTS (
        SELECT 1
        FROM public.certificates AS c
        WHERE c.id::TEXT = (storage.foldername(name))[2]
          AND c.recipient_id::TEXT = (storage.foldername(name))[1]
    )
);

DROP POLICY IF EXISTS smartnekam_cert_files_update_moderator ON storage.objects;
CREATE POLICY smartnekam_cert_files_update_moderator
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'smartnekam-certificates' AND public.is_smartnekam_moderator())
WITH CHECK (bucket_id = 'smartnekam-certificates' AND public.is_smartnekam_moderator());

DROP POLICY IF EXISTS smartnekam_cert_files_delete_moderator ON storage.objects;
CREATE POLICY smartnekam_cert_files_delete_moderator
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'smartnekam-certificates' AND public.is_smartnekam_moderator());

-- -----------------------------------------------------------------------------
-- 9. Row Level Security and table grants
-- -----------------------------------------------------------------------------
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_provider_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_plans_public_active_read ON public.subscription_plans;
CREATE POLICY subscription_plans_public_active_read
ON public.subscription_plans FOR SELECT TO anon, authenticated
USING (is_active = TRUE);
DROP POLICY IF EXISTS subscription_plans_moderator_read_all ON public.subscription_plans;
CREATE POLICY subscription_plans_moderator_read_all
ON public.subscription_plans FOR SELECT TO authenticated
USING (public.is_smartnekam_moderator());
DROP POLICY IF EXISTS subscription_plans_moderator_insert ON public.subscription_plans;
CREATE POLICY subscription_plans_moderator_insert
ON public.subscription_plans FOR INSERT TO authenticated
WITH CHECK (public.is_smartnekam_moderator() AND (created_by IS NULL OR created_by = (SELECT auth.uid())));
DROP POLICY IF EXISTS subscription_plans_moderator_update ON public.subscription_plans;
CREATE POLICY subscription_plans_moderator_update
ON public.subscription_plans FOR UPDATE TO authenticated
USING (public.is_smartnekam_moderator())
WITH CHECK (public.is_smartnekam_moderator());

DROP POLICY IF EXISTS user_subscriptions_select_own_or_billing_admin ON public.user_subscriptions;
CREATE POLICY user_subscriptions_select_own_or_billing_admin
ON public.user_subscriptions FOR SELECT TO authenticated
USING (profile_id = (SELECT auth.uid()) OR public.is_smartnekam_billing_admin());

DROP POLICY IF EXISTS payment_transactions_select_own_or_billing_admin ON public.payment_transactions;
CREATE POLICY payment_transactions_select_own_or_billing_admin
ON public.payment_transactions FOR SELECT TO authenticated
USING (profile_id = (SELECT auth.uid()) OR public.is_smartnekam_billing_admin());

DROP POLICY IF EXISTS wallet_accounts_select_own ON public.wallet_accounts;
CREATE POLICY wallet_accounts_select_own
ON public.wallet_accounts FOR SELECT TO authenticated
USING (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS wallet_transactions_select_own ON public.wallet_transactions;
CREATE POLICY wallet_transactions_select_own
ON public.wallet_transactions FOR SELECT TO authenticated
USING (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS certificates_select_recipient_or_moderator ON public.certificates;
CREATE POLICY certificates_select_recipient_or_moderator
ON public.certificates FOR SELECT TO authenticated
USING (recipient_id = (SELECT auth.uid()) OR public.is_smartnekam_moderator());
DROP POLICY IF EXISTS certificates_insert_moderator ON public.certificates;
CREATE POLICY certificates_insert_moderator
ON public.certificates FOR INSERT TO authenticated
WITH CHECK (public.is_smartnekam_moderator() AND created_by = (SELECT auth.uid()));
DROP POLICY IF EXISTS certificates_update_moderator ON public.certificates;
CREATE POLICY certificates_update_moderator
ON public.certificates FOR UPDATE TO authenticated
USING (public.is_smartnekam_moderator())
WITH CHECK (public.is_smartnekam_moderator());

REVOKE ALL PRIVILEGES ON TABLE public.subscription_plans FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.user_subscriptions FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.payment_transactions FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.payment_provider_events FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.wallet_accounts FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.wallet_transactions FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.certificates FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.subscription_plans TO anon, authenticated;
GRANT INSERT, UPDATE ON TABLE public.subscription_plans TO authenticated;
GRANT SELECT ON TABLE public.user_subscriptions TO authenticated;
GRANT SELECT ON TABLE public.payment_transactions TO authenticated;
GRANT SELECT ON TABLE public.wallet_accounts TO authenticated;
GRANT SELECT ON TABLE public.wallet_transactions TO authenticated;
GRANT SELECT ON TABLE public.certificates TO authenticated;
GRANT INSERT ON TABLE public.certificates TO authenticated;
GRANT UPDATE (status, revoked_at, revoked_by, revoke_reason) ON TABLE public.certificates TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.payment_provider_events TO service_role;

COMMIT;

-- Expected result: Success. No rows returned.
-- Verification query to run separately after successful execution:
-- SELECT to_regclass('public.subscription_plans'), to_regclass('public.user_subscriptions'),
--        to_regclass('public.payment_transactions'), to_regclass('public.payment_provider_events'),
--        to_regclass('public.wallet_accounts'), to_regclass('public.wallet_transactions'),
--        to_regclass('public.certificates');

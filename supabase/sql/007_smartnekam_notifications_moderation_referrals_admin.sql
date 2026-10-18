-- SmartNekam | SQL 007: Notifications, Moderation, Referrals and Admin Controls
-- Prerequisites: SQL 001A, 001B, 002, 003, 004 FIXED, 005 and 006 ran successfully.
-- Run the ENTIRE file in Supabase Dashboard > SQL Editor > New query.
-- Re-runnable during development: does not drop existing tables or user data.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Referral-code generation for new and existing profiles
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.smartnekam_assign_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_code text;
BEGIN
    IF NEW.referral_code IS NOT NULL AND pg_catalog.length(pg_catalog.btrim(NEW.referral_code)) > 0 THEN
        NEW.referral_code := pg_catalog.upper(pg_catalog.btrim(NEW.referral_code));
        RETURN NEW;
    END IF;

    LOOP
        v_code := pg_catalog.upper(
            pg_catalog.substr(
                pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
                1,
                10
            )
        );
        EXIT WHEN NOT EXISTS (
            SELECT 1
            FROM public.profiles AS p
            WHERE p.referral_code = v_code
              AND p.id IS DISTINCT FROM NEW.id
        );
    END LOOP;

    NEW.referral_code := v_code;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS profiles_referral_code_on_insert ON public.profiles;
CREATE TRIGGER profiles_referral_code_on_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.smartnekam_assign_referral_code();

DROP TRIGGER IF EXISTS profiles_referral_code_on_update ON public.profiles;
CREATE TRIGGER profiles_referral_code_on_update
BEFORE UPDATE OF referral_code ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.smartnekam_assign_referral_code();

-- Backfill referral codes for profiles that already existed before this migration.
UPDATE public.profiles
SET referral_code = NULL
WHERE referral_code IS NULL;

-- -----------------------------------------------------------------------------
-- 2. In-app notifications
-- Delivery to email/push requires a later Edge Function/provider integration.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title VARCHAR(180) NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    notification_type VARCHAR(32) NOT NULL DEFAULT 'system',
    data JSONB NOT NULL DEFAULT '{}'::JSONB,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    CONSTRAINT notifications_type_check CHECK (
        notification_type IN (
            'system', 'announcement', 'content_review', 'deadline', 'application',
            'chat', 'mentor', 'community', 'achievement', 'referral', 'security'
        )
    ),
    CONSTRAINT notifications_data_object_check CHECK (jsonb_typeof(data) = 'object'),
    CONSTRAINT notifications_title_not_blank CHECK (length(btrim(title)) > 0)
);
CREATE INDEX IF NOT EXISTS notifications_user_feed_idx
    ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx
    ON public.notifications (user_id, created_at DESC)
    WHERE is_read = FALSE;

CREATE TABLE IF NOT EXISTS public.notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    deadline_reminders BOOLEAN NOT NULL DEFAULT TRUE,
    learning_reminders BOOLEAN NOT NULL DEFAULT TRUE,
    opportunity_updates BOOLEAN NOT NULL DEFAULT TRUE,
    community_updates BOOLEAN NOT NULL DEFAULT TRUE,
    marketing_updates BOOLEAN NOT NULL DEFAULT FALSE,
    language VARCHAR(2) NOT NULL DEFAULT 'sw',
    timezone VARCHAR(80) NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT notification_preferences_language_check CHECK (language IN ('sw', 'en'))
);

DROP TRIGGER IF EXISTS notification_preferences_set_updated_at ON public.notification_preferences;
CREATE TRIGGER notification_preferences_set_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Push provider tokens are private to the owner; actual delivery is handled later.
CREATE TABLE IF NOT EXISTS public.push_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    platform VARCHAR(16) NOT NULL,
    device_token TEXT NOT NULL UNIQUE,
    device_label VARCHAR(120),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT push_devices_platform_check CHECK (platform IN ('web', 'android', 'ios')),
    CONSTRAINT push_devices_token_not_blank CHECK (length(btrim(device_token)) > 0)
);
CREATE INDEX IF NOT EXISTS push_devices_user_active_idx
    ON public.push_devices (user_id, is_active);

-- -----------------------------------------------------------------------------
-- 3. Content/user reports and moderation tracking
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_type VARCHAR(32) NOT NULL,
    target_id UUID NOT NULL,
    reason_category VARCHAR(24) NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    moderator_note TEXT,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    CONSTRAINT content_reports_target_type_check CHECK (
        target_type IN (
            'user', 'note', 'past_paper', 'study_group', 'group_post', 'group_message',
            'question', 'question_comment', 'answer', 'opportunity', 'mentor',
            'chat_message', 'live_session', 'community_event'
        )
    ),
    CONSTRAINT content_reports_reason_check CHECK (
        reason_category IN ('spam', 'scam', 'harassment', 'misinformation', 'copyright', 'inappropriate', 'other')
    ),
    CONSTRAINT content_reports_status_check CHECK (
        status IN ('open', 'investigating', 'resolved', 'dismissed')
    ),
    CONSTRAINT content_reports_details_length_check CHECK (length(details) <= 4000)
);
CREATE INDEX IF NOT EXISTS content_reports_queue_idx
    ON public.content_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS content_reports_reporter_idx
    ON public.content_reports (reporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS content_reports_target_idx
    ON public.content_reports (target_type, target_id);
CREATE UNIQUE INDEX IF NOT EXISTS content_reports_one_open_per_reporter_target_idx
    ON public.content_reports (reporter_id, target_type, target_id)
    WHERE status IN ('open', 'investigating');

DROP TRIGGER IF EXISTS content_reports_set_updated_at ON public.content_reports;
CREATE TRIGGER content_reports_set_updated_at
BEFORE UPDATE ON public.content_reports
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Referral application and rewards
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    referred_user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    referral_code_used VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    reward_xp INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    CONSTRAINT referral_events_no_self_referral CHECK (referrer_id <> referred_user_id),
    CONSTRAINT referral_events_status_check CHECK (status IN ('pending', 'rewarded', 'rejected')),
    CONSTRAINT referral_events_reward_xp_check CHECK (reward_xp >= 0)
);
CREATE INDEX IF NOT EXISTS referral_events_referrer_idx
    ON public.referral_events (referrer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS referral_events_status_idx
    ON public.referral_events (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.apply_referral_code(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_referrer_id UUID;
    v_existing_referrer UUID;
    v_event_id UUID;
    v_code TEXT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'You must be signed in to apply a referral code.';
    END IF;

    v_code := pg_catalog.upper(pg_catalog.btrim(COALESCE(p_code, '')));
    IF v_code = '' THEN
        RAISE EXCEPTION 'Enter a referral code.';
    END IF;

    SELECT p.id INTO v_referrer_id
    FROM public.profiles AS p
    WHERE p.referral_code = v_code
      AND p.status = 'active';

    IF v_referrer_id IS NULL THEN
        RAISE EXCEPTION 'This referral code is invalid or inactive.';
    END IF;
    IF v_referrer_id = v_uid THEN
        RAISE EXCEPTION 'You cannot apply your own referral code.';
    END IF;

    SELECT p.referred_by INTO v_existing_referrer
    FROM public.profiles AS p
    WHERE p.id = v_uid
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Your SmartNekam profile was not found.';
    END IF;
    IF v_existing_referrer IS NOT NULL THEN
        RAISE EXCEPTION 'A referral code has already been applied to this account.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.referral_events AS r WHERE r.referred_user_id = v_uid) THEN
        RAISE EXCEPTION 'A referral has already been recorded for this account.';
    END IF;

    UPDATE public.profiles
    SET referred_by = v_referrer_id
    WHERE id = v_uid AND referred_by IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'A referral code could not be applied to this account.';
    END IF;

    INSERT INTO public.referral_events (referrer_id, referred_user_id, referral_code_used)
    VALUES (v_referrer_id, v_uid, v_code)
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$function$;

-- -----------------------------------------------------------------------------
-- 5. Audit log for sensitive admin actions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action_name VARCHAR(80) NOT NULL,
    entity_type VARCHAR(48) NOT NULL,
    entity_id UUID,
    details JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT admin_audit_log_details_object_check CHECK (jsonb_typeof(details) = 'object'),
    CONSTRAINT admin_audit_log_action_not_blank CHECK (length(btrim(action_name)) > 0)
);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx
    ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_actor_idx
    ON public.admin_audit_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_entity_idx
    ON public.admin_audit_log (entity_type, entity_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 6. RLS and least-privilege grants
-- -----------------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own
ON public.notifications FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS notifications_update_read_state_own ON public.notifications;
CREATE POLICY notifications_update_read_state_own
ON public.notifications FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS notification_preferences_select_own ON public.notification_preferences;
CREATE POLICY notification_preferences_select_own
ON public.notification_preferences FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS notification_preferences_insert_own ON public.notification_preferences;
CREATE POLICY notification_preferences_insert_own
ON public.notification_preferences FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS notification_preferences_update_own ON public.notification_preferences;
CREATE POLICY notification_preferences_update_own
ON public.notification_preferences FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS notification_preferences_delete_own ON public.notification_preferences;
CREATE POLICY notification_preferences_delete_own
ON public.notification_preferences FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS push_devices_select_own ON public.push_devices;
CREATE POLICY push_devices_select_own
ON public.push_devices FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS push_devices_insert_own ON public.push_devices;
CREATE POLICY push_devices_insert_own
ON public.push_devices FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS push_devices_update_own ON public.push_devices;
CREATE POLICY push_devices_update_own
ON public.push_devices FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS push_devices_delete_own ON public.push_devices;
CREATE POLICY push_devices_delete_own
ON public.push_devices FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS content_reports_insert_own ON public.content_reports;
CREATE POLICY content_reports_insert_own
ON public.content_reports FOR INSERT TO authenticated
WITH CHECK (reporter_id = (SELECT auth.uid()) AND status = 'open');
DROP POLICY IF EXISTS content_reports_select_own ON public.content_reports;
CREATE POLICY content_reports_select_own
ON public.content_reports FOR SELECT TO authenticated
USING (reporter_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS content_reports_select_moderators ON public.content_reports;
CREATE POLICY content_reports_select_moderators
ON public.content_reports FOR SELECT TO authenticated
USING (public.is_smartnekam_moderator());

DROP POLICY IF EXISTS referral_events_select_participants ON public.referral_events;
CREATE POLICY referral_events_select_participants
ON public.referral_events FOR SELECT TO authenticated
USING (
    referrer_id = (SELECT auth.uid())
    OR referred_user_id = (SELECT auth.uid())
    OR public.is_smartnekam_moderator()
);

DROP POLICY IF EXISTS admin_audit_log_select_moderators ON public.admin_audit_log;
CREATE POLICY admin_audit_log_select_moderators
ON public.admin_audit_log FOR SELECT TO authenticated
USING (public.is_smartnekam_moderator());

REVOKE ALL PRIVILEGES ON TABLE public.notifications FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.notification_preferences FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.push_devices FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.content_reports FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.referral_events FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.admin_audit_log FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.notifications TO authenticated;
GRANT UPDATE (is_read, read_at) ON TABLE public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notification_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_devices TO authenticated;
GRANT SELECT ON TABLE public.content_reports TO authenticated;
GRANT INSERT (reporter_id, target_type, target_id, reason_category, details)
    ON TABLE public.content_reports TO authenticated;
GRANT SELECT ON TABLE public.referral_events TO authenticated;
GRANT SELECT ON TABLE public.admin_audit_log TO authenticated;

-- The Supabase service_role is for trusted server-side code only. Never expose its key in a browser.
GRANT ALL PRIVILEGES ON TABLE public.notifications, public.notification_preferences,
    public.push_devices, public.content_reports, public.referral_events, public.admin_audit_log
TO service_role;

-- -----------------------------------------------------------------------------
-- 7. Trusted admin functions
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_create_notification(
    p_user_id UUID,
    p_title TEXT,
    p_body TEXT,
    p_notification_type TEXT DEFAULT 'system',
    p_data JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_actor UUID := (SELECT auth.uid());
    v_notification_id UUID;
BEGIN
    IF v_actor IS NULL OR NOT public.is_smartnekam_moderator() THEN
        RAISE EXCEPTION 'Only an active SmartNekam moderator can create administrative notifications.';
    END IF;
    IF p_title IS NULL OR pg_catalog.length(pg_catalog.btrim(p_title)) = 0 THEN
        RAISE EXCEPTION 'Notification title is required.';
    END IF;
    IF p_notification_type NOT IN (
        'system', 'announcement', 'content_review', 'deadline', 'application',
        'chat', 'mentor', 'community', 'achievement', 'referral', 'security'
    ) THEN
        RAISE EXCEPTION 'Unsupported notification type.';
    END IF;
    IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' THEN
        RAISE EXCEPTION 'Notification data must be a JSON object.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles AS p WHERE p.id = p_user_id AND p.status = 'active') THEN
        RAISE EXCEPTION 'Active recipient profile not found.';
    END IF;

    INSERT INTO public.notifications (user_id, title, body, notification_type, data)
    VALUES (p_user_id, pg_catalog.btrim(p_title), COALESCE(p_body, ''), p_notification_type, p_data)
    RETURNING id INTO v_notification_id;

    INSERT INTO public.admin_audit_log (actor_id, action_name, entity_type, entity_id, details)
    VALUES (
        v_actor, 'create_notification', 'notification', v_notification_id,
        jsonb_build_object('recipient_id', p_user_id, 'notification_type', p_notification_type)
    );

    RETURN v_notification_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.review_content_report(
    p_report_id UUID,
    p_decision TEXT,
    p_moderator_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_actor UUID := (SELECT auth.uid());
    v_old_status TEXT;
BEGIN
    IF v_actor IS NULL OR NOT public.is_smartnekam_moderator() THEN
        RAISE EXCEPTION 'Only an active SmartNekam moderator can review reports.';
    END IF;
    IF p_decision IS NULL OR p_decision NOT IN ('investigating', 'resolved', 'dismissed') THEN
        RAISE EXCEPTION 'Decision must be investigating, resolved, or dismissed.';
    END IF;

    SELECT r.status INTO v_old_status
    FROM public.content_reports AS r
    WHERE r.id = p_report_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Report not found.';
    END IF;

    UPDATE public.content_reports
    SET status = p_decision,
        moderator_note = p_moderator_note,
        assigned_to = COALESCE(assigned_to, v_actor),
        reviewed_by = CASE WHEN p_decision IN ('resolved', 'dismissed') THEN v_actor ELSE reviewed_by END,
        reviewed_at = CASE WHEN p_decision IN ('resolved', 'dismissed') THEN pg_catalog.now() ELSE reviewed_at END
    WHERE id = p_report_id;

    INSERT INTO public.admin_audit_log (actor_id, action_name, entity_type, entity_id, details)
    VALUES (
        v_actor, 'review_content_report', 'content_report', p_report_id,
        jsonb_build_object('previous_status', v_old_status, 'decision', p_decision)
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.review_library_content(
    p_content_type TEXT,
    p_content_id UUID,
    p_decision TEXT,
    p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_actor UUID := (SELECT auth.uid());
    v_found_id UUID;
    v_status TEXT;
BEGIN
    IF v_actor IS NULL OR NOT public.is_smartnekam_moderator() THEN
        RAISE EXCEPTION 'Only an active SmartNekam moderator can review library content.';
    END IF;
    IF p_decision IS NULL OR p_decision NOT IN ('approve', 'reject', 'remove') THEN
        RAISE EXCEPTION 'Decision must be approve, reject, or remove.';
    END IF;

    IF p_content_type = 'note' THEN
        v_status := CASE p_decision WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE 'removed' END;
        UPDATE public.notes
        SET status = v_status,
            reviewed_at = pg_catalog.now(),
            reviewed_by = v_actor,
            rejection_reason = CASE WHEN p_decision = 'reject' THEN p_reason ELSE NULL END
        WHERE id = p_content_id
        RETURNING id INTO v_found_id;
    ELSIF p_content_type = 'past_paper' THEN
        v_status := CASE p_decision WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE 'removed' END;
        UPDATE public.past_papers
        SET status = v_status,
            reviewed_at = pg_catalog.now(),
            reviewed_by = v_actor,
            rejection_reason = CASE WHEN p_decision = 'reject' THEN p_reason ELSE NULL END
        WHERE id = p_content_id
        RETURNING id INTO v_found_id;
    ELSIF p_content_type = 'opportunity' THEN
        v_status := CASE p_decision WHEN 'approve' THEN 'active' WHEN 'reject' THEN 'rejected' ELSE 'closed' END;
        UPDATE public.opportunities
        SET status = v_status,
            verified = (p_decision = 'approve'),
            reviewed_by = v_actor,
            reviewed_at = pg_catalog.now(),
            rejection_reason = CASE WHEN p_decision = 'reject' THEN p_reason ELSE NULL END,
            updated_at = pg_catalog.now()
        WHERE id = p_content_id
        RETURNING id INTO v_found_id;
    ELSE
        RAISE EXCEPTION 'Supported content types are note, past_paper, and opportunity.';
    END IF;

    IF v_found_id IS NULL THEN
        RAISE EXCEPTION 'Content item not found.';
    END IF;

    INSERT INTO public.admin_audit_log (actor_id, action_name, entity_type, entity_id, details)
    VALUES (
        v_actor, 'review_library_content', p_content_type, p_content_id,
        jsonb_build_object('decision', p_decision, 'reason_supplied', (p_reason IS NOT NULL))
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_profile_status(
    p_user_id UUID,
    p_new_status TEXT,
    p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_actor UUID := (SELECT auth.uid());
    v_actor_role TEXT;
    v_target_role TEXT;
    v_old_status TEXT;
BEGIN
    IF v_actor IS NULL OR NOT public.is_smartnekam_moderator() THEN
        RAISE EXCEPTION 'Only an active SmartNekam moderator can change user status.';
    END IF;
    IF p_new_status NOT IN ('active', 'suspended', 'banned') THEN
        RAISE EXCEPTION 'Status must be active, suspended, or banned.';
    END IF;
    IF v_actor = p_user_id AND p_new_status <> 'active' THEN
        RAISE EXCEPTION 'You cannot suspend or ban your own account.';
    END IF;

    SELECT p.role INTO v_actor_role FROM public.profiles AS p WHERE p.id = v_actor;
    SELECT p.role, p.status INTO v_target_role, v_old_status
    FROM public.profiles AS p WHERE p.id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target profile not found.';
    END IF;
    IF v_target_role = 'super_admin' AND v_actor_role <> 'super_admin' THEN
        RAISE EXCEPTION 'Only a super admin can change a super admin account status.';
    END IF;

    UPDATE public.profiles SET status = p_new_status WHERE id = p_user_id;

    INSERT INTO public.admin_audit_log (actor_id, action_name, entity_type, entity_id, details)
    VALUES (
        v_actor, 'change_profile_status', 'profile', p_user_id,
        jsonb_build_object('old_status', v_old_status, 'new_status', p_new_status, 'reason_supplied', (p_reason IS NOT NULL), 'reason', p_reason)
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_profile_role(
    p_user_id UUID,
    p_new_role TEXT,
    p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_actor UUID := (SELECT auth.uid());
    v_actor_role TEXT;
    v_target_role TEXT;
BEGIN
    IF v_actor IS NULL OR NOT public.is_smartnekam_moderator() THEN
        RAISE EXCEPTION 'Only an active SmartNekam moderator can change user roles.';
    END IF;

    SELECT p.role INTO v_actor_role
    FROM public.profiles AS p
    WHERE p.id = v_actor;

    IF v_actor_role <> 'super_admin' THEN
        RAISE EXCEPTION 'Only a super admin can change user roles.';
    END IF;
    IF p_new_role IS NULL OR p_new_role NOT IN (
        'student', 'mentor', 'teacher', 'school_admin', 'parent', 'moderator', 'super_admin'
    ) THEN
        RAISE EXCEPTION 'Unsupported SmartNekam role.';
    END IF;

    SELECT p.role INTO v_target_role
    FROM public.profiles AS p
    WHERE p.id = p_user_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target profile not found.';
    END IF;

    UPDATE public.profiles
    SET role = p_new_role
    WHERE id = p_user_id;

    INSERT INTO public.admin_audit_log (actor_id, action_name, entity_type, entity_id, details)
    VALUES (
        v_actor, 'change_profile_role', 'profile', p_user_id,
        jsonb_build_object('old_role', v_target_role, 'new_role', p_new_role, 'reason', p_reason)
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.review_referral_event(
    p_referral_event_id UUID,
    p_decision TEXT,
    p_reward_xp INTEGER DEFAULT 25,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_actor UUID := (SELECT auth.uid());
    v_event public.referral_events%ROWTYPE;
    v_ledger_id UUID;
BEGIN
    IF v_actor IS NULL OR NOT public.is_smartnekam_moderator() THEN
        RAISE EXCEPTION 'Only an active SmartNekam moderator can review referrals.';
    END IF;
    IF p_decision IS NULL OR p_decision NOT IN ('reward', 'reject') THEN
        RAISE EXCEPTION 'Decision must be reward or reject.';
    END IF;
    IF p_decision = 'reward' AND (p_reward_xp IS NULL OR p_reward_xp < 1 OR p_reward_xp > 1000) THEN
        RAISE EXCEPTION 'Referral reward must be between 1 and 1000 XP.';
    END IF;

    SELECT * INTO v_event
    FROM public.referral_events AS r
    WHERE r.id = p_referral_event_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Referral event not found.';
    END IF;
    IF v_event.status = 'rewarded' THEN
        RETURN; -- Idempotent: never award the same event twice.
    END IF;
    IF v_event.status <> 'pending' THEN
        RAISE EXCEPTION 'Only pending referral events can be reviewed.';
    END IF;

    IF p_decision = 'reject' THEN
        UPDATE public.referral_events
        SET status = 'rejected', reviewed_by = v_actor, reviewed_at = pg_catalog.now(),
            rejection_reason = p_rejection_reason
        WHERE id = p_referral_event_id;
    ELSE
        -- Award the same configured XP to the referrer and the referred student.
        INSERT INTO public.xp_ledger (user_id, source_type, source_id, amount, description)
        VALUES (v_event.referrer_id, 'referral', v_event.id, p_reward_xp, 'SmartNekam referral reward')
        ON CONFLICT (user_id, source_type, source_id) DO NOTHING
        RETURNING id INTO v_ledger_id;
        IF v_ledger_id IS NOT NULL THEN
            UPDATE public.profiles SET xp = xp + p_reward_xp WHERE id = v_event.referrer_id;
        END IF;

        v_ledger_id := NULL;
        INSERT INTO public.xp_ledger (user_id, source_type, source_id, amount, description)
        VALUES (v_event.referred_user_id, 'referral', v_event.id, p_reward_xp, 'Welcome referral reward')
        ON CONFLICT (user_id, source_type, source_id) DO NOTHING
        RETURNING id INTO v_ledger_id;
        IF v_ledger_id IS NOT NULL THEN
            UPDATE public.profiles SET xp = xp + p_reward_xp WHERE id = v_event.referred_user_id;
        END IF;

        UPDATE public.referral_events
        SET status = 'rewarded', reward_xp = p_reward_xp,
            reviewed_by = v_actor, reviewed_at = pg_catalog.now(), rejection_reason = NULL
        WHERE id = p_referral_event_id;
    END IF;

    INSERT INTO public.admin_audit_log (actor_id, action_name, entity_type, entity_id, details)
    VALUES (
        v_actor, 'review_referral_event', 'referral_event', p_referral_event_id,
        jsonb_build_object('decision', p_decision, 'reward_xp_per_user', CASE WHEN p_decision = 'reward' THEN p_reward_xp ELSE 0 END)
    );
END;
$function$;

-- Only trusted triggers may invoke the code generator directly.
REVOKE ALL PRIVILEGES ON FUNCTION public.smartnekam_assign_referral_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.apply_referral_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(TEXT) TO authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.admin_create_notification(UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON FUNCTION public.review_content_report(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON FUNCTION public.review_library_content(TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON FUNCTION public.admin_set_profile_status(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON FUNCTION public.admin_set_profile_role(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON FUNCTION public.review_referral_event(UUID, TEXT, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_notification(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_content_report(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_library_content(TEXT, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_profile_status(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_profile_role(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_referral_event(UUID, TEXT, INTEGER, TEXT) TO authenticated;

GRANT ALL PRIVILEGES ON TABLE public.notifications, public.notification_preferences,
    public.push_devices, public.content_reports, public.referral_events, public.admin_audit_log
TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(TEXT),
    public.admin_create_notification(UUID, TEXT, TEXT, TEXT, JSONB),
    public.review_content_report(UUID, TEXT, TEXT),
    public.review_library_content(TEXT, UUID, TEXT, TEXT),
    public.admin_set_profile_status(UUID, TEXT, TEXT),
    public.admin_set_profile_role(UUID, TEXT, TEXT),
    public.review_referral_event(UUID, TEXT, INTEGER, TEXT)
TO service_role;

COMMIT;

-- Expected result: Success. No rows returned.
-- This migration sets up in-app notifications, reporting/moderation, referral codes
-- and rewards, and admin audit controls. Push/email delivery still needs server-side
-- provider integration (for example an Edge Function) after the database migrations.

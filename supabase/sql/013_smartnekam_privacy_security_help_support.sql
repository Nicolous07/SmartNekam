-- SmartNekam | SQL 013: Privacy, Security, Help & Support
-- Depends on SQL 001A/001B and SQL 007 (profiles, set_updated_at, support/admin roles).
-- Run the ENTIRE file in Supabase Dashboard > SQL Editor > New query.
-- This migration does not delete existing tables or user data.
-- Account deletion/export requests are recorded here; processing/export/deletion workers
-- must be implemented securely in an Edge Function before those actions are operational.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Authorization helper for support/moderation staff
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_smartnekam_support_staff()
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
          AND p.role IN ('moderator', 'super_admin')
          AND p.status = 'active'
    );
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.is_smartnekam_support_staff() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_smartnekam_support_staff() TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. User app preferences (language, appearance, accessibility, data saver)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_app_preferences (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    language_code VARCHAR(5) NOT NULL DEFAULT 'sw',
    theme_mode VARCHAR(12) NOT NULL DEFAULT 'system',
    text_size VARCHAR(16) NOT NULL DEFAULT 'normal',
    reduced_motion BOOLEAN NOT NULL DEFAULT FALSE,
    low_data_mode BOOLEAN NOT NULL DEFAULT FALSE,
    auto_download_over_wifi BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_app_preferences_language_check CHECK (language_code IN ('sw', 'en')),
    CONSTRAINT user_app_preferences_theme_check CHECK (theme_mode IN ('system', 'light', 'dark')),
    CONSTRAINT user_app_preferences_text_size_check CHECK (text_size IN ('normal', 'large', 'extra_large'))
);

DROP TRIGGER IF EXISTS user_app_preferences_set_updated_at ON public.user_app_preferences;
CREATE TRIGGER user_app_preferences_set_updated_at
BEFORE UPDATE ON public.user_app_preferences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. Privacy settings and user blocking
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_privacy_settings (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    profile_visibility VARCHAR(16) NOT NULL DEFAULT 'community',
    show_online_status BOOLEAN NOT NULL DEFAULT FALSE,
    allow_direct_messages VARCHAR(20) NOT NULL DEFAULT 'group_members',
    allow_group_invites BOOLEAN NOT NULL DEFAULT TRUE,
    show_in_leaderboards BOOLEAN NOT NULL DEFAULT TRUE,
    show_academic_details BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_privacy_settings_visibility_check CHECK (
        profile_visibility IN ('public', 'community', 'private')
    ),
    CONSTRAINT user_privacy_settings_dm_check CHECK (
        allow_direct_messages IN ('everyone', 'group_members', 'no_one')
    )
);

DROP TRIGGER IF EXISTS user_privacy_settings_set_updated_at ON public.user_privacy_settings;
CREATE TRIGGER user_privacy_settings_set_updated_at
BEFORE UPDATE ON public.user_privacy_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.user_blocks (
    blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_user_id),
    CONSTRAINT user_blocks_not_self CHECK (blocker_id <> blocked_user_id)
);
CREATE INDEX IF NOT EXISTS user_blocks_blocked_user_idx
    ON public.user_blocks (blocked_user_id, created_at DESC);

-- Direct-message preferences are enforced at both conversation creation and send time.
-- Missing privacy settings default to 'group_members' (shared active study group required).
CREATE OR REPLACE FUNCTION public.can_start_smartnekam_direct_message(p_other_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_user_id UUID := (SELECT auth.uid());
    v_dm_policy TEXT;
BEGIN
    IF v_user_id IS NULL OR p_other_user_id IS NULL OR p_other_user_id = v_user_id THEN
        RETURN FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.profiles AS p
        WHERE p.id = v_user_id AND p.status = 'active'
    ) OR NOT EXISTS (
        SELECT 1 FROM public.profiles AS p
        WHERE p.id = p_other_user_id AND p.status = 'active'
    ) THEN
        RETURN FALSE;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.user_blocks AS b
        WHERE (b.blocker_id = v_user_id AND b.blocked_user_id = p_other_user_id)
           OR (b.blocker_id = p_other_user_id AND b.blocked_user_id = v_user_id)
    ) THEN
        RETURN FALSE;
    END IF;

    SELECT COALESCE(
        (SELECT s.allow_direct_messages
         FROM public.user_privacy_settings AS s
         WHERE s.user_id = p_other_user_id),
        'group_members'
    ) INTO v_dm_policy;

    IF v_dm_policy = 'no_one' THEN
        RETURN FALSE;
    ELSIF v_dm_policy = 'group_members' THEN
        RETURN EXISTS (
            SELECT 1
            FROM public.group_members AS mine
            JOIN public.group_members AS theirs ON theirs.group_id = mine.group_id
            JOIN public.study_groups AS g ON g.id = mine.group_id AND g.status = 'active'
            WHERE mine.user_id = v_user_id
              AND theirs.user_id = p_other_user_id
        );
    END IF;

    RETURN v_dm_policy = 'everyone';
END;
$function$;
REVOKE ALL PRIVILEGES ON FUNCTION public.can_start_smartnekam_direct_message(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.can_send_smartnekam_chat_message(
    p_conversation_id UUID,
    p_sender_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_conversation_type TEXT;
    v_other_user_id UUID;
BEGIN
    IF (SELECT auth.uid()) IS NULL OR p_sender_id IS DISTINCT FROM (SELECT auth.uid()) THEN
        RETURN FALSE;
    END IF;

    SELECT c.conversation_type INTO v_conversation_type
    FROM public.chat_conversations AS c
    WHERE c.id = p_conversation_id AND c.status = 'active';

    IF v_conversation_type IS NULL THEN
        RETURN FALSE;
    ELSIF v_conversation_type = 'direct' THEN
        IF (
            SELECT count(*)
            FROM public.chat_participants AS cp
            WHERE cp.conversation_id = p_conversation_id AND cp.left_at IS NULL
        ) <> 2 THEN
            RETURN FALSE;
        END IF;

        SELECT cp.user_id INTO v_other_user_id
        FROM public.chat_participants AS cp
        WHERE cp.conversation_id = p_conversation_id
          AND cp.user_id <> p_sender_id
          AND cp.left_at IS NULL
        LIMIT 1;

        RETURN v_other_user_id IS NOT NULL
           AND public.can_start_smartnekam_direct_message(v_other_user_id);
    ELSIF v_conversation_type = 'mentor' THEN
        RETURN NOT EXISTS (
            SELECT 1
            FROM public.chat_participants AS cp
            JOIN public.user_blocks AS b
              ON (b.blocker_id = p_sender_id AND b.blocked_user_id = cp.user_id)
              OR (b.blocker_id = cp.user_id AND b.blocked_user_id = p_sender_id)
            WHERE cp.conversation_id = p_conversation_id
              AND cp.user_id <> p_sender_id
              AND cp.left_at IS NULL
        );
    END IF;

    -- Group chats and announcements use their existing membership/role policies.
    RETURN TRUE;
END;
$function$;
REVOKE ALL PRIVILEGES ON FUNCTION public.can_send_smartnekam_chat_message(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_send_smartnekam_chat_message(UUID, UUID) TO authenticated;

-- Replace the existing direct-chat RPC to honour block lists and recipient privacy settings.
CREATE OR REPLACE FUNCTION public.create_or_get_direct_conversation(p_other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_conversation_id UUID;
    v_pair_key TEXT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Sign in to start a conversation.';
    END IF;
    IF p_other_user_id IS NULL OR p_other_user_id = v_uid THEN
        RAISE EXCEPTION 'Choose another active user.';
    END IF;
    IF NOT public.can_start_smartnekam_direct_message(p_other_user_id) THEN
        RAISE EXCEPTION 'Direct messages are unavailable because of privacy settings, blocks, or study-group requirements.';
    END IF;

    v_pair_key := LEAST(v_uid::TEXT, p_other_user_id::TEXT) || ':' || GREATEST(v_uid::TEXT, p_other_user_id::TEXT);
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_pair_key, 0));

    SELECT c.id INTO v_conversation_id
    FROM public.chat_conversations AS c
    WHERE c.conversation_type = 'direct'
      AND c.status = 'active'
      AND EXISTS (
          SELECT 1 FROM public.chat_participants AS a
          WHERE a.conversation_id = c.id AND a.user_id = v_uid AND a.left_at IS NULL
      )
      AND EXISTS (
          SELECT 1 FROM public.chat_participants AS b
          WHERE b.conversation_id = c.id AND b.user_id = p_other_user_id AND b.left_at IS NULL
      )
      AND (
          SELECT count(*) FROM public.chat_participants AS n
          WHERE n.conversation_id = c.id AND n.left_at IS NULL
      ) = 2
    ORDER BY c.created_at
    LIMIT 1;

    IF v_conversation_id IS NULL THEN
        INSERT INTO public.chat_conversations (conversation_type, created_by)
        VALUES ('direct', v_uid)
        RETURNING id INTO v_conversation_id;

        INSERT INTO public.chat_participants (conversation_id, user_id, participant_role)
        VALUES
            (v_conversation_id, v_uid, 'member'),
            (v_conversation_id, p_other_user_id, 'member');
    END IF;

    RETURN v_conversation_id;
END;
$function$;
REVOKE ALL PRIVILEGES ON FUNCTION public.create_or_get_direct_conversation(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_get_direct_conversation(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Append-only consent history (terms, privacy, marketing and AI processing)
--    To withdraw consent, insert a new record with accepted = FALSE.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    consent_type VARCHAR(32) NOT NULL,
    policy_version VARCHAR(40) NOT NULL,
    accepted BOOLEAN NOT NULL,
    language_code VARCHAR(5) NOT NULL DEFAULT 'sw',
    source VARCHAR(24) NOT NULL DEFAULT 'settings',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT account_consents_type_check CHECK (
        consent_type IN ('terms', 'privacy_policy', 'marketing', 'ai_processing', 'parental_link', 'premium_billing')
    ),
    CONSTRAINT account_consents_language_check CHECK (language_code IN ('sw', 'en')),
    CONSTRAINT account_consents_source_check CHECK (
        source IN ('onboarding', 'settings', 'checkout', 'parent_portal', 'other')
    ),
    CONSTRAINT account_consents_policy_version_not_blank CHECK (length(btrim(policy_version)) > 0)
);
CREATE INDEX IF NOT EXISTS account_consents_user_history_idx
    ON public.account_consents (user_id, consent_type, recorded_at DESC);

-- -----------------------------------------------------------------------------
-- 5. Help & support tickets and messages
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject VARCHAR(180) NOT NULL,
    category VARCHAR(24) NOT NULL DEFAULT 'other',
    priority VARCHAR(12) NOT NULL DEFAULT 'normal',
    status VARCHAR(24) NOT NULL DEFAULT 'open',
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,
    CONSTRAINT support_tickets_category_check CHECK (
        category IN ('account', 'login', 'learning', 'community', 'opportunity', 'billing', 'safety', 'bug', 'other')
    ),
    CONSTRAINT support_tickets_priority_check CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    CONSTRAINT support_tickets_status_check CHECK (
        status IN ('open', 'in_progress', 'waiting_for_user', 'resolved', 'closed')
    ),
    CONSTRAINT support_tickets_subject_not_blank CHECK (length(btrim(subject)) > 0)
);
CREATE INDEX IF NOT EXISTS support_tickets_user_updated_idx
    ON public.support_tickets (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_queue_idx
    ON public.support_tickets (status, priority, created_at);
CREATE INDEX IF NOT EXISTS support_tickets_assigned_idx
    ON public.support_tickets (assigned_to, status, updated_at DESC);

DROP TRIGGER IF EXISTS support_tickets_set_updated_at ON public.support_tickets;
CREATE TRIGGER support_tickets_set_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    attachment_paths TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT support_ticket_messages_not_blank CHECK (length(btrim(message)) > 0),
    CONSTRAINT support_ticket_messages_attachments_count_check CHECK (cardinality(attachment_paths) <= 3)
);
CREATE INDEX IF NOT EXISTS support_ticket_messages_ticket_created_idx
    ON public.support_ticket_messages (ticket_id, created_at);

-- -----------------------------------------------------------------------------
-- 6. Account export/deletion requests
--    Completion is a workflow state only; it does not itself delete auth/profile data.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_data_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    request_type VARCHAR(16) NOT NULL,
    reason TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'requested',
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    admin_note TEXT,
    CONSTRAINT account_data_requests_type_check CHECK (request_type IN ('export', 'deletion')),
    CONSTRAINT account_data_requests_status_check CHECK (
        status IN ('requested', 'processing', 'completed', 'rejected', 'cancelled')
    ),
    CONSTRAINT account_data_requests_reason_length_check CHECK (reason IS NULL OR length(reason) <= 2000),
    CONSTRAINT account_data_requests_admin_note_length_check CHECK (admin_note IS NULL OR length(admin_note) <= 4000)
);
CREATE INDEX IF NOT EXISTS account_data_requests_user_idx
    ON public.account_data_requests (user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS account_data_requests_queue_idx
    ON public.account_data_requests (status, submitted_at);
CREATE UNIQUE INDEX IF NOT EXISTS account_data_requests_one_active_type_idx
    ON public.account_data_requests (user_id, request_type)
    WHERE status IN ('requested', 'processing');

-- Security events are inserted by trusted backend/auth hooks, not by regular clients.
CREATE TABLE IF NOT EXISTS public.account_security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    event_type VARCHAR(32) NOT NULL,
    summary VARCHAR(240) NOT NULL DEFAULT '',
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT account_security_events_type_check CHECK (
        event_type IN (
            'login_success', 'login_failure', 'otp_requested', 'password_changed',
            'email_changed', 'phone_changed', 'session_revoked', 'suspicious_activity', 'account_status_changed'
        )
    ),
    CONSTRAINT account_security_events_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);
CREATE INDEX IF NOT EXISTS account_security_events_user_time_idx
    ON public.account_security_events (user_id, occurred_at DESC);

-- -----------------------------------------------------------------------------
-- 7. Private support attachment bucket
-- Storage path format: <user_uuid>/<ticket_uuid>/<filename>
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'smartnekam-support-attachments',
    'smartnekam-support-attachments',
    FALSE,
    10485760,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain']::TEXT[]
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS smartnekam_support_files_read ON storage.objects;
CREATE POLICY smartnekam_support_files_read
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'smartnekam-support-attachments'
    AND (
        public.is_smartnekam_support_staff()
        OR (
            (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
            AND EXISTS (
                SELECT 1
                FROM public.support_tickets AS t
                WHERE t.id::TEXT = (storage.foldername(name))[2]
                  AND t.user_id = (SELECT auth.uid())
            )
        )
    )
);

DROP POLICY IF EXISTS smartnekam_support_files_insert_own ON storage.objects;
CREATE POLICY smartnekam_support_files_insert_own
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'smartnekam-support-attachments'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    AND EXISTS (
        SELECT 1
        FROM public.support_tickets AS t
        WHERE t.id::TEXT = (storage.foldername(name))[2]
          AND t.user_id = (SELECT auth.uid())
          AND t.status NOT IN ('resolved', 'closed')
    )
);

DROP POLICY IF EXISTS smartnekam_support_files_update_own ON storage.objects;
CREATE POLICY smartnekam_support_files_update_own
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'smartnekam-support-attachments'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    AND EXISTS (
        SELECT 1 FROM public.support_tickets AS t
        WHERE t.id::TEXT = (storage.foldername(name))[2]
          AND t.user_id = (SELECT auth.uid())
    )
)
WITH CHECK (
    bucket_id = 'smartnekam-support-attachments'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    AND EXISTS (
        SELECT 1 FROM public.support_tickets AS t
        WHERE t.id::TEXT = (storage.foldername(name))[2]
          AND t.user_id = (SELECT auth.uid())
    )
);

DROP POLICY IF EXISTS smartnekam_support_files_delete_own ON storage.objects;
CREATE POLICY smartnekam_support_files_delete_own
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'smartnekam-support-attachments'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    AND EXISTS (
        SELECT 1 FROM public.support_tickets AS t
        WHERE t.id::TEXT = (storage.foldername(name))[2]
          AND t.user_id = (SELECT auth.uid())
    )
);

-- -----------------------------------------------------------------------------
-- 8. Row Level Security
-- -----------------------------------------------------------------------------
ALTER TABLE public.user_app_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_privacy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_data_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_security_events ENABLE ROW LEVEL SECURITY;

-- Respect blocks and direct-message privacy settings when sending chat messages.
DROP POLICY IF EXISTS chat_messages_insert_participant ON public.chat_messages;
CREATE POLICY chat_messages_insert_participant ON public.chat_messages
FOR INSERT TO authenticated
WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND public.is_chat_conversation_participant(conversation_id)
    AND public.can_send_smartnekam_chat_message(conversation_id, sender_id)
    AND EXISTS (
        SELECT 1 FROM public.chat_conversations AS c
        WHERE c.id = conversation_id AND c.status = 'active'
    )
);

-- App preferences: users can read and change only their own preferences.
DROP POLICY IF EXISTS user_app_preferences_select_own ON public.user_app_preferences;
CREATE POLICY user_app_preferences_select_own ON public.user_app_preferences
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS user_app_preferences_insert_own ON public.user_app_preferences;
CREATE POLICY user_app_preferences_insert_own ON public.user_app_preferences
FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS user_app_preferences_update_own ON public.user_app_preferences;
CREATE POLICY user_app_preferences_update_own ON public.user_app_preferences
FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

-- Privacy settings: users can read and change only their own choices.
DROP POLICY IF EXISTS user_privacy_settings_select_own ON public.user_privacy_settings;
CREATE POLICY user_privacy_settings_select_own ON public.user_privacy_settings
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS user_privacy_settings_insert_own ON public.user_privacy_settings;
CREATE POLICY user_privacy_settings_insert_own ON public.user_privacy_settings
FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS user_privacy_settings_update_own ON public.user_privacy_settings;
CREATE POLICY user_privacy_settings_update_own ON public.user_privacy_settings
FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS user_blocks_select_own ON public.user_blocks;
CREATE POLICY user_blocks_select_own ON public.user_blocks
FOR SELECT TO authenticated USING (blocker_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS user_blocks_insert_own ON public.user_blocks;
CREATE POLICY user_blocks_insert_own ON public.user_blocks
FOR INSERT TO authenticated WITH CHECK (blocker_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS user_blocks_delete_own ON public.user_blocks;
CREATE POLICY user_blocks_delete_own ON public.user_blocks
FOR DELETE TO authenticated USING (blocker_id = (SELECT auth.uid()));

-- Consent records are append-only for clients (no UPDATE or DELETE privilege).
DROP POLICY IF EXISTS account_consents_select_own ON public.account_consents;
CREATE POLICY account_consents_select_own ON public.account_consents
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS account_consents_insert_own ON public.account_consents;
CREATE POLICY account_consents_insert_own ON public.account_consents
FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

-- Ticket owners see their tickets; support staff can see the queue.
DROP POLICY IF EXISTS support_tickets_select_owner_or_staff ON public.support_tickets;
CREATE POLICY support_tickets_select_owner_or_staff ON public.support_tickets
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) OR public.is_smartnekam_support_staff());
DROP POLICY IF EXISTS support_tickets_insert_owner ON public.support_tickets;
CREATE POLICY support_tickets_insert_owner ON public.support_tickets
FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS support_tickets_update_staff ON public.support_tickets;
CREATE POLICY support_tickets_update_staff ON public.support_tickets
FOR UPDATE TO authenticated USING (public.is_smartnekam_support_staff())
WITH CHECK (public.is_smartnekam_support_staff());

-- Ticket owners cannot see internal staff notes.
DROP POLICY IF EXISTS support_ticket_messages_select_owner_or_staff ON public.support_ticket_messages;
CREATE POLICY support_ticket_messages_select_owner_or_staff ON public.support_ticket_messages
FOR SELECT TO authenticated
USING (
    public.is_smartnekam_support_staff()
    OR (
        NOT is_internal
        AND EXISTS (
            SELECT 1 FROM public.support_tickets AS t
            WHERE t.id = ticket_id AND t.user_id = (SELECT auth.uid())
        )
    )
);
DROP POLICY IF EXISTS support_ticket_messages_insert_owner_or_staff ON public.support_ticket_messages;
CREATE POLICY support_ticket_messages_insert_owner_or_staff ON public.support_ticket_messages
FOR INSERT TO authenticated
WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND (
        public.is_smartnekam_support_staff()
        OR (
            NOT is_internal
            AND EXISTS (
                SELECT 1 FROM public.support_tickets AS t
                WHERE t.id = ticket_id
                  AND t.user_id = (SELECT auth.uid())
                  AND t.status NOT IN ('resolved', 'closed')
            )
        )
    )
);

-- Data requests are visible to their requester; clients cannot set review fields.
DROP POLICY IF EXISTS account_data_requests_select_own_or_staff ON public.account_data_requests;
CREATE POLICY account_data_requests_select_own_or_staff ON public.account_data_requests
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) OR public.is_smartnekam_support_staff());
DROP POLICY IF EXISTS account_data_requests_insert_own ON public.account_data_requests;
CREATE POLICY account_data_requests_insert_own ON public.account_data_requests
FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

-- Security events are read-only to end users and visible only to their owner or support staff.
DROP POLICY IF EXISTS account_security_events_select_own_or_staff ON public.account_security_events;
CREATE POLICY account_security_events_select_own_or_staff ON public.account_security_events
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) OR public.is_smartnekam_support_staff());

-- -----------------------------------------------------------------------------
-- 9. Least-privilege table grants
-- -----------------------------------------------------------------------------
REVOKE ALL PRIVILEGES ON TABLE
    public.user_app_preferences,
    public.user_privacy_settings,
    public.user_blocks,
    public.account_consents,
    public.support_tickets,
    public.support_ticket_messages,
    public.account_data_requests,
    public.account_security_events
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.user_app_preferences TO authenticated;
GRANT INSERT (user_id, language_code, theme_mode, text_size, reduced_motion, low_data_mode, auto_download_over_wifi)
    ON public.user_app_preferences TO authenticated;
GRANT UPDATE (language_code, theme_mode, text_size, reduced_motion, low_data_mode, auto_download_over_wifi)
    ON public.user_app_preferences TO authenticated;
GRANT SELECT ON public.user_privacy_settings TO authenticated;
GRANT INSERT (user_id, profile_visibility, show_online_status, allow_direct_messages, allow_group_invites,
              show_in_leaderboards, show_academic_details)
    ON public.user_privacy_settings TO authenticated;
GRANT UPDATE (profile_visibility, show_online_status, allow_direct_messages, allow_group_invites,
              show_in_leaderboards, show_academic_details)
    ON public.user_privacy_settings TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT SELECT ON public.account_consents TO authenticated;
GRANT INSERT (user_id, consent_type, policy_version, accepted, language_code, source)
    ON public.account_consents TO authenticated;
GRANT SELECT ON public.support_tickets TO authenticated;
GRANT INSERT (user_id, subject, category) ON public.support_tickets TO authenticated;
GRANT SELECT ON public.support_ticket_messages TO authenticated;
GRANT INSERT (ticket_id, sender_id, message, attachment_paths, is_internal)
    ON public.support_ticket_messages TO authenticated;
GRANT SELECT ON public.account_data_requests TO authenticated;
GRANT INSERT (user_id, request_type, reason) ON public.account_data_requests TO authenticated;
GRANT SELECT ON public.account_security_events TO authenticated;

-- -----------------------------------------------------------------------------
-- 10. Secure workflow functions
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_own_support_ticket(p_ticket_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_user_id UUID := (SELECT auth.uid());
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication is required.';
    END IF;

    UPDATE public.support_tickets AS t
       SET status = 'closed', closed_at = pg_catalog.now()
     WHERE t.id = p_ticket_id
       AND t.user_id = v_user_id
       AND t.status NOT IN ('resolved', 'closed');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ticket not found, not owned by current user, or already closed.';
    END IF;
END;
$function$;
REVOKE ALL PRIVILEGES ON FUNCTION public.close_own_support_ticket(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_own_support_ticket(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_own_data_request(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_user_id UUID := (SELECT auth.uid());
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication is required.';
    END IF;

    UPDATE public.account_data_requests AS r
       SET status = 'cancelled'
     WHERE r.id = p_request_id
       AND r.user_id = v_user_id
       AND r.status = 'requested';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found, not owned by current user, or already processing.';
    END IF;
END;
$function$;
REVOKE ALL PRIVILEGES ON FUNCTION public.cancel_own_data_request(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_own_data_request(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_account_data_request(
    p_request_id UUID,
    p_decision TEXT,
    p_admin_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_admin_id UUID := (SELECT auth.uid());
BEGIN
    IF v_admin_id IS NULL OR NOT public.is_smartnekam_support_staff() THEN
        RAISE EXCEPTION 'Only active SmartNekam support staff may review account data requests.';
    END IF;

    IF p_decision IS NULL OR p_decision NOT IN ('processing', 'completed', 'rejected') THEN
        RAISE EXCEPTION 'Invalid decision. Allowed values: processing, completed, rejected.';
    END IF;

    IF p_admin_note IS NOT NULL AND pg_catalog.length(p_admin_note) > 4000 THEN
        RAISE EXCEPTION 'Admin note is too long.';
    END IF;

    UPDATE public.account_data_requests AS r
       SET status = p_decision,
           reviewed_by = v_admin_id,
           reviewed_at = pg_catalog.now(),
           admin_note = p_admin_note
     WHERE r.id = p_request_id
       AND r.status IN ('requested', 'processing');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account data request not found or already finalized.';
    END IF;
END;
$function$;
REVOKE ALL PRIVILEGES ON FUNCTION public.admin_review_account_data_request(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_account_data_request(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_support_ticket(
    p_ticket_id UUID,
    p_status TEXT,
    p_priority TEXT DEFAULT NULL,
    p_assigned_to UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_admin_id UUID := (SELECT auth.uid());
BEGIN
    IF v_admin_id IS NULL OR NOT public.is_smartnekam_support_staff() THEN
        RAISE EXCEPTION 'Only active SmartNekam support staff may update support tickets.';
    END IF;

    IF p_status IS NULL OR p_status NOT IN ('open', 'in_progress', 'waiting_for_user', 'resolved', 'closed') THEN
        RAISE EXCEPTION 'Invalid support ticket status.';
    END IF;

    IF p_priority IS NOT NULL AND p_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
        RAISE EXCEPTION 'Invalid support ticket priority.';
    END IF;

    IF p_assigned_to IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.profiles AS p
        WHERE p.id = p_assigned_to
          AND p.role IN ('moderator', 'super_admin')
          AND p.status = 'active'
    ) THEN
        RAISE EXCEPTION 'Assignee must be an active moderator or super admin.';
    END IF;

    UPDATE public.support_tickets AS t
       SET status = p_status,
           priority = COALESCE(p_priority, t.priority),
           assigned_to = COALESCE(p_assigned_to, t.assigned_to),
           closed_at = CASE WHEN p_status IN ('resolved', 'closed') THEN pg_catalog.now() ELSE NULL END
     WHERE t.id = p_ticket_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Support ticket not found.';
    END IF;
END;
$function$;
REVOKE ALL PRIVILEGES ON FUNCTION public.admin_update_support_ticket(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_support_ticket(UUID, TEXT, TEXT, UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 11. Keep schema access explicit and finish
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated;

COMMENT ON TABLE public.account_consents IS
'Append-only consent history. Withdraw a consent by inserting a new record with accepted = false.';
COMMENT ON TABLE public.account_data_requests IS
'Privacy workflow for data export/deletion requests; processing these requests requires a trusted backend worker.';
COMMENT ON TABLE public.account_security_events IS
'Security event history inserted by trusted backend/auth hooks; ordinary clients cannot insert or edit events.';
COMMENT ON TABLE public.support_ticket_messages IS
'Internal staff notes use is_internal=true and are hidden from ticket owners by row-level security.';

COMMIT;

-- Expected result: Success. No rows returned.
-- Actual file export/deletion, push/email delivery, and security-event ingestion require trusted backend integrations.

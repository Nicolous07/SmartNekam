-- SmartNekam | SQL 006: Mentors, Bookings, Direct Chat, Live Rooms and Events
-- Prerequisites: SQL 001A, SQL 001B, SQL 002, SQL 003, SQL 004 FIXED, SQL 005.
-- Run this ENTIRE script in Supabase Dashboard > SQL Editor > New query.
-- Re-runnable during development: does not drop existing tables or user data.
-- Chat attachment path convention: <conversation_uuid>/<uploader_auth_uuid>/<filename>.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Authorization helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_smartnekam_moderator()
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

REVOKE ALL PRIVILEGES ON FUNCTION public.is_smartnekam_moderator() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_smartnekam_moderator() TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. Mentor profiles
-- A user submits a mentor card for review; only moderators can verify/activate it.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mentors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    display_name VARCHAR(120),
    headline VARCHAR(180),
    bio TEXT NOT NULL DEFAULT '',
    subjects TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'TZS',
    availability JSONB NOT NULL DEFAULT '{}'::JSONB,
    timezone VARCHAR(80) NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(24) NOT NULL DEFAULT 'pending_review',
    rating_average NUMERIC(3,2) NOT NULL DEFAULT 0,
    rating_count INTEGER NOT NULL DEFAULT 0,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT mentors_hourly_rate_check CHECK (hourly_rate >= 0),
    CONSTRAINT mentors_rating_average_check CHECK (rating_average >= 0 AND rating_average <= 5),
    CONSTRAINT mentors_rating_count_check CHECK (rating_count >= 0),
    CONSTRAINT mentors_availability_object_check CHECK (jsonb_typeof(availability) = 'object'),
    CONSTRAINT mentors_status_check CHECK (status IN ('pending_review', 'active', 'inactive', 'suspended', 'rejected')),
    CONSTRAINT mentors_currency_check CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE INDEX IF NOT EXISTS mentors_status_verified_rating_idx
    ON public.mentors (status, verified, rating_average DESC);
CREATE INDEX IF NOT EXISTS mentors_user_id_idx ON public.mentors (user_id);
CREATE INDEX IF NOT EXISTS mentors_subjects_idx ON public.mentors USING GIN (subjects);

CREATE OR REPLACE FUNCTION public.smartnekam_set_mentor_display_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    IF NEW.display_name IS NULL OR length(btrim(NEW.display_name)) = 0 THEN
        SELECT p.full_name INTO NEW.display_name
        FROM public.profiles AS p
        WHERE p.id = NEW.user_id;
    END IF;
    IF NEW.display_name IS NULL OR length(btrim(NEW.display_name)) = 0 THEN
        NEW.display_name := 'SmartNekam Mentor';
    END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS mentors_set_display_name ON public.mentors;
CREATE TRIGGER mentors_set_display_name
BEFORE INSERT ON public.mentors
FOR EACH ROW EXECUTE FUNCTION public.smartnekam_set_mentor_display_name();

DROP TRIGGER IF EXISTS mentors_set_updated_at ON public.mentors;
CREATE TRIGGER mentors_set_updated_at
BEFORE UPDATE ON public.mentors
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. Private chat conversations and messages
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_type VARCHAR(24) NOT NULL DEFAULT 'direct',
    title VARCHAR(180),
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chat_conversations_type_check CHECK (conversation_type IN ('direct', 'mentor', 'group', 'announcement')),
    CONSTRAINT chat_conversations_status_check CHECK (status IN ('active', 'archived', 'removed'))
);

CREATE INDEX IF NOT EXISTS chat_conversations_created_by_idx ON public.chat_conversations (created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_conversations_type_status_idx ON public.chat_conversations (conversation_type, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.chat_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    participant_role VARCHAR(20) NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at TIMESTAMPTZ,
    last_read_at TIMESTAMPTZ,
    is_muted BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT chat_participants_role_check CHECK (participant_role IN ('admin', 'member')),
    CONSTRAINT chat_participants_unique UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS chat_participants_user_idx ON public.chat_participants (user_id, joined_at DESC);
CREATE INDEX IF NOT EXISTS chat_participants_conversation_idx ON public.chat_participants (conversation_id, user_id);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE RESTRICT,
    body TEXT NOT NULL DEFAULT '',
    attachment_path TEXT,
    message_type VARCHAR(20) NOT NULL DEFAULT 'text',
    reply_to_message_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
    edited_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chat_messages_type_check CHECK (message_type IN ('text', 'image', 'file')),
    CONSTRAINT chat_messages_content_check CHECK (length(btrim(body)) > 0 OR attachment_path IS NOT NULL),
    CONSTRAINT chat_messages_attachment_path_check CHECK (
        attachment_path IS NULL OR attachment_path !~ '^/'
    )
);

CREATE INDEX IF NOT EXISTS chat_messages_conversation_created_idx ON public.chat_messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_sender_created_idx ON public.chat_messages (sender_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.is_chat_conversation_participant(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.chat_participants AS cp
        WHERE cp.conversation_id = p_conversation_id
          AND cp.user_id = (SELECT auth.uid())
          AND cp.left_at IS NULL
    );
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.is_chat_conversation_participant(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_chat_conversation_participant(UUID) TO authenticated;

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

    IF NOT EXISTS (
        SELECT 1 FROM public.profiles AS p
        WHERE p.id = p_other_user_id AND p.status = 'active'
    ) THEN
        RAISE EXCEPTION 'The selected user is not active.';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles AS p
        WHERE p.id = v_uid AND p.status = 'active'
    ) THEN
        RAISE EXCEPTION 'Your account is not active.';
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

DROP TRIGGER IF EXISTS chat_conversations_set_updated_at ON public.chat_conversations;
CREATE TRIGGER chat_conversations_set_updated_at
BEFORE UPDATE ON public.chat_conversations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.smartnekam_set_chat_message_edited_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
    NEW.edited_at := pg_catalog.now();
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS chat_messages_set_edited_at ON public.chat_messages;
CREATE TRIGGER chat_messages_set_edited_at
BEFORE UPDATE OF body ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.smartnekam_set_chat_message_edited_at();

CREATE OR REPLACE FUNCTION public.smartnekam_touch_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    UPDATE public.chat_conversations
    SET updated_at = pg_catalog.now()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS chat_messages_touch_conversation ON public.chat_messages;
CREATE TRIGGER chat_messages_touch_conversation
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.smartnekam_touch_conversation_on_message();

-- -----------------------------------------------------------------------------
-- 4. Mentor session requests and booking flow
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mentor_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mentor_id UUID NOT NULL REFERENCES public.mentors(id) ON DELETE RESTRICT,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    session_format VARCHAR(20) NOT NULL DEFAULT 'online',
    topic VARCHAR(180) NOT NULL,
    student_message TEXT,
    mentor_message TEXT,
    meeting_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'requested',
    responded_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    chat_conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT mentor_sessions_duration_check CHECK (duration_minutes BETWEEN 15 AND 180),
    CONSTRAINT mentor_sessions_format_check CHECK (session_format IN ('online', 'in_person', 'phone')), 
    CONSTRAINT mentor_sessions_status_check CHECK (status IN ('requested', 'accepted', 'declined', 'cancelled', 'completed', 'no_show')),
    CONSTRAINT mentor_sessions_topic_not_blank CHECK (length(btrim(topic)) > 0),
    CONSTRAINT mentor_sessions_meeting_url_check CHECK (meeting_url IS NULL OR meeting_url ~* '^https?://')
);

CREATE INDEX IF NOT EXISTS mentor_sessions_mentor_schedule_idx ON public.mentor_sessions (mentor_id, scheduled_at DESC, status);
CREATE INDEX IF NOT EXISTS mentor_sessions_student_schedule_idx ON public.mentor_sessions (student_id, scheduled_at DESC, status);
CREATE INDEX IF NOT EXISTS mentor_sessions_status_schedule_idx ON public.mentor_sessions (status, scheduled_at);

DROP TRIGGER IF EXISTS mentor_sessions_set_updated_at ON public.mentor_sessions;
CREATE TRIGGER mentor_sessions_set_updated_at
BEFORE UPDATE ON public.mentor_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.smartnekam_create_mentor_chat_on_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_mentor_user_id UUID;
    v_conversation_id UUID;
BEGIN
    IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM NEW.status
       AND NEW.chat_conversation_id IS NULL THEN
        SELECT m.user_id INTO v_mentor_user_id
        FROM public.mentors AS m
        WHERE m.id = NEW.mentor_id;

        IF v_mentor_user_id IS NOT NULL THEN
            INSERT INTO public.chat_conversations (conversation_type, title, created_by)
            VALUES ('mentor', 'SmartNekam Mentorship', v_mentor_user_id)
            RETURNING id INTO v_conversation_id;

            INSERT INTO public.chat_participants (conversation_id, user_id, participant_role)
            VALUES
                (v_conversation_id, v_mentor_user_id, 'admin'),
                (v_conversation_id, NEW.student_id, 'member')
            ON CONFLICT (conversation_id, user_id) DO NOTHING;

            UPDATE public.mentor_sessions
            SET chat_conversation_id = v_conversation_id
            WHERE id = NEW.id AND chat_conversation_id IS NULL;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS mentor_sessions_create_chat_on_accept ON public.mentor_sessions;
CREATE TRIGGER mentor_sessions_create_chat_on_accept
AFTER UPDATE OF status ON public.mentor_sessions
FOR EACH ROW EXECUTE FUNCTION public.smartnekam_create_mentor_chat_on_accept();

CREATE OR REPLACE FUNCTION public.respond_to_mentor_session(
    p_session_id UUID,
    p_accept BOOLEAN,
    p_meeting_url TEXT DEFAULT NULL,
    p_mentor_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_status TEXT;
    v_conversation_id UUID;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Sign in to respond to a mentor request.';
    END IF;
    IF p_accept AND p_meeting_url IS NOT NULL AND p_meeting_url !~* '^https?://' THEN
        RAISE EXCEPTION 'Meeting URL must begin with http:// or https://.';
    END IF;

    SELECT ms.status INTO v_status
    FROM public.mentor_sessions AS ms
    JOIN public.mentors AS m ON m.id = ms.mentor_id
    WHERE ms.id = p_session_id AND m.user_id = v_uid
    FOR UPDATE OF ms;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mentor session not found or you do not own it.';
    END IF;
    IF v_status <> 'requested' THEN
        RAISE EXCEPTION 'Only requested sessions can be accepted or declined.';
    END IF;

    UPDATE public.mentor_sessions
    SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
        responded_at = pg_catalog.now(),
        meeting_url = CASE WHEN p_accept THEN p_meeting_url ELSE NULL END,
        mentor_message = p_mentor_message
    WHERE id = p_session_id;

    SELECT ms.chat_conversation_id INTO v_conversation_id
    FROM public.mentor_sessions AS ms
    WHERE ms.id = p_session_id;
    RETURN v_conversation_id;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.respond_to_mentor_session(UUID, BOOLEAN, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_mentor_session(UUID, BOOLEAN, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_mentor_session(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_status TEXT;
    v_student_id UUID;
    v_mentor_user_id UUID;
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in to cancel this session.'; END IF;

    SELECT ms.status, ms.student_id, m.user_id
    INTO v_status, v_student_id, v_mentor_user_id
    FROM public.mentor_sessions AS ms
    JOIN public.mentors AS m ON m.id = ms.mentor_id
    WHERE ms.id = p_session_id
    FOR UPDATE OF ms;

    IF NOT FOUND OR (v_uid <> v_student_id AND v_uid <> v_mentor_user_id) THEN
        RAISE EXCEPTION 'Mentor session not found or you are not a participant.';
    END IF;
    IF v_status NOT IN ('requested', 'accepted') THEN
        RAISE EXCEPTION 'Only requested or accepted sessions can be cancelled.';
    END IF;

    UPDATE public.mentor_sessions
    SET status = 'cancelled', responded_at = COALESCE(responded_at, pg_catalog.now())
    WHERE id = p_session_id;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.cancel_mentor_session(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_mentor_session(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_mentor_session(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in to complete this session.'; END IF;

    UPDATE public.mentor_sessions AS ms
    SET status = 'completed', completed_at = pg_catalog.now()
    FROM public.mentors AS m
    WHERE ms.id = p_session_id
      AND ms.mentor_id = m.id
      AND m.user_id = v_uid
      AND ms.status = 'accepted';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Only the assigned mentor can complete an accepted session.';
    END IF;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.complete_mentor_session(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_mentor_session(UUID) TO authenticated;

CREATE TABLE IF NOT EXISTS public.mentor_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mentor_id UUID NOT NULL REFERENCES public.mentors(id) ON DELETE CASCADE,
    session_id UUID NOT NULL UNIQUE REFERENCES public.mentor_sessions(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL,
    review TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT mentor_reviews_rating_check CHECK (rating BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS mentor_reviews_mentor_created_idx ON public.mentor_reviews (mentor_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.smartnekam_refresh_mentor_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_mentor_id UUID;
BEGIN
    v_mentor_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.mentor_id ELSE NEW.mentor_id END;
    UPDATE public.mentors AS m
    SET rating_average = COALESCE((SELECT round(avg(r.rating)::NUMERIC, 2) FROM public.mentor_reviews AS r WHERE r.mentor_id = v_mentor_id), 0),
        rating_count = (SELECT count(*)::INTEGER FROM public.mentor_reviews AS r WHERE r.mentor_id = v_mentor_id)
    WHERE m.id = v_mentor_id;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS mentor_reviews_refresh_rating ON public.mentor_reviews;
CREATE TRIGGER mentor_reviews_refresh_rating
AFTER INSERT OR DELETE ON public.mentor_reviews
FOR EACH ROW EXECUTE FUNCTION public.smartnekam_refresh_mentor_rating();

-- -----------------------------------------------------------------------------
-- 5. Live rooms and community events
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.live_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,
    access_type VARCHAR(20) NOT NULL DEFAULT 'public',
    meeting_url TEXT,
    capacity INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'pending_review',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT live_sessions_time_check CHECK (scheduled_end > scheduled_start),
    CONSTRAINT live_sessions_access_check CHECK (access_type IN ('public', 'private')),
    CONSTRAINT live_sessions_capacity_check CHECK (capacity IS NULL OR capacity > 0),
    CONSTRAINT live_sessions_status_check CHECK (status IN ('pending_review', 'scheduled', 'live', 'completed', 'cancelled', 'rejected')),
    CONSTRAINT live_sessions_url_check CHECK (meeting_url IS NULL OR meeting_url ~* '^https?://'),
    CONSTRAINT live_sessions_title_not_blank CHECK (length(btrim(title)) > 0)
);

CREATE INDEX IF NOT EXISTS live_sessions_status_start_idx ON public.live_sessions (status, scheduled_start);
CREATE INDEX IF NOT EXISTS live_sessions_host_start_idx ON public.live_sessions (host_id, scheduled_start DESC);

DROP TRIGGER IF EXISTS live_sessions_set_updated_at ON public.live_sessions;
CREATE TRIGGER live_sessions_set_updated_at
BEFORE UPDATE ON public.live_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.live_session_participants (
    live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    attendance_status VARCHAR(20) NOT NULL DEFAULT 'registered',
    PRIMARY KEY (live_session_id, user_id),
    CONSTRAINT live_session_participants_status_check CHECK (attendance_status IN ('registered', 'attended', 'cancelled'))
);
CREATE INDEX IF NOT EXISTS live_session_participants_user_idx ON public.live_session_participants (user_id, joined_at DESC);

CREATE TABLE IF NOT EXISTS public.community_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    event_type VARCHAR(30) NOT NULL DEFAULT 'other',
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ,
    venue TEXT,
    registration_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending_review',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT community_events_type_check CHECK (event_type IN ('seminar', 'tuition', 'career_talk', 'competition', 'workshop', 'live_class', 'other')),
    CONSTRAINT community_events_status_check CHECK (status IN ('pending_review', 'active', 'rejected', 'cancelled', 'completed')),
    CONSTRAINT community_events_time_check CHECK (ends_at IS NULL OR ends_at > starts_at),
    CONSTRAINT community_events_url_check CHECK (registration_url IS NULL OR registration_url ~* '^https?://'),
    CONSTRAINT community_events_title_not_blank CHECK (length(btrim(title)) > 0)
);
CREATE INDEX IF NOT EXISTS community_events_status_start_idx ON public.community_events (status, starts_at);
CREATE INDEX IF NOT EXISTS community_events_created_by_idx ON public.community_events (created_by, created_at DESC);

DROP TRIGGER IF EXISTS community_events_set_updated_at ON public.community_events;
CREATE TRIGGER community_events_set_updated_at
BEFORE UPDATE ON public.community_events
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.community_event_registrations (
    event_id UUID NOT NULL REFERENCES public.community_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'registered',
    registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (event_id, user_id),
    CONSTRAINT community_event_registrations_status_check CHECK (status IN ('registered', 'cancelled', 'attended'))
);
CREATE INDEX IF NOT EXISTS community_event_registrations_user_idx ON public.community_event_registrations (user_id, registered_at DESC);

-- -----------------------------------------------------------------------------
-- 6. Trusted moderation/session actions
-- Sensitive publication/verification statuses are changed through these functions,
-- not directly by client-side UPDATE statements.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_mentor_profile(p_mentor_id UUID, p_decision TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
BEGIN
    IF v_uid IS NULL OR NOT public.is_smartnekam_moderator() THEN
        RAISE EXCEPTION 'Only an active SmartNekam moderator can review mentor profiles.';
    END IF;

    IF p_decision = 'approve' THEN
        UPDATE public.mentors SET status = 'active', verified = TRUE, reviewed_by = v_uid, reviewed_at = pg_catalog.now()
        WHERE id = p_mentor_id AND status = 'pending_review';
    ELSIF p_decision = 'reject' THEN
        UPDATE public.mentors SET status = 'rejected', verified = FALSE, reviewed_by = v_uid, reviewed_at = pg_catalog.now()
        WHERE id = p_mentor_id AND status = 'pending_review';
    ELSIF p_decision = 'suspend' THEN
        UPDATE public.mentors SET status = 'suspended', verified = FALSE, reviewed_by = v_uid, reviewed_at = pg_catalog.now()
        WHERE id = p_mentor_id AND status IN ('active', 'inactive');
    ELSIF p_decision = 'deactivate' THEN
        UPDATE public.mentors SET status = 'inactive', verified = FALSE, reviewed_by = v_uid, reviewed_at = pg_catalog.now()
        WHERE id = p_mentor_id AND status = 'active';
    ELSE
        RAISE EXCEPTION 'Decision must be approve, reject, suspend, or deactivate.';
    END IF;

    IF NOT FOUND THEN RAISE EXCEPTION 'Mentor not found or the requested status transition is invalid.'; END IF;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.review_mentor_profile(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_mentor_profile(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_live_session(p_live_session_id UUID, p_decision TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
BEGIN
    IF v_uid IS NULL OR NOT public.is_smartnekam_moderator() THEN
        RAISE EXCEPTION 'Only an active SmartNekam moderator can review live sessions.';
    END IF;

    IF p_decision = 'approve' THEN
        UPDATE public.live_sessions SET status = 'scheduled' WHERE id = p_live_session_id AND status = 'pending_review';
    ELSIF p_decision = 'reject' THEN
        UPDATE public.live_sessions SET status = 'rejected' WHERE id = p_live_session_id AND status = 'pending_review';
    ELSIF p_decision = 'start' THEN
        UPDATE public.live_sessions SET status = 'live' WHERE id = p_live_session_id AND status = 'scheduled';
    ELSIF p_decision = 'complete' THEN
        UPDATE public.live_sessions SET status = 'completed' WHERE id = p_live_session_id AND status = 'live';
    ELSIF p_decision = 'cancel' THEN
        UPDATE public.live_sessions SET status = 'cancelled' WHERE id = p_live_session_id AND status IN ('pending_review', 'scheduled', 'live');
    ELSE
        RAISE EXCEPTION 'Decision must be approve, reject, start, complete, or cancel.';
    END IF;

    IF NOT FOUND THEN RAISE EXCEPTION 'Live session not found or the requested status transition is invalid.'; END IF;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.review_live_session(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_live_session(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_own_live_session(p_live_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in to cancel this live session.'; END IF;
    UPDATE public.live_sessions
    SET status = 'cancelled'
    WHERE id = p_live_session_id AND host_id = v_uid AND status IN ('pending_review', 'scheduled', 'live');
    IF NOT FOUND THEN RAISE EXCEPTION 'Live session not found or cannot be cancelled by this host.'; END IF;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.cancel_own_live_session(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_own_live_session(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_community_event(p_event_id UUID, p_decision TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
BEGIN
    IF v_uid IS NULL OR NOT public.is_smartnekam_moderator() THEN
        RAISE EXCEPTION 'Only an active SmartNekam moderator can review community events.';
    END IF;

    IF p_decision = 'approve' THEN
        UPDATE public.community_events SET status = 'active' WHERE id = p_event_id AND status = 'pending_review';
    ELSIF p_decision = 'reject' THEN
        UPDATE public.community_events SET status = 'rejected' WHERE id = p_event_id AND status = 'pending_review';
    ELSIF p_decision = 'cancel' THEN
        UPDATE public.community_events SET status = 'cancelled' WHERE id = p_event_id AND status IN ('pending_review', 'active');
    ELSIF p_decision = 'complete' THEN
        UPDATE public.community_events SET status = 'completed' WHERE id = p_event_id AND status = 'active';
    ELSE
        RAISE EXCEPTION 'Decision must be approve, reject, cancel, or complete.';
    END IF;

    IF NOT FOUND THEN RAISE EXCEPTION 'Event not found or the requested status transition is invalid.'; END IF;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.review_community_event(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_community_event(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_own_community_event(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in to cancel this event.'; END IF;
    UPDATE public.community_events
    SET status = 'cancelled'
    WHERE id = p_event_id AND created_by = v_uid AND status IN ('pending_review', 'active');
    IF NOT FOUND THEN RAISE EXCEPTION 'Event not found or cannot be cancelled by this creator.'; END IF;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.cancel_own_community_event(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_own_community_event(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 7. Enable RLS and define row-level policies
-- -----------------------------------------------------------------------------
ALTER TABLE public.mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_event_registrations ENABLE ROW LEVEL SECURITY;

-- Mentors: active verified cards are discoverable; own card and moderator review remain accessible.
DROP POLICY IF EXISTS mentors_select_directory ON public.mentors;
CREATE POLICY mentors_select_directory ON public.mentors FOR SELECT TO authenticated
USING ((status = 'active' AND verified = TRUE) OR user_id = (SELECT auth.uid()) OR public.is_smartnekam_moderator());

DROP POLICY IF EXISTS mentors_insert_own_pending ON public.mentors;
CREATE POLICY mentors_insert_own_pending ON public.mentors FOR INSERT TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND status = 'pending_review'
    AND verified = FALSE
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.status = 'active')
);

DROP POLICY IF EXISTS mentors_update_own ON public.mentors;
CREATE POLICY mentors_update_own ON public.mentors FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()) AND status IN ('pending_review', 'active'))
WITH CHECK (user_id = (SELECT auth.uid()) AND status IN ('pending_review', 'active'));

DROP POLICY IF EXISTS mentors_moderator_update ON public.mentors;
CREATE POLICY mentors_moderator_update ON public.mentors FOR UPDATE TO authenticated
USING (public.is_smartnekam_moderator()) WITH CHECK (public.is_smartnekam_moderator());

-- Chat access is membership-based. The helper uses SECURITY DEFINER to avoid RLS recursion.
DROP POLICY IF EXISTS chat_conversations_select_participant ON public.chat_conversations;
CREATE POLICY chat_conversations_select_participant ON public.chat_conversations FOR SELECT TO authenticated
USING (public.is_chat_conversation_participant(id) OR public.is_smartnekam_moderator());

DROP POLICY IF EXISTS chat_participants_select_conversation ON public.chat_participants;
CREATE POLICY chat_participants_select_conversation ON public.chat_participants FOR SELECT TO authenticated
USING (public.is_chat_conversation_participant(conversation_id) OR public.is_smartnekam_moderator());

DROP POLICY IF EXISTS chat_participants_update_own_receipts ON public.chat_participants;
CREATE POLICY chat_participants_update_own_receipts ON public.chat_participants FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()) AND left_at IS NULL)
WITH CHECK (user_id = (SELECT auth.uid()) AND left_at IS NULL);

DROP POLICY IF EXISTS chat_messages_select_participant ON public.chat_messages;
CREATE POLICY chat_messages_select_participant ON public.chat_messages FOR SELECT TO authenticated
USING (public.is_chat_conversation_participant(conversation_id) OR public.is_smartnekam_moderator());

DROP POLICY IF EXISTS chat_messages_insert_participant ON public.chat_messages;
CREATE POLICY chat_messages_insert_participant ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND public.is_chat_conversation_participant(conversation_id)
    AND EXISTS (SELECT 1 FROM public.chat_conversations c WHERE c.id = conversation_id AND c.status = 'active')
);

DROP POLICY IF EXISTS chat_messages_update_sender ON public.chat_messages;
CREATE POLICY chat_messages_update_sender ON public.chat_messages FOR UPDATE TO authenticated
USING (sender_id = (SELECT auth.uid()) AND public.is_chat_conversation_participant(conversation_id))
WITH CHECK (sender_id = (SELECT auth.uid()) AND public.is_chat_conversation_participant(conversation_id));

DROP POLICY IF EXISTS chat_messages_delete_sender ON public.chat_messages;
CREATE POLICY chat_messages_delete_sender ON public.chat_messages FOR DELETE TO authenticated
USING (sender_id = (SELECT auth.uid()) AND public.is_chat_conversation_participant(conversation_id));

-- Mentoring: users only see sessions in which they participate or moderators manage them.
DROP POLICY IF EXISTS mentor_sessions_select_participant ON public.mentor_sessions;
CREATE POLICY mentor_sessions_select_participant ON public.mentor_sessions FOR SELECT TO authenticated
USING (
    student_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.mentors m WHERE m.id = mentor_id AND m.user_id = (SELECT auth.uid()))
    OR public.is_smartnekam_moderator()
);

DROP POLICY IF EXISTS mentor_sessions_insert_student_request ON public.mentor_sessions;
CREATE POLICY mentor_sessions_insert_student_request ON public.mentor_sessions FOR INSERT TO authenticated
WITH CHECK (
    student_id = (SELECT auth.uid())
    AND status = 'requested'
    AND chat_conversation_id IS NULL
    AND scheduled_at > pg_catalog.now()
    AND EXISTS (SELECT 1 FROM public.mentors m WHERE m.id = mentor_id AND m.status = 'active' AND m.verified = TRUE)
);

DROP POLICY IF EXISTS mentor_reviews_select_visible ON public.mentor_reviews;
CREATE POLICY mentor_reviews_select_visible ON public.mentor_reviews FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.mentors m WHERE m.id = mentor_id AND m.status = 'active' AND m.verified = TRUE)
    OR reviewer_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.mentors m WHERE m.id = mentor_id AND m.user_id = (SELECT auth.uid()))
    OR public.is_smartnekam_moderator()
);

DROP POLICY IF EXISTS mentor_reviews_insert_completed_student ON public.mentor_reviews;
CREATE POLICY mentor_reviews_insert_completed_student ON public.mentor_reviews FOR INSERT TO authenticated
WITH CHECK (
    reviewer_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.mentor_sessions ms
        WHERE ms.id = session_id
          AND ms.mentor_id = mentor_id
          AND ms.student_id = (SELECT auth.uid())
          AND ms.status = 'completed'
    )
);

-- Live sessions: public active sessions are viewable; hosts submit for moderation.
DROP POLICY IF EXISTS live_sessions_select_visible ON public.live_sessions;
CREATE POLICY live_sessions_select_visible ON public.live_sessions FOR SELECT TO authenticated
USING (
    (status IN ('scheduled', 'live', 'completed') AND (access_type = 'public' OR host_id = (SELECT auth.uid())))
    OR host_id = (SELECT auth.uid())
    OR public.is_smartnekam_moderator()
);

DROP POLICY IF EXISTS live_sessions_insert_own_pending ON public.live_sessions;
CREATE POLICY live_sessions_insert_own_pending ON public.live_sessions FOR INSERT TO authenticated
WITH CHECK (
    host_id = (SELECT auth.uid())
    AND status = 'pending_review'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.status = 'active')
);

DROP POLICY IF EXISTS live_sessions_update_host_or_moderator ON public.live_sessions;
CREATE POLICY live_sessions_update_host_or_moderator ON public.live_sessions FOR UPDATE TO authenticated
USING (host_id = (SELECT auth.uid()) OR public.is_smartnekam_moderator())
WITH CHECK (host_id = (SELECT auth.uid()) OR public.is_smartnekam_moderator());

DROP POLICY IF EXISTS live_session_participants_select_own_or_host ON public.live_session_participants;
CREATE POLICY live_session_participants_select_own_or_host ON public.live_session_participants FOR SELECT TO authenticated
USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.live_sessions ls WHERE ls.id = live_session_id AND ls.host_id = (SELECT auth.uid()))
    OR public.is_smartnekam_moderator()
);

DROP POLICY IF EXISTS live_session_participants_insert_self ON public.live_session_participants;
CREATE POLICY live_session_participants_insert_self ON public.live_session_participants FOR INSERT TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND attendance_status = 'registered'
    AND EXISTS (
        SELECT 1 FROM public.live_sessions ls
        WHERE ls.id = live_session_id
          AND ls.status IN ('scheduled', 'live')
          AND ls.access_type = 'public'
    )
);

DROP POLICY IF EXISTS live_session_participants_update_self_cancel ON public.live_session_participants;
CREATE POLICY live_session_participants_update_self_cancel ON public.live_session_participants FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()) AND attendance_status = 'cancelled');

-- Events: users submit for review; only active events are listed publicly to signed-in users.
DROP POLICY IF EXISTS community_events_select_visible ON public.community_events;
CREATE POLICY community_events_select_visible ON public.community_events FOR SELECT TO authenticated
USING (status = 'active' OR created_by = (SELECT auth.uid()) OR public.is_smartnekam_moderator());

DROP POLICY IF EXISTS community_events_insert_own_pending ON public.community_events;
CREATE POLICY community_events_insert_own_pending ON public.community_events FOR INSERT TO authenticated
WITH CHECK (created_by = (SELECT auth.uid()) AND status = 'pending_review');

DROP POLICY IF EXISTS community_events_update_owner_or_moderator ON public.community_events;
CREATE POLICY community_events_update_owner_or_moderator ON public.community_events FOR UPDATE TO authenticated
USING ((created_by = (SELECT auth.uid()) AND status = 'pending_review') OR public.is_smartnekam_moderator())
WITH CHECK ((created_by = (SELECT auth.uid()) AND status = 'pending_review') OR public.is_smartnekam_moderator());

DROP POLICY IF EXISTS event_registrations_select_own_or_event_owner ON public.community_event_registrations;
CREATE POLICY event_registrations_select_own_or_event_owner ON public.community_event_registrations FOR SELECT TO authenticated
USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.community_events e WHERE e.id = event_id AND e.created_by = (SELECT auth.uid()))
    OR public.is_smartnekam_moderator()
);

DROP POLICY IF EXISTS event_registrations_insert_self ON public.community_event_registrations;
CREATE POLICY event_registrations_insert_self ON public.community_event_registrations FOR INSERT TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND status = 'registered'
    AND EXISTS (SELECT 1 FROM public.community_events e WHERE e.id = event_id AND e.status = 'active')
);

DROP POLICY IF EXISTS event_registrations_update_self_cancel ON public.community_event_registrations;
CREATE POLICY event_registrations_update_self_cancel ON public.community_event_registrations FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()) AND status = 'registered')
WITH CHECK (user_id = (SELECT auth.uid()) AND status IN ('registered', 'cancelled'));

-- -----------------------------------------------------------------------------
-- 7. Private Storage bucket for chat attachments (10 MiB per file)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'smartnekam-chat-attachments',
    'smartnekam-chat-attachments',
    FALSE,
    10485760,
    ARRAY[
        'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain'
    ]::TEXT[]
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS smartnekam_chat_attachments_select_member ON storage.objects;
CREATE POLICY smartnekam_chat_attachments_select_member
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'smartnekam-chat-attachments'
    AND EXISTS (
        SELECT 1 FROM public.chat_conversations c
        WHERE c.id::TEXT = (storage.foldername(name))[1]
          AND public.is_chat_conversation_participant(c.id)
    )
);

DROP POLICY IF EXISTS smartnekam_chat_attachments_insert_member ON storage.objects;
CREATE POLICY smartnekam_chat_attachments_insert_member
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'smartnekam-chat-attachments'
    AND (storage.foldername(name))[2] = (SELECT auth.uid())::TEXT
    AND EXISTS (
        SELECT 1 FROM public.chat_conversations c
        WHERE c.id::TEXT = (storage.foldername(name))[1]
          AND public.is_chat_conversation_participant(c.id)
    )
);

DROP POLICY IF EXISTS smartnekam_chat_attachments_update_owner ON storage.objects;
CREATE POLICY smartnekam_chat_attachments_update_owner
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'smartnekam-chat-attachments'
    AND (storage.foldername(name))[2] = (SELECT auth.uid())::TEXT
    AND EXISTS (
        SELECT 1 FROM public.chat_conversations c
        WHERE c.id::TEXT = (storage.foldername(name))[1]
          AND public.is_chat_conversation_participant(c.id)
    )
)
WITH CHECK (
    bucket_id = 'smartnekam-chat-attachments'
    AND (storage.foldername(name))[2] = (SELECT auth.uid())::TEXT
    AND EXISTS (
        SELECT 1 FROM public.chat_conversations c
        WHERE c.id::TEXT = (storage.foldername(name))[1]
          AND public.is_chat_conversation_participant(c.id)
    )
);

DROP POLICY IF EXISTS smartnekam_chat_attachments_delete_owner ON storage.objects;
CREATE POLICY smartnekam_chat_attachments_delete_owner
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'smartnekam-chat-attachments'
    AND (storage.foldername(name))[2] = (SELECT auth.uid())::TEXT
    AND EXISTS (
        SELECT 1 FROM public.chat_conversations c
        WHERE c.id::TEXT = (storage.foldername(name))[1]
          AND public.is_chat_conversation_participant(c.id)
    )
);

-- -----------------------------------------------------------------------------
-- 8. Least-privilege grants
-- -----------------------------------------------------------------------------
REVOKE ALL PRIVILEGES ON TABLE public.mentors FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.chat_conversations FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.chat_participants FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.chat_messages FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.mentor_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.mentor_reviews FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.live_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.live_session_participants FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.community_events FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.community_event_registrations FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.mentors TO authenticated;
GRANT INSERT (user_id, display_name, headline, bio, subjects, hourly_rate, currency, availability, timezone) ON TABLE public.mentors TO authenticated;
GRANT UPDATE (display_name, headline, bio, subjects, hourly_rate, currency, availability, timezone) ON TABLE public.mentors TO authenticated;
-- verified/status/review fields are changed only through review_mentor_profile().

GRANT SELECT ON TABLE public.chat_conversations TO authenticated;
GRANT SELECT ON TABLE public.chat_participants TO authenticated;
GRANT UPDATE (last_read_at, is_muted) ON TABLE public.chat_participants TO authenticated;
GRANT SELECT, DELETE ON TABLE public.chat_messages TO authenticated;
GRANT INSERT (conversation_id, sender_id, body, attachment_path, message_type, reply_to_message_id) ON TABLE public.chat_messages TO authenticated;
GRANT UPDATE (body) ON TABLE public.chat_messages TO authenticated;

GRANT SELECT ON TABLE public.mentor_sessions TO authenticated;
GRANT INSERT (mentor_id, student_id, scheduled_at, duration_minutes, session_format, topic, student_message) ON TABLE public.mentor_sessions TO authenticated;
GRANT SELECT ON TABLE public.mentor_reviews TO authenticated;
GRANT INSERT (mentor_id, session_id, reviewer_id, rating, review) ON TABLE public.mentor_reviews TO authenticated;

GRANT SELECT ON TABLE public.live_sessions TO authenticated;
GRANT INSERT (host_id, title, description, subject_id, scheduled_start, scheduled_end, access_type, meeting_url, capacity) ON TABLE public.live_sessions TO authenticated;
GRANT UPDATE (title, description, subject_id, scheduled_start, scheduled_end, access_type, meeting_url, capacity) ON TABLE public.live_sessions TO authenticated;
-- Publication/lifecycle status is changed only through trusted functions above.
GRANT SELECT ON TABLE public.live_session_participants TO authenticated;
GRANT INSERT (live_session_id, user_id) ON TABLE public.live_session_participants TO authenticated;
GRANT UPDATE (attendance_status) ON TABLE public.live_session_participants TO authenticated;

GRANT SELECT ON TABLE public.community_events TO authenticated;
GRANT INSERT (created_by, title, description, event_type, starts_at, ends_at, venue, registration_url) ON TABLE public.community_events TO authenticated;
GRANT UPDATE (title, description, event_type, starts_at, ends_at, venue, registration_url) ON TABLE public.community_events TO authenticated;
-- Event status is changed only through trusted review/cancel functions above.
GRANT SELECT ON TABLE public.community_event_registrations TO authenticated;
GRANT INSERT (event_id, user_id) ON TABLE public.community_event_registrations TO authenticated;
GRANT UPDATE (status) ON TABLE public.community_event_registrations TO authenticated;

COMMIT;

-- Expected result: Success. No rows returned.
-- Notes:
-- 1. Mentorship chat opens automatically after a mentor accepts a request.
-- 2. Meeting/session notification delivery is implemented later in SQL 007 / Edge Functions.
-- 3. Moderators must approve mentors, live sessions and community events before public listing.

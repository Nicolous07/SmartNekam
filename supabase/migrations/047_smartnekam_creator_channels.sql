-- SmartNekam SQL 047: Creator Channels for Learn
-- Run after SQL 009 and the existing Learn/admin migrations.
-- Additive migration. It does not delete or rewrite existing courses.
-- Ordinary active users may open one public channel and submit courses for review.
-- Submitted creator lessons become visible only after moderator approval.

BEGIN;

CREATE TABLE IF NOT EXISTS public.creator_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    category VARCHAR(32) NOT NULL DEFAULT 'school_subject',
    language VARCHAR(2) NOT NULL DEFAULT 'sw',
    avatar_url TEXT,
    banner_url TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'published',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT creator_channels_name_not_blank CHECK (length(btrim(name)) > 0),
    CONSTRAINT creator_channels_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT creator_channels_category_check CHECK (
        category IN (
            'school_subject', 'life_skills', 'technology', 'business_career',
            'personal_development', 'science', 'creativity', 'health_wellbeing', 'other'
        )
    ),
    CONSTRAINT creator_channels_language_check CHECK (language IN ('sw', 'en')),
    CONSTRAINT creator_channels_status_check CHECK (status IN ('published', 'suspended')),
    CONSTRAINT creator_channels_avatar_url_check CHECK (avatar_url IS NULL OR avatar_url ~* '^https?://'),
    CONSTRAINT creator_channels_banner_url_check CHECK (banner_url IS NULL OR banner_url ~* '^https?://')
);

CREATE INDEX IF NOT EXISTS creator_channels_discovery_idx
    ON public.creator_channels (status, category, created_at DESC);

DROP TRIGGER IF EXISTS creator_channels_set_updated_at ON public.creator_channels;
CREATE TRIGGER creator_channels_set_updated_at
BEFORE UPDATE ON public.creator_channels
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.creator_channel_follows (
    channel_id UUID NOT NULL REFERENCES public.creator_channels(id) ON DELETE CASCADE,
    follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (channel_id, follower_id),
    CONSTRAINT creator_channel_no_self_follow CHECK (
        NOT EXISTS (
            SELECT 1 FROM public.creator_channels c
            WHERE c.id = channel_id AND c.owner_id = follower_id
        )
    )
);

CREATE INDEX IF NOT EXISTS creator_channel_follows_follower_idx
    ON public.creator_channel_follows (follower_id, created_at DESC);

ALTER TABLE public.courses
    ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES public.creator_channels(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS category VARCHAR(32) NOT NULL DEFAULT 'school_subject';

DO $block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'courses_category_check'
          AND conrelid = 'public.courses'::regclass
    ) THEN
        ALTER TABLE public.courses
            ADD CONSTRAINT courses_category_check CHECK (
                category IN (
                    'school_subject', 'life_skills', 'technology', 'business_career',
                    'personal_development', 'science', 'creativity', 'health_wellbeing', 'other'
                )
            );
    END IF;
END;
$block$;

CREATE INDEX IF NOT EXISTS courses_channel_status_idx
    ON public.courses (channel_id, status, published_at DESC);

ALTER TABLE public.creator_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_channel_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creator_channels_select_public_or_owner ON public.creator_channels;
CREATE POLICY creator_channels_select_public_or_owner
ON public.creator_channels FOR SELECT TO anon, authenticated
USING (
    status = 'published'
    OR owner_id = (SELECT auth.uid())
);

DROP POLICY IF EXISTS creator_channels_insert_own ON public.creator_channels;
CREATE POLICY creator_channels_insert_own
ON public.creator_channels FOR INSERT TO authenticated
WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND status = 'published'
    AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid()) AND p.status = 'active'
    )
);

DROP POLICY IF EXISTS creator_channels_update_own ON public.creator_channels;
CREATE POLICY creator_channels_update_own
ON public.creator_channels FOR UPDATE TO authenticated
USING (owner_id = (SELECT auth.uid()))
WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS creator_channel_follows_select_own ON public.creator_channel_follows;
CREATE POLICY creator_channel_follows_select_own
ON public.creator_channel_follows FOR SELECT TO authenticated
USING (follower_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS creator_channel_follows_insert_own ON public.creator_channel_follows;
CREATE POLICY creator_channel_follows_insert_own
ON public.creator_channel_follows FOR INSERT TO authenticated
WITH CHECK (
    follower_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.creator_channels c
        WHERE c.id = channel_id
          AND c.status = 'published'
          AND c.owner_id <> (SELECT auth.uid())
    )
);

DROP POLICY IF EXISTS creator_channel_follows_delete_own ON public.creator_channel_follows;
CREATE POLICY creator_channel_follows_delete_own
ON public.creator_channel_follows FOR DELETE TO authenticated
USING (follower_id = (SELECT auth.uid()));

REVOKE ALL PRIVILEGES ON TABLE public.creator_channels FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.creator_channel_follows FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.creator_channels TO anon, authenticated;
GRANT INSERT (owner_id, name, slug, description, category, language, avatar_url, banner_url)
    ON TABLE public.creator_channels TO authenticated;
GRANT UPDATE (name, slug, description, category, language, avatar_url, banner_url)
    ON TABLE public.creator_channels TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.creator_channel_follows TO authenticated;

CREATE OR REPLACE FUNCTION public.get_creator_channel_follower_count(p_channel_id UUID)
RETURNS BIGINT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT count(*)::BIGINT
    FROM public.creator_channel_follows f
    JOIN public.creator_channels c ON c.id = f.channel_id
    WHERE f.channel_id = p_channel_id
      AND c.status = 'published';
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.get_creator_channel_follower_count(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_creator_channel_follower_count(UUID) TO anon, authenticated;

-- Allow any active user with a published channel to create course drafts.
-- Courses still require moderator review before students can browse them.
DROP POLICY IF EXISTS courses_insert_eligible_creator ON public.courses;
CREATE POLICY courses_insert_eligible_creator ON public.courses
FOR INSERT TO authenticated
WITH CHECK (
    creator_id = (SELECT auth.uid())
    AND status = 'draft'
    AND EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.creator_channels ch ON ch.owner_id = p.id
        WHERE p.id = (SELECT auth.uid())
          AND p.status = 'active'
          AND ch.id = channel_id
          AND ch.status = 'published'
    )
);

GRANT INSERT (channel_id, category) ON TABLE public.courses TO authenticated;
GRANT UPDATE (channel_id, category) ON TABLE public.courses TO authenticated;

-- When a creator submits a course, submit its draft/rejected lessons as well.
CREATE OR REPLACE FUNCTION public.submit_course_for_review(p_course_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_status TEXT;
    v_module_count INTEGER;
    v_lesson_count INTEGER;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT c.status INTO v_status
    FROM public.courses c
    WHERE c.id = p_course_id AND c.creator_id = v_uid
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Course not found or not owned by you.';
    END IF;
    IF v_status NOT IN ('draft', 'rejected') THEN
        RAISE EXCEPTION 'Only draft or rejected courses can be submitted.';
    END IF;

    SELECT count(*)::INTEGER INTO v_module_count
    FROM public.course_modules m WHERE m.course_id = p_course_id;
    SELECT count(*)::INTEGER INTO v_lesson_count
    FROM public.course_lessons l WHERE l.course_id = p_course_id;

    IF v_module_count < 1 OR v_lesson_count < 1 THEN
        RAISE EXCEPTION 'Add at least one module and one lesson before submitting.';
    END IF;

    UPDATE public.course_lessons
       SET status = 'pending_review',
           review_note = NULL,
           reviewed_by = NULL,
           reviewed_at = NULL
     WHERE course_id = p_course_id
       AND status IN ('draft', 'rejected');

    UPDATE public.courses
       SET status = 'pending_review',
           review_note = NULL,
           reviewed_by = NULL,
           reviewed_at = NULL
     WHERE id = p_course_id;

    RETURN pg_catalog.jsonb_build_object(
        'success', TRUE,
        'course_id', p_course_id,
        'status', 'pending_review'
    );
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.submit_course_for_review(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_course_for_review(UUID) TO authenticated;

-- On course approval/rejection, carry the decision to lessons submitted with it.
CREATE OR REPLACE FUNCTION public.review_course(
    p_course_id UUID,
    p_decision TEXT,
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_new_status TEXT;
    v_note TEXT := NULLIF(pg_catalog.btrim(COALESCE(p_note, '')), '');
BEGIN
    IF v_uid IS NULL OR NOT public.is_smartnekam_moderator() THEN
        RAISE EXCEPTION 'Moderator permission required.';
    END IF;
    IF p_decision NOT IN ('approve', 'reject') THEN
        RAISE EXCEPTION 'Decision must be approve or reject.';
    END IF;
    IF p_note IS NOT NULL AND length(p_note) > 3000 THEN
        RAISE EXCEPTION 'Review note is too long.';
    END IF;

    v_new_status := CASE WHEN p_decision = 'approve' THEN 'published' ELSE 'rejected' END;

    UPDATE public.courses
       SET status = v_new_status,
           review_note = v_note,
           reviewed_by = v_uid,
           reviewed_at = pg_catalog.now(),
           published_at = CASE WHEN v_new_status = 'published' THEN pg_catalog.now() ELSE NULL END
     WHERE id = p_course_id AND status = 'pending_review';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pending course not found.';
    END IF;

    UPDATE public.course_lessons
       SET status = v_new_status,
           review_note = v_note,
           reviewed_by = v_uid,
           reviewed_at = pg_catalog.now()
     WHERE course_id = p_course_id
       AND status = 'pending_review';

    RETURN pg_catalog.jsonb_build_object(
        'success', TRUE,
        'course_id', p_course_id,
        'status', v_new_status
    );
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.review_course(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_course(UUID, TEXT, TEXT) TO authenticated;

COMMIT;

-- Verify after successful execution:
-- SELECT to_regclass('public.creator_channels'), to_regclass('public.creator_channel_follows');
-- SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='courses' AND column_name IN ('channel_id','category');

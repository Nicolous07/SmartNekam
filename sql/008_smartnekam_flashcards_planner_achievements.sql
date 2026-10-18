-- SmartNekam | SQL 008: Flashcards, Study Planner, Achievements and Leaderboards
-- Prerequisites: SQL 001A, 001B, 002, 003, 004 FIXED, 005, 006, and 007 must have run.
-- Run this ENTIRE file in Supabase Dashboard > SQL Editor > New query.
-- This migration is re-runnable during development and does not drop user data.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Profile privacy setting for opt-in leaderboards
-- Users are opted OUT by default. The leaderboard RPC returns no phone/email.
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS show_on_leaderboard BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS profiles_leaderboard_opt_in_idx
    ON public.profiles (show_on_leaderboard, status, role)
    WHERE show_on_leaderboard = TRUE;

GRANT UPDATE (show_on_leaderboard) ON TABLE public.profiles TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. Flashcard decks and cards
-- Public decks must be submitted for review; students cannot directly publish.
-- Private decks are visible to their owner even while status is draft.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.flashcard_decks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    title VARCHAR(180) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    level VARCHAR(30),
    visibility VARCHAR(16) NOT NULL DEFAULT 'private',
    status VARCHAR(24) NOT NULL DEFAULT 'draft',
    review_note TEXT,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT flashcard_decks_title_not_blank CHECK (length(btrim(title)) > 0),
    CONSTRAINT flashcard_decks_level_check
        CHECK (level IS NULL OR level IN ('O_LEVEL', 'A_LEVEL', 'UNIVERSITY')),
    CONSTRAINT flashcard_decks_visibility_check CHECK (visibility IN ('private', 'public')),
    CONSTRAINT flashcard_decks_status_check
        CHECK (status IN ('draft', 'pending_review', 'published', 'rejected', 'archived')),
    CONSTRAINT flashcard_decks_id_owner_unique UNIQUE (id, owner_id)
);

CREATE INDEX IF NOT EXISTS flashcard_decks_owner_updated_idx
    ON public.flashcard_decks (owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS flashcard_decks_public_discovery_idx
    ON public.flashcard_decks (subject_id, level, created_at DESC)
    WHERE visibility = 'public' AND status = 'published';

DROP TRIGGER IF EXISTS flashcard_decks_set_updated_at ON public.flashcard_decks;
CREATE TRIGGER flashcard_decks_set_updated_at
BEFORE UPDATE ON public.flashcard_decks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.flashcards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id UUID NOT NULL,
    owner_id UUID NOT NULL DEFAULT auth.uid(),
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT flashcards_front_not_blank CHECK (length(btrim(front)) > 0),
    CONSTRAINT flashcards_back_not_blank CHECK (length(btrim(back)) > 0),
    CONSTRAINT flashcards_position_positive CHECK (position > 0),
    CONSTRAINT flashcards_deck_position_unique UNIQUE (deck_id, position),
    CONSTRAINT flashcards_deck_owner_fk FOREIGN KEY (deck_id, owner_id)
        REFERENCES public.flashcard_decks(id, owner_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS flashcards_deck_order_idx
    ON public.flashcards (deck_id, position);
CREATE INDEX IF NOT EXISTS flashcards_owner_created_idx
    ON public.flashcards (owner_id, created_at DESC);

DROP TRIGGER IF EXISTS flashcards_set_updated_at ON public.flashcards;
CREATE TRIGGER flashcards_set_updated_at
BEFORE UPDATE ON public.flashcards
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Spaced-repetition state is private per user/card and written only by the RPC.
CREATE TABLE IF NOT EXISTS public.flashcard_reviews (
    user_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES public.profiles(id) ON DELETE CASCADE,
    flashcard_id UUID NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
    repetition_count INTEGER NOT NULL DEFAULT 0,
    interval_days INTEGER NOT NULL DEFAULT 0,
    ease_factor NUMERIC(4,2) NOT NULL DEFAULT 2.50,
    due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_reviewed_at TIMESTAMPTZ,
    last_grade SMALLINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, flashcard_id),
    CONSTRAINT flashcard_reviews_repetition_nonnegative CHECK (repetition_count >= 0),
    CONSTRAINT flashcard_reviews_interval_nonnegative CHECK (interval_days >= 0),
    CONSTRAINT flashcard_reviews_ease_check CHECK (ease_factor >= 1.30 AND ease_factor <= 5.00),
    CONSTRAINT flashcard_reviews_grade_check CHECK (last_grade IS NULL OR last_grade BETWEEN 0 AND 5)
);

CREATE INDEX IF NOT EXISTS flashcard_reviews_due_idx
    ON public.flashcard_reviews (user_id, due_at);
DROP TRIGGER IF EXISTS flashcard_reviews_set_updated_at ON public.flashcard_reviews;
CREATE TRIGGER flashcard_reviews_set_updated_at
BEFORE UPDATE ON public.flashcard_reviews
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Submit a public deck for moderator review. A deck must contain at least one card.
CREATE OR REPLACE FUNCTION public.submit_flashcard_deck(p_deck_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := auth.uid();
    v_visibility TEXT;
    v_status TEXT;
    v_card_count INTEGER;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT d.visibility, d.status
      INTO v_visibility, v_status
      FROM public.flashcard_decks AS d
     WHERE d.id = p_deck_id AND d.owner_id = v_uid
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Flashcard deck not found or not owned by you.';
    END IF;
    IF v_visibility <> 'public' THEN
        RAISE EXCEPTION 'Only public decks need to be submitted for review.';
    END IF;
    IF v_status NOT IN ('draft', 'rejected') THEN
        RAISE EXCEPTION 'Only draft or rejected decks can be submitted.';
    END IF;

    SELECT count(*)::INTEGER INTO v_card_count
      FROM public.flashcards AS f
     WHERE f.deck_id = p_deck_id AND f.owner_id = v_uid;

    IF v_card_count < 1 THEN
        RAISE EXCEPTION 'Add at least one flashcard before submission.';
    END IF;

    UPDATE public.flashcard_decks
       SET status = 'pending_review', review_note = NULL,
           reviewed_by = NULL, reviewed_at = NULL
     WHERE id = p_deck_id;

    RETURN pg_catalog.jsonb_build_object(
        'success', TRUE, 'deck_id', p_deck_id, 'status', 'pending_review'
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.review_flashcard_deck(
    p_deck_id UUID,
    p_decision TEXT,
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := auth.uid();
    v_new_status TEXT;
BEGIN
    IF v_uid IS NULL OR NOT public.is_smartnekam_moderator() THEN
        RAISE EXCEPTION 'Moderator permission required.';
    END IF;
    IF p_decision NOT IN ('approve', 'reject') THEN
        RAISE EXCEPTION 'Decision must be approve or reject.';
    END IF;
    IF p_note IS NOT NULL AND length(p_note) > 2000 THEN
        RAISE EXCEPTION 'Review note is too long.';
    END IF;

    v_new_status := CASE WHEN p_decision = 'approve' THEN 'published' ELSE 'rejected' END;
    UPDATE public.flashcard_decks
       SET status = v_new_status,
           review_note = NULLIF(pg_catalog.btrim(COALESCE(p_note, '')), ''),
           reviewed_by = v_uid,
           reviewed_at = pg_catalog.now()
     WHERE id = p_deck_id AND status = 'pending_review' AND visibility = 'public';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pending public deck not found.';
    END IF;

    RETURN pg_catalog.jsonb_build_object(
        'success', TRUE, 'deck_id', p_deck_id, 'status', v_new_status
    );
END;
$function$;

-- Review a card using a simple SM-2-style schedule; grade is 0 (forgot) to 5 (easy).
CREATE OR REPLACE FUNCTION public.review_flashcard(
    p_flashcard_id UUID,
    p_grade SMALLINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := auth.uid();
    v_owner UUID;
    v_visibility TEXT;
    v_deck_status TEXT;
    v_repetitions INTEGER := 0;
    v_old_interval INTEGER := 0;
    v_old_ease NUMERIC(4,2) := 2.50;
    v_new_repetitions INTEGER;
    v_new_interval INTEGER;
    v_new_ease NUMERIC(4,2);
    v_due_at TIMESTAMPTZ;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;
    IF p_grade IS NULL OR p_grade < 0 OR p_grade > 5 THEN
        RAISE EXCEPTION 'Grade must be between 0 and 5.';
    END IF;

    SELECT d.owner_id, d.visibility, d.status
      INTO v_owner, v_visibility, v_deck_status
      FROM public.flashcards AS f
      JOIN public.flashcard_decks AS d ON d.id = f.deck_id
     WHERE f.id = p_flashcard_id;

    IF NOT FOUND OR NOT (
        v_owner = v_uid OR (v_visibility = 'public' AND v_deck_status = 'published')
    ) THEN
        RAISE EXCEPTION 'Flashcard not found or not accessible.';
    END IF;

    SELECT r.repetition_count, r.interval_days, r.ease_factor
      INTO v_repetitions, v_old_interval, v_old_ease
      FROM public.flashcard_reviews AS r
     WHERE r.user_id = v_uid AND r.flashcard_id = p_flashcard_id
     FOR UPDATE;

    IF NOT FOUND THEN
        v_repetitions := 0;
        v_old_interval := 0;
        v_old_ease := 2.50;
    END IF;

    v_new_ease := GREATEST(
        1.30,
        v_old_ease + (0.10 - (5 - p_grade) * (0.08 + (5 - p_grade) * 0.02))
    );

    IF p_grade < 3 THEN
        v_new_repetitions := 0;
        v_new_interval := 1;
    ELSE
        v_new_repetitions := v_repetitions + 1;
        IF v_repetitions = 0 THEN
            v_new_interval := 1;
        ELSIF v_repetitions = 1 THEN
            v_new_interval := 6;
        ELSE
            v_new_interval := GREATEST(1, CEIL(v_old_interval * v_old_ease)::INTEGER);
        END IF;
    END IF;

    v_due_at := pg_catalog.now() + pg_catalog.make_interval(days => v_new_interval);

    INSERT INTO public.flashcard_reviews (
        user_id, flashcard_id, repetition_count, interval_days, ease_factor,
        due_at, last_reviewed_at, last_grade
    ) VALUES (
        v_uid, p_flashcard_id, v_new_repetitions, v_new_interval, v_new_ease,
        v_due_at, pg_catalog.now(), p_grade
    )
    ON CONFLICT (user_id, flashcard_id) DO UPDATE
       SET repetition_count = EXCLUDED.repetition_count,
           interval_days = EXCLUDED.interval_days,
           ease_factor = EXCLUDED.ease_factor,
           due_at = EXCLUDED.due_at,
           last_reviewed_at = EXCLUDED.last_reviewed_at,
           last_grade = EXCLUDED.last_grade;

    RETURN pg_catalog.jsonb_build_object(
        'success', TRUE,
        'flashcard_id', p_flashcard_id,
        'repetition_count', v_new_repetitions,
        'interval_days', v_new_interval,
        'ease_factor', v_new_ease,
        'due_at', v_due_at
    );
END;
$function$;

-- -----------------------------------------------------------------------------
-- 3. Study plans, scheduled items, and reminders
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.study_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES public.profiles(id) ON DELETE CASCADE,
    title VARCHAR(180) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    start_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::DATE,
    end_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT study_plans_title_not_blank CHECK (length(btrim(title)) > 0),
    CONSTRAINT study_plans_dates_check CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT study_plans_status_check CHECK (status IN ('active', 'completed', 'archived')),
    CONSTRAINT study_plans_id_user_unique UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS study_plans_user_status_idx
    ON public.study_plans (user_id, status, start_date DESC);
DROP TRIGGER IF EXISTS study_plans_set_updated_at ON public.study_plans;
CREATE TRIGGER study_plans_set_updated_at
BEFORE UPDATE ON public.study_plans
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.study_plan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL,
    user_id UUID NOT NULL DEFAULT auth.uid(),
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    title VARCHAR(180) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    scheduled_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    duration_minutes SMALLINT,
    status VARCHAR(20) NOT NULL DEFAULT 'planned',
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT study_plan_items_title_not_blank CHECK (length(btrim(title)) > 0),
    CONSTRAINT study_plan_items_time_check CHECK (
        start_time IS NULL OR end_time IS NULL OR end_time > start_time
    ),
    CONSTRAINT study_plan_items_duration_check CHECK (
        duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 720
    ),
    CONSTRAINT study_plan_items_status_check
        CHECK (status IN ('planned', 'in_progress', 'completed', 'skipped')),
    CONSTRAINT study_plan_items_id_user_unique UNIQUE (id, user_id),
    CONSTRAINT study_plan_items_plan_user_fk FOREIGN KEY (plan_id, user_id)
        REFERENCES public.study_plans(id, user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS study_plan_items_calendar_idx
    ON public.study_plan_items (user_id, scheduled_date, start_time);
CREATE INDEX IF NOT EXISTS study_plan_items_plan_status_idx
    ON public.study_plan_items (plan_id, status);
DROP TRIGGER IF EXISTS study_plan_items_set_updated_at ON public.study_plan_items;
CREATE TRIGGER study_plan_items_set_updated_at
BEFORE UPDATE ON public.study_plan_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.study_plan_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL,
    user_id UUID NOT NULL DEFAULT auth.uid(),
    reminder_at TIMESTAMPTZ NOT NULL,
    channel VARCHAR(16) NOT NULL DEFAULT 'in_app',
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT study_plan_reminders_channel_check CHECK (channel IN ('in_app', 'push', 'email')),
    CONSTRAINT study_plan_reminders_status_check CHECK (status IN ('scheduled', 'sent', 'cancelled', 'failed')),
    CONSTRAINT study_plan_reminders_item_user_fk FOREIGN KEY (item_id, user_id)
        REFERENCES public.study_plan_items(id, user_id) ON DELETE CASCADE,
    CONSTRAINT study_plan_reminders_unique UNIQUE (user_id, item_id, reminder_at, channel)
);

CREATE INDEX IF NOT EXISTS study_plan_reminders_due_idx
    ON public.study_plan_reminders (status, reminder_at)
    WHERE status = 'scheduled';

-- Completion records a qualifying learning day and updates the same streak fields
-- used by SQL 004. It deliberately awards no XP; scoring rules can be added later.
CREATE OR REPLACE FUNCTION public.complete_study_plan_item(p_item_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := auth.uid();
    v_item_id UUID;
    v_existing_status TEXT;
    v_activity_date DATE := (pg_catalog.now() AT TIME ZONE 'Africa/Dar_es_Salaam')::DATE;
    v_new_activity_date DATE;
    v_streak INTEGER;
    v_longest_streak INTEGER;
    v_last_activity_date DATE;
    v_new_streak INTEGER;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    UPDATE public.study_plan_items
       SET status = 'completed', completed_at = pg_catalog.now(), updated_at = pg_catalog.now()
     WHERE id = p_item_id AND user_id = v_uid AND status <> 'completed'
     RETURNING id INTO v_item_id;

    IF NOT FOUND THEN
        SELECT i.status INTO v_existing_status
          FROM public.study_plan_items AS i
         WHERE i.id = p_item_id AND i.user_id = v_uid;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Study plan item not found.';
        END IF;
        RETURN pg_catalog.jsonb_build_object(
            'success', TRUE, 'already_completed', (v_existing_status = 'completed'),
            'status', v_existing_status
        );
    END IF;

    INSERT INTO public.user_learning_days (user_id, activity_date, activity_type, source_id, xp_earned)
    VALUES (v_uid, v_activity_date, 'study_plan', v_item_id, 0)
    ON CONFLICT (user_id, activity_date) DO NOTHING
    RETURNING activity_date INTO v_new_activity_date;

    IF v_new_activity_date IS NOT NULL THEN
        SELECT p.streak, p.longest_streak, p.last_activity_date
          INTO v_streak, v_longest_streak, v_last_activity_date
          FROM public.profiles AS p
         WHERE p.id = v_uid
         FOR UPDATE;

        IF v_last_activity_date IS NULL THEN
            v_new_streak := 1;
        ELSIF v_last_activity_date = v_activity_date THEN
            v_new_streak := v_streak;
        ELSIF v_last_activity_date = (v_activity_date - 1) THEN
            v_new_streak := v_streak + 1;
        ELSIF v_last_activity_date < (v_activity_date - 1) THEN
            v_new_streak := 1;
        ELSE
            v_new_streak := v_streak;
        END IF;

        IF v_last_activity_date IS NULL OR v_activity_date > v_last_activity_date THEN
            UPDATE public.profiles
               SET streak = v_new_streak,
                   longest_streak = GREATEST(v_longest_streak, v_new_streak),
                   last_activity_date = v_activity_date
             WHERE id = v_uid;
        END IF;
    END IF;

    RETURN pg_catalog.jsonb_build_object(
        'success', TRUE, 'already_completed', FALSE,
        'item_id', v_item_id, 'status', 'completed', 'activity_date', v_activity_date
    );
END;
$function$;

-- -----------------------------------------------------------------------------
-- 4. Achievement catalog, awards and leaderboard RPC
-- Awards and reward XP are written by a moderator-only function (not by clients).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(64) NOT NULL UNIQUE,
    name_sw VARCHAR(120) NOT NULL,
    name_en VARCHAR(120) NOT NULL,
    description_sw TEXT NOT NULL DEFAULT '',
    description_en TEXT NOT NULL DEFAULT '',
    category VARCHAR(32) NOT NULL DEFAULT 'learning',
    icon_key VARCHAR(64) NOT NULL DEFAULT 'award',
    xp_reward INTEGER NOT NULL DEFAULT 0,
    criteria JSONB NOT NULL DEFAULT '{}'::JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT achievements_slug_format_check CHECK (slug ~ '^[a-z0-9_]+$'),
    CONSTRAINT achievements_category_check CHECK (
        category IN ('learning', 'community', 'contribution', 'streak', 'opportunity', 'special')
    ),
    CONSTRAINT achievements_xp_nonnegative CHECK (xp_reward >= 0),
    CONSTRAINT achievements_criteria_object_check CHECK (pg_catalog.jsonb_typeof(criteria) = 'object')
);

CREATE TABLE IF NOT EXISTS public.user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE RESTRICT,
    awarded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reason TEXT,
    progress_data JSONB NOT NULL DEFAULT '{}'::JSONB,
    awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_achievements_once UNIQUE (user_id, achievement_id),
    CONSTRAINT user_achievements_progress_object_check CHECK (pg_catalog.jsonb_typeof(progress_data) = 'object')
);

CREATE INDEX IF NOT EXISTS user_achievements_user_awarded_idx
    ON public.user_achievements (user_id, awarded_at DESC);

INSERT INTO public.achievements
    (slug, name_sw, name_en, description_sw, description_en, category, icon_key, xp_reward, criteria)
VALUES
    ('first_daily_challenge', 'Changamoto ya Kwanza', 'First Daily Challenge',
     'Kamilisha Daily Challenge yako ya kwanza.', 'Complete your first Daily Challenge.',
     'learning', 'target', 10, '{"type":"daily_challenge_count","target":1}'::JSONB),
    ('streak_3_days', 'Siku Tatu Mfululizo', 'Three-Day Streak',
     'Jifunze siku tatu mfululizo.', 'Learn for three consecutive days.',
     'streak', 'flame', 15, '{"type":"streak_days","target":3}'::JSONB),
    ('streak_7_days', 'Wiki ya Kujifunza', 'One-Week Streak',
     'Dumisha mfululizo wa kujifunza wa siku saba.', 'Maintain a seven-day learning streak.',
     'streak', 'calendar-check', 30, '{"type":"streak_days","target":7}'::JSONB),
    ('streak_30_days', 'Mwezi wa Nidhamu', 'Thirty-Day Streak',
     'Jifunze siku thelathini mfululizo.', 'Maintain a thirty-day learning streak.',
     'streak', 'trophy', 100, '{"type":"streak_days","target":30}'::JSONB),
    ('first_note_upload', 'Mchangiaji wa Kwanza', 'First Resource Contribution',
     'Changia nyenzo ya kwanza ya masomo.', 'Contribute your first learning resource.',
     'contribution', 'book-open', 10, '{"type":"approved_resource_count","target":1}'::JSONB),
    ('first_best_answer', 'Msaidizi wa Kwanza', 'First Best Answer',
     'Jibu lako la kwanza limechaguliwa kuwa jibu bora.', 'Have your first answer selected as best answer.',
     'community', 'message-circle-check', 15, '{"type":"best_answer_count","target":1}'::JSONB),
    ('first_flashcard_deck', 'Mtengenezaji wa Kadi', 'Flashcard Creator',
     'Tengeneza seti yako ya kwanza ya flashcards.', 'Create your first flashcard deck.',
     'learning', 'layers', 10, '{"type":"flashcard_deck_count","target":1}'::JSONB)
ON CONFLICT (slug) DO NOTHING;

-- Add achievement as a valid XP-ledger source while preserving existing source types.
ALTER TABLE public.xp_ledger DROP CONSTRAINT IF EXISTS xp_ledger_source_type_check;
ALTER TABLE public.xp_ledger
    ADD CONSTRAINT xp_ledger_source_type_check CHECK (
        source_type IN (
            'daily_challenge', 'quiz', 'best_answer', 'note_upload', 'group_help',
            'referral', 'admin_adjustment', 'achievement'
        )
    );

CREATE OR REPLACE FUNCTION public.grant_smartnekam_achievement(
    p_user_id UUID,
    p_slug TEXT,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := auth.uid();
    v_achievement public.achievements%ROWTYPE;
    v_award_id UUID;
    v_ledger_id UUID;
BEGIN
    IF v_uid IS NULL OR NOT public.is_smartnekam_moderator() THEN
        RAISE EXCEPTION 'Moderator permission required.';
    END IF;
    IF p_user_id IS NULL OR p_slug IS NULL OR length(pg_catalog.btrim(p_slug)) = 0 THEN
        RAISE EXCEPTION 'User ID and achievement slug are required.';
    END IF;
    IF p_reason IS NOT NULL AND length(p_reason) > 2000 THEN
        RAISE EXCEPTION 'Reason is too long.';
    END IF;

    SELECT a.* INTO v_achievement
      FROM public.achievements AS a
     WHERE a.slug = pg_catalog.lower(pg_catalog.btrim(p_slug))
       AND a.is_active = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active achievement not found.';
    END IF;

    INSERT INTO public.user_achievements (user_id, achievement_id, awarded_by, reason)
    VALUES (p_user_id, v_achievement.id, v_uid, NULLIF(pg_catalog.btrim(COALESCE(p_reason, '')), ''))
    ON CONFLICT (user_id, achievement_id) DO NOTHING
    RETURNING id INTO v_award_id;

    IF v_award_id IS NULL THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', TRUE, 'already_awarded', TRUE,
            'user_id', p_user_id, 'achievement_slug', v_achievement.slug
        );
    END IF;

    IF v_achievement.xp_reward > 0 THEN
        INSERT INTO public.xp_ledger (user_id, source_type, source_id, amount, description)
        VALUES (
            p_user_id, 'achievement', v_achievement.id, v_achievement.xp_reward,
            'Achievement awarded: ' || v_achievement.slug
        )
        ON CONFLICT (user_id, source_type, source_id) DO NOTHING
        RETURNING id INTO v_ledger_id;

        IF v_ledger_id IS NOT NULL THEN
            UPDATE public.profiles
               SET xp = xp + v_achievement.xp_reward
             WHERE id = p_user_id;
        END IF;
    END IF;

    RETURN pg_catalog.jsonb_build_object(
        'success', TRUE, 'already_awarded', FALSE,
        'user_id', p_user_id, 'achievement_slug', v_achievement.slug,
        'xp_awarded', CASE WHEN v_ledger_id IS NULL THEN 0 ELSE v_achievement.xp_reward END
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_smartnekam_leaderboard(
    p_period TEXT DEFAULT 'all_time',
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    rank_position BIGINT,
    user_id UUID,
    display_name TEXT,
    level TEXT,
    total_xp BIGINT,
    current_streak INTEGER,
    longest_streak INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := auth.uid();
    v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;
    IF p_period IS NULL OR p_period NOT IN ('all_time', 'week', 'month') THEN
        RAISE EXCEPTION 'Period must be all_time, week, or month.';
    END IF;

    RETURN QUERY
    WITH leaderboard_points AS (
        SELECT
            p.id AS uid,
            p.full_name::TEXT AS uname,
            COALESCE(p.level, '')::TEXT AS academic_level,
            p.streak AS active_streak,
            p.longest_streak AS best_streak,
            CASE
                WHEN p_period = 'all_time' THEN p.xp::BIGINT
                ELSE COALESCE(SUM(x.amount), 0)::BIGINT
            END AS points
        FROM public.profiles AS p
        LEFT JOIN public.xp_ledger AS x
          ON x.user_id = p.id
         AND (
             (p_period = 'week' AND x.created_at >= (
                 pg_catalog.date_trunc('week', pg_catalog.now() AT TIME ZONE 'Africa/Dar_es_Salaam')
                 AT TIME ZONE 'Africa/Dar_es_Salaam'
             ))
             OR
             (p_period = 'month' AND x.created_at >= (
                 pg_catalog.date_trunc('month', pg_catalog.now() AT TIME ZONE 'Africa/Dar_es_Salaam')
                 AT TIME ZONE 'Africa/Dar_es_Salaam'
             ))
             OR p_period = 'all_time'
         )
        WHERE p.role = 'student'
          AND p.status = 'active'
          AND p.show_on_leaderboard = TRUE
        GROUP BY p.id, p.full_name, p.level, p.streak, p.longest_streak, p.xp
    ), ranked AS (
        SELECT
            pg_catalog.row_number() OVER (
                ORDER BY lp.points DESC, lp.active_streak DESC, lp.uname ASC
            ) AS pos,
            lp.*
        FROM leaderboard_points AS lp
    )
    SELECT
        r.pos::BIGINT,
        r.uid,
        r.uname,
        r.academic_level,
        r.points,
        r.active_streak,
        r.best_streak
    FROM ranked AS r
    ORDER BY r.pos
    LIMIT v_limit;
END;
$function$;

-- -----------------------------------------------------------------------------
-- 5. Row Level Security policies
-- -----------------------------------------------------------------------------
ALTER TABLE public.flashcard_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcard_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_plan_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS flashcard_decks_select_visible ON public.flashcard_decks;
CREATE POLICY flashcard_decks_select_visible ON public.flashcard_decks
FOR SELECT TO authenticated
USING (
    owner_id = (SELECT auth.uid())
    OR (visibility = 'public' AND status = 'published')
    OR public.is_smartnekam_moderator()
);
DROP POLICY IF EXISTS flashcard_decks_insert_own ON public.flashcard_decks;
CREATE POLICY flashcard_decks_insert_own ON public.flashcard_decks
FOR INSERT TO authenticated
WITH CHECK (owner_id = (SELECT auth.uid()) AND status = 'draft');
DROP POLICY IF EXISTS flashcard_decks_update_own_draft ON public.flashcard_decks;
CREATE POLICY flashcard_decks_update_own_draft ON public.flashcard_decks
FOR UPDATE TO authenticated
USING (owner_id = (SELECT auth.uid()) AND status IN ('draft', 'rejected'))
WITH CHECK (owner_id = (SELECT auth.uid()) AND status IN ('draft', 'rejected'));
DROP POLICY IF EXISTS flashcard_decks_update_moderator ON public.flashcard_decks;
CREATE POLICY flashcard_decks_update_moderator ON public.flashcard_decks
FOR UPDATE TO authenticated
USING (public.is_smartnekam_moderator())
WITH CHECK (public.is_smartnekam_moderator());
DROP POLICY IF EXISTS flashcard_decks_delete_own_draft ON public.flashcard_decks;
CREATE POLICY flashcard_decks_delete_own_draft ON public.flashcard_decks
FOR DELETE TO authenticated
USING (owner_id = (SELECT auth.uid()) AND status IN ('draft', 'rejected', 'archived'));
DROP POLICY IF EXISTS flashcard_decks_delete_moderator ON public.flashcard_decks;
CREATE POLICY flashcard_decks_delete_moderator ON public.flashcard_decks
FOR DELETE TO authenticated
USING (public.is_smartnekam_moderator());

DROP POLICY IF EXISTS flashcards_select_visible ON public.flashcards;
CREATE POLICY flashcards_select_visible ON public.flashcards
FOR SELECT TO authenticated
USING (
    owner_id = (SELECT auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.flashcard_decks AS d
        WHERE d.id = deck_id AND d.visibility = 'public' AND d.status = 'published'
    )
    OR public.is_smartnekam_moderator()
);
DROP POLICY IF EXISTS flashcards_insert_own_draft ON public.flashcards;
CREATE POLICY flashcards_insert_own_draft ON public.flashcards
FOR INSERT TO authenticated
WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.flashcard_decks AS d
        WHERE d.id = deck_id AND d.owner_id = (SELECT auth.uid())
          AND d.status IN ('draft', 'rejected')
    )
);
DROP POLICY IF EXISTS flashcards_update_own_draft ON public.flashcards;
CREATE POLICY flashcards_update_own_draft ON public.flashcards
FOR UPDATE TO authenticated
USING (
    owner_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.flashcard_decks AS d
        WHERE d.id = deck_id AND d.owner_id = (SELECT auth.uid())
          AND d.status IN ('draft', 'rejected')
    )
)
WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.flashcard_decks AS d
        WHERE d.id = deck_id AND d.owner_id = (SELECT auth.uid())
          AND d.status IN ('draft', 'rejected')
    )
);
DROP POLICY IF EXISTS flashcards_delete_own_draft ON public.flashcards;
CREATE POLICY flashcards_delete_own_draft ON public.flashcards
FOR DELETE TO authenticated
USING (
    owner_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.flashcard_decks AS d
        WHERE d.id = deck_id AND d.owner_id = (SELECT auth.uid())
          AND d.status IN ('draft', 'rejected', 'archived')
    )
);

DROP POLICY IF EXISTS flashcard_reviews_select_own ON public.flashcard_reviews;
CREATE POLICY flashcard_reviews_select_own ON public.flashcard_reviews
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS study_plans_select_own ON public.study_plans;
CREATE POLICY study_plans_select_own ON public.study_plans
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS study_plans_insert_own ON public.study_plans;
CREATE POLICY study_plans_insert_own ON public.study_plans
FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS study_plans_update_own ON public.study_plans;
CREATE POLICY study_plans_update_own ON public.study_plans
FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS study_plans_delete_own ON public.study_plans;
CREATE POLICY study_plans_delete_own ON public.study_plans
FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS study_plan_items_select_own ON public.study_plan_items;
CREATE POLICY study_plan_items_select_own ON public.study_plan_items
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS study_plan_items_insert_own ON public.study_plan_items;
CREATE POLICY study_plan_items_insert_own ON public.study_plan_items
FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS study_plan_items_update_own ON public.study_plan_items;
CREATE POLICY study_plan_items_update_own ON public.study_plan_items
FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS study_plan_items_delete_own ON public.study_plan_items;
CREATE POLICY study_plan_items_delete_own ON public.study_plan_items
FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS study_plan_reminders_select_own ON public.study_plan_reminders;
CREATE POLICY study_plan_reminders_select_own ON public.study_plan_reminders
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS study_plan_reminders_insert_own ON public.study_plan_reminders;
CREATE POLICY study_plan_reminders_insert_own ON public.study_plan_reminders
FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS study_plan_reminders_update_own ON public.study_plan_reminders;
CREATE POLICY study_plan_reminders_update_own ON public.study_plan_reminders
FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS study_plan_reminders_delete_own ON public.study_plan_reminders;
CREATE POLICY study_plan_reminders_delete_own ON public.study_plan_reminders
FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS achievements_select_active_or_moderator ON public.achievements;
CREATE POLICY achievements_select_active_or_moderator ON public.achievements
FOR SELECT TO authenticated
USING (is_active = TRUE OR public.is_smartnekam_moderator());
DROP POLICY IF EXISTS achievements_insert_moderator ON public.achievements;
CREATE POLICY achievements_insert_moderator ON public.achievements
FOR INSERT TO authenticated WITH CHECK (public.is_smartnekam_moderator());
DROP POLICY IF EXISTS achievements_update_moderator ON public.achievements;
CREATE POLICY achievements_update_moderator ON public.achievements
FOR UPDATE TO authenticated USING (public.is_smartnekam_moderator())
WITH CHECK (public.is_smartnekam_moderator());
DROP POLICY IF EXISTS achievements_delete_moderator ON public.achievements;
CREATE POLICY achievements_delete_moderator ON public.achievements
FOR DELETE TO authenticated USING (public.is_smartnekam_moderator());

DROP POLICY IF EXISTS user_achievements_select_own_or_moderator ON public.user_achievements;
CREATE POLICY user_achievements_select_own_or_moderator ON public.user_achievements
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) OR public.is_smartnekam_moderator());

-- -----------------------------------------------------------------------------
-- 6. Least-privilege grants
-- -----------------------------------------------------------------------------
REVOKE ALL PRIVILEGES ON TABLE public.flashcard_decks FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.flashcards FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.flashcard_reviews FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.study_plans FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.study_plan_items FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.study_plan_reminders FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.achievements FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.user_achievements FROM PUBLIC, anon, authenticated;

GRANT SELECT, DELETE ON TABLE public.flashcard_decks TO authenticated;
GRANT INSERT (owner_id, subject_id, title, description, level, visibility)
    ON TABLE public.flashcard_decks TO authenticated;
GRANT UPDATE (title, description, subject_id, level, visibility)
    ON TABLE public.flashcard_decks TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.flashcards TO authenticated;
GRANT SELECT ON TABLE public.flashcard_reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.study_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.study_plan_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.study_plan_reminders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.achievements TO authenticated;
GRANT SELECT ON TABLE public.user_achievements TO authenticated;

REVOKE ALL PRIVILEGES ON FUNCTION public.submit_flashcard_deck(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.review_flashcard_deck(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.review_flashcard(UUID, SMALLINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.complete_study_plan_item(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.grant_smartnekam_achievement(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.get_smartnekam_leaderboard(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.submit_flashcard_deck(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_flashcard_deck(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_flashcard(UUID, SMALLINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_study_plan_item(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_smartnekam_achievement(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_smartnekam_leaderboard(TEXT, INTEGER) TO authenticated;

COMMIT;

-- Expected result: Success. No rows returned.
-- Verify with the SELECT statements provided in the accompanying instructions.

-- SmartNekam | SQL 004: Quizzes, Daily Challenge, XP, and Streaks
-- Prerequisites: SQL 001A, 001B, SQL 002, and SQL 003 have run successfully.
-- Run this entire file once in Supabase Dashboard > SQL Editor > New query.
-- This migration does not drop existing tables or delete data.
-- XP rule used by this MVP: Daily Challenge = 5 XP for completion + 2 XP per correct answer.
-- Non-daily quiz: 2 XP per correct answer, rewarded once per user per quiz.
-- The PRD specifies XP/streak behaviour but does not prescribe exact XP numbers; these can be tuned later.

BEGIN;

-- PostgreSQL does not provide jsonb_object_length(jsonb). Use this immutable helper
-- so the quiz options constraint can enforce at least two keys in an object.
CREATE OR REPLACE FUNCTION public.smartnekam_jsonb_object_key_count(p_value JSONB)
RETURNS INTEGER
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $function$
    SELECT CASE
        WHEN pg_catalog.jsonb_typeof(p_value) = 'object' THEN
            (SELECT count(*)::INTEGER FROM pg_catalog.jsonb_object_keys(p_value))
        ELSE 0
    END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.smartnekam_jsonb_object_key_count(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smartnekam_jsonb_object_key_count(JSONB) TO authenticated;

-- -----------------------------------------------------------------------------
-- 1. Additional profile fields for streak tracking
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS longest_streak INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_activity_date DATE;

DO $block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'profiles_longest_streak_nonnegative'
          AND conrelid = 'public.profiles'::regclass
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_longest_streak_nonnegative CHECK (longest_streak >= 0);
    END IF;
END;
$block$;

-- -----------------------------------------------------------------------------
-- 2. Quiz catalog and questions
-- Correct answers are stored separately to prevent students from selecting them
-- directly through the public Supabase API before submitting a quiz.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    level VARCHAR(30),
    quiz_type VARCHAR(20) NOT NULL DEFAULT 'subject',
    duration_minutes SMALLINT NOT NULL DEFAULT 5,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_by UUID NOT NULL DEFAULT auth.uid()
        REFERENCES public.profiles(id) ON DELETE CASCADE,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT quizzes_title_not_blank CHECK (length(btrim(title)) > 0),
    CONSTRAINT quizzes_type_check CHECK (quiz_type IN ('daily', 'subject', 'mock')),
    CONSTRAINT quizzes_level_check CHECK (level IS NULL OR level IN ('O_LEVEL', 'A_LEVEL', 'UNIVERSITY')),
    CONSTRAINT quizzes_duration_check CHECK (duration_minutes BETWEEN 1 AND 180),
    CONSTRAINT quizzes_status_check CHECK (status IN ('draft', 'published', 'archived'))
);
CREATE INDEX IF NOT EXISTS quizzes_discovery_idx
    ON public.quizzes (status, quiz_type, level, created_at DESC);
CREATE INDEX IF NOT EXISTS quizzes_subject_idx
    ON public.quizzes (subject_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS quizzes_creator_idx
    ON public.quizzes (created_by, created_at DESC);

DROP TRIGGER IF EXISTS quizzes_set_updated_at ON public.quizzes;
CREATE TRIGGER quizzes_set_updated_at
BEFORE UPDATE ON public.quizzes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    question_number SMALLINT NOT NULL,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL,
    marks SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT quiz_questions_number_positive CHECK (question_number > 0),
    CONSTRAINT quiz_questions_text_not_blank CHECK (length(btrim(question_text)) > 0),
    CONSTRAINT quiz_questions_options_object CHECK (
        pg_catalog.jsonb_typeof(options) = 'object'
        AND public.smartnekam_jsonb_object_key_count(options) >= 2
    ),
    CONSTRAINT quiz_questions_marks_positive CHECK (marks BETWEEN 1 AND 100),
    CONSTRAINT quiz_questions_quiz_number_unique UNIQUE (quiz_id, question_number)
);
CREATE INDEX IF NOT EXISTS quiz_questions_quiz_order_idx
    ON public.quiz_questions (quiz_id, question_number);

CREATE TABLE IF NOT EXISTS public.quiz_answer_keys (
    question_id UUID PRIMARY KEY REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
    correct_option TEXT NOT NULL,
    explanation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT quiz_answer_key_not_blank CHECK (length(btrim(correct_option)) > 0)
);

-- -----------------------------------------------------------------------------
-- 3. Daily challenge schedule, attempts, submitted answers, XP ledger, activity days
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_challenges (
    challenge_date DATE PRIMARY KEY,
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE RESTRICT,
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS daily_challenges_quiz_idx
    ON public.daily_challenges (quiz_id);

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES public.profiles(id) ON DELETE CASCADE,
    challenge_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deadline_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    score INTEGER NOT NULL DEFAULT 0,
    total_marks INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    total_questions INTEGER NOT NULL DEFAULT 0,
    xp_awarded INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT quiz_attempts_status_check CHECK (status IN ('in_progress', 'submitted', 'expired')),
    CONSTRAINT quiz_attempts_score_nonnegative CHECK (score >= 0),
    CONSTRAINT quiz_attempts_total_marks_nonnegative CHECK (total_marks >= 0),
    CONSTRAINT quiz_attempts_correct_count_nonnegative CHECK (correct_count >= 0),
    CONSTRAINT quiz_attempts_total_questions_nonnegative CHECK (total_questions >= 0),
    CONSTRAINT quiz_attempts_xp_nonnegative CHECK (xp_awarded >= 0),
    CONSTRAINT quiz_attempts_score_not_over_total CHECK (score <= total_marks)
);
-- A user gets no more than one Daily Challenge attempt per Tanzania calendar date.
CREATE UNIQUE INDEX IF NOT EXISTS quiz_attempts_one_daily_per_user_idx
    ON public.quiz_attempts (user_id, challenge_date)
    WHERE challenge_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS quiz_attempts_user_history_idx
    ON public.quiz_attempts (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS quiz_attempts_quiz_history_idx
    ON public.quiz_attempts (quiz_id, status, started_at DESC);

CREATE TABLE IF NOT EXISTS public.quiz_attempt_answers (
    attempt_id UUID NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE RESTRICT,
    selected_option TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (attempt_id, question_id)
);
CREATE INDEX IF NOT EXISTS quiz_attempt_answers_question_idx
    ON public.quiz_attempt_answers (question_id);

CREATE TABLE IF NOT EXISTS public.xp_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    source_type VARCHAR(30) NOT NULL,
    source_id UUID NOT NULL,
    amount INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT xp_ledger_source_type_check CHECK (
        source_type IN ('daily_challenge', 'quiz', 'best_answer', 'note_upload', 'group_help', 'referral', 'admin_adjustment')
    ),
    CONSTRAINT xp_ledger_amount_positive CHECK (amount > 0),
    CONSTRAINT xp_ledger_source_unique UNIQUE (user_id, source_type, source_id)
);
CREATE INDEX IF NOT EXISTS xp_ledger_user_history_idx
    ON public.xp_ledger (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_learning_days (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    activity_type VARCHAR(30) NOT NULL,
    source_id UUID,
    xp_earned INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, activity_date),
    CONSTRAINT user_learning_days_xp_nonnegative CHECK (xp_earned >= 0)
);
CREATE INDEX IF NOT EXISTS user_learning_days_calendar_idx
    ON public.user_learning_days (user_id, activity_date DESC);

-- -----------------------------------------------------------------------------
-- 4. Publish a quiz only when it has valid questions and answer keys
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publish_quiz(p_quiz_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := auth.uid();
    v_creator UUID;
    v_type TEXT;
    v_duration INTEGER;
    v_status TEXT;
    v_question_count INTEGER;
    v_key_count INTEGER;
    v_invalid_key_count INTEGER;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'You must be signed in to publish a quiz.';
    END IF;

    SELECT q.created_by, q.quiz_type, q.duration_minutes, q.status
    INTO v_creator, v_type, v_duration, v_status
    FROM public.quizzes q
    WHERE q.id = p_quiz_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quiz not found.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = v_uid AND p.status = 'active'
    ) THEN
        RAISE EXCEPTION 'Your SmartNekam profile is not active.';
    END IF;

    IF v_creator <> v_uid AND NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = v_uid AND p.role IN ('moderator', 'super_admin') AND p.status = 'active'
    ) THEN
        RAISE EXCEPTION 'You are not allowed to publish this quiz.';
    END IF;

    IF v_status = 'published' THEN
        RETURN;
    END IF;
    IF v_status <> 'draft' THEN
        RAISE EXCEPTION 'Only draft quizzes can be published.';
    END IF;

    SELECT
        count(*)::INTEGER,
        count(ak.question_id)::INTEGER,
        (count(*) FILTER (
            WHERE ak.question_id IS NOT NULL
              AND NOT (qq.options ? ak.correct_option)
        ))::INTEGER
    INTO v_question_count, v_key_count, v_invalid_key_count
    FROM public.quiz_questions qq
    LEFT JOIN public.quiz_answer_keys ak ON ak.question_id = qq.id
    WHERE qq.quiz_id = p_quiz_id;

    IF v_question_count = 0 THEN
        RAISE EXCEPTION 'Add at least one question before publishing.';
    END IF;
    IF v_key_count <> v_question_count THEN
        RAISE EXCEPTION 'Every question must have a correct answer key before publishing.';
    END IF;
    IF v_invalid_key_count > 0 THEN
        RAISE EXCEPTION 'Each correct_option must match one of that question''s options keys.';
    END IF;
    IF v_type = 'daily' AND v_question_count <> 5 THEN
        RAISE EXCEPTION 'Daily Challenge quizzes must contain exactly 5 questions.';
    END IF;
    IF v_type = 'daily' AND v_duration > 5 THEN
        RAISE EXCEPTION 'Daily Challenge duration cannot exceed 5 minutes.';
    END IF;

    UPDATE public.quizzes
    SET status = 'published', published_at = pg_catalog.now()
    WHERE id = p_quiz_id;
END;
$function$;

-- -----------------------------------------------------------------------------
-- 5. Assign a published five-question Daily Challenge to a date
-- Only active moderators and super admins may schedule challenges.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_daily_challenge(
    p_quiz_id UUID,
    p_challenge_date DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := auth.uid();
    v_today DATE := (pg_catalog.now() AT TIME ZONE 'Africa/Dar_es_Salaam')::DATE;
    v_type TEXT;
    v_status TEXT;
    v_question_count INTEGER;
BEGIN
    IF v_uid IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = v_uid AND p.role IN ('moderator', 'super_admin') AND p.status = 'active'
    ) THEN
        RAISE EXCEPTION 'Only active moderators or super admins can schedule Daily Challenges.';
    END IF;
    IF p_challenge_date IS NULL OR p_challenge_date < v_today THEN
        RAISE EXCEPTION 'Challenge date must be today or a future date in Africa/Dar_es_Salaam.';
    END IF;

    SELECT q.quiz_type, q.status
    INTO v_type, v_status
    FROM public.quizzes q
    WHERE q.id = p_quiz_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quiz not found.';
    END IF;
    IF v_type <> 'daily' OR v_status <> 'published' THEN
        RAISE EXCEPTION 'Only published Daily Challenge quizzes can be scheduled.';
    END IF;

    SELECT count(*)::INTEGER INTO v_question_count
    FROM public.quiz_questions qq WHERE qq.quiz_id = p_quiz_id;
    IF v_question_count <> 5 THEN
        RAISE EXCEPTION 'The scheduled Daily Challenge must contain exactly 5 questions.';
    END IF;

    INSERT INTO public.daily_challenges (challenge_date, quiz_id, assigned_by)
    VALUES (p_challenge_date, p_quiz_id, v_uid)
    ON CONFLICT (challenge_date) DO UPDATE
        SET quiz_id = EXCLUDED.quiz_id,
            assigned_by = EXCLUDED.assigned_by;
END;
$function$;

-- -----------------------------------------------------------------------------
-- 6. Start a quiz attempt or today's Daily Challenge
-- Call start_quiz_attempt(NULL) to start today's scheduled Daily Challenge.
-- For published subject/mock quizzes, pass their quiz UUID.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_quiz_attempt(p_quiz_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := auth.uid();
    v_today DATE := (pg_catalog.now() AT TIME ZONE 'Africa/Dar_es_Salaam')::DATE;
    v_quiz_id UUID := p_quiz_id;
    v_challenge_date DATE := NULL;
    v_quiz RECORD;
    v_attempt RECORD;
    v_attempt_id UUID;
    v_questions JSONB;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'You must be signed in to start a quiz.';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = v_uid AND p.status = 'active'
    ) THEN
        RAISE EXCEPTION 'Your SmartNekam profile is not active.';
    END IF;

    IF v_quiz_id IS NULL THEN
        SELECT dc.quiz_id INTO v_quiz_id
        FROM public.daily_challenges dc
        WHERE dc.challenge_date = v_today;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'No Daily Challenge has been scheduled for today yet.';
        END IF;
        v_challenge_date := v_today;
    END IF;

    SELECT q.* INTO v_quiz
    FROM public.quizzes q
    WHERE q.id = v_quiz_id AND q.status = 'published';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Published quiz not found.';
    END IF;

    IF v_quiz.quiz_type = 'daily' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.daily_challenges dc
            WHERE dc.challenge_date = v_today AND dc.quiz_id = v_quiz_id
        ) THEN
            RAISE EXCEPTION 'A Daily Challenge can only be started from today''s schedule.';
        END IF;
        v_challenge_date := v_today;
    ELSIF p_quiz_id IS NULL THEN
        RAISE EXCEPTION 'No Daily Challenge is assigned for today.';
    END IF;

    IF v_challenge_date IS NOT NULL THEN
        INSERT INTO public.quiz_attempts (
            quiz_id, user_id, challenge_date, status, deadline_at
        ) VALUES (
            v_quiz_id, v_uid, v_challenge_date, 'in_progress',
            pg_catalog.now() + pg_catalog.make_interval(mins => v_quiz.duration_minutes)
        )
        ON CONFLICT (user_id, challenge_date) WHERE challenge_date IS NOT NULL DO NOTHING
        RETURNING id INTO v_attempt_id;

        IF v_attempt_id IS NULL THEN
            SELECT qa.id INTO v_attempt_id
            FROM public.quiz_attempts qa
            WHERE qa.user_id = v_uid AND qa.challenge_date = v_challenge_date;
        END IF;
    ELSE
        INSERT INTO public.quiz_attempts (
            quiz_id, user_id, challenge_date, status, deadline_at
        ) VALUES (
            v_quiz_id, v_uid, NULL, 'in_progress',
            pg_catalog.now() + pg_catalog.make_interval(mins => v_quiz.duration_minutes)
        )
        RETURNING id INTO v_attempt_id;
    END IF;

    SELECT qa.* INTO v_attempt
    FROM public.quiz_attempts qa
    WHERE qa.id = v_attempt_id;

    -- If today's schedule was changed after an attempt already existed, keep using
    -- the quiz originally attached to that attempt rather than the newly scheduled quiz.
    v_quiz_id := v_attempt.quiz_id;
    SELECT q.* INTO v_quiz
    FROM public.quizzes q
    WHERE q.id = v_quiz_id;

    IF v_attempt.status = 'in_progress' AND pg_catalog.now() > v_attempt.deadline_at THEN
        UPDATE public.quiz_attempts
        SET status = 'expired', completed_at = pg_catalog.now()
        WHERE id = v_attempt_id;
        SELECT qa.* INTO v_attempt FROM public.quiz_attempts qa WHERE qa.id = v_attempt_id;
    END IF;

    IF v_attempt.status = 'in_progress' THEN
        SELECT COALESCE(
            pg_catalog.jsonb_agg(
                pg_catalog.jsonb_build_object(
                    'id', qq.id,
                    'question_number', qq.question_number,
                    'question_text', qq.question_text,
                    'options', qq.options,
                    'marks', qq.marks
                ) ORDER BY qq.question_number
            ),
            '[]'::JSONB
        )
        INTO v_questions
        FROM public.quiz_questions qq
        WHERE qq.quiz_id = v_quiz_id;
    ELSE
        v_questions := '[]'::JSONB;
    END IF;

    RETURN pg_catalog.jsonb_build_object(
        'attempt_id', v_attempt.id,
        'quiz_id', v_quiz.id,
        'quiz_title', v_quiz.title,
        'quiz_type', v_quiz.quiz_type,
        'status', v_attempt.status,
        'started_at', v_attempt.started_at,
        'deadline_at', v_attempt.deadline_at,
        'challenge_date', v_attempt.challenge_date,
        'questions', v_questions
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.start_daily_challenge()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    RETURN public.start_quiz_attempt(NULL);
END;
$function$;

-- -----------------------------------------------------------------------------
-- 7. Submit answers, score server-side, award XP once, and update the streak
-- p_answers format: [{"question_id":"UUID", "selected_option":"A"}, ...]
-- Unanswered questions may be omitted. Correct answers are never accepted from client input.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_quiz_attempt(
    p_attempt_id UUID,
    p_answers JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := auth.uid();
    v_attempt RECORD;
    v_answer JSONB;
    v_question_id UUID;
    v_selected_option TEXT;
    v_options JSONB;
    v_correct_option TEXT;
    v_is_correct BOOLEAN;
    v_marks INTEGER;
    v_seen_ids UUID[] := ARRAY[]::UUID[];
    v_total_questions INTEGER;
    v_total_marks INTEGER;
    v_score INTEGER;
    v_correct_count INTEGER;
    v_xp_candidate INTEGER := 0;
    v_xp_awarded INTEGER := 0;
    v_source_type TEXT;
    v_source_id UUID;
    v_ledger_id UUID;
    v_activity_date DATE;
    v_new_activity_date DATE;
    v_profile_streak INTEGER;
    v_longest_streak INTEGER;
    v_last_activity_date DATE;
    v_new_streak INTEGER;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'You must be signed in to submit a quiz.';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = v_uid AND p.status = 'active'
    ) THEN
        RAISE EXCEPTION 'Your SmartNekam profile is not active.';
    END IF;
    IF p_answers IS NULL OR pg_catalog.jsonb_typeof(p_answers) <> 'array' THEN
        RAISE EXCEPTION 'Answers must be supplied as a JSON array.';
    END IF;

    SELECT qa.* INTO v_attempt
    FROM public.quiz_attempts qa
    WHERE qa.id = p_attempt_id AND qa.user_id = v_uid
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quiz attempt not found for the current user.';
    END IF;
    IF v_attempt.status = 'submitted' THEN
        RETURN pg_catalog.jsonb_build_object(
            'attempt_id', v_attempt.id,
            'status', v_attempt.status,
            'score', v_attempt.score,
            'total_marks', v_attempt.total_marks,
            'correct_count', v_attempt.correct_count,
            'total_questions', v_attempt.total_questions,
            'xp_awarded', v_attempt.xp_awarded
        );
    END IF;
    IF v_attempt.status = 'expired' THEN
        RETURN pg_catalog.jsonb_build_object('attempt_id', v_attempt.id, 'status', 'expired', 'xp_awarded', 0);
    END IF;
    IF pg_catalog.now() > v_attempt.deadline_at THEN
        UPDATE public.quiz_attempts
        SET status = 'expired', completed_at = pg_catalog.now()
        WHERE id = p_attempt_id;
        RETURN pg_catalog.jsonb_build_object('attempt_id', p_attempt_id, 'status', 'expired', 'xp_awarded', 0);
    END IF;

    SELECT count(*)::INTEGER, COALESCE(sum(qq.marks), 0)::INTEGER
    INTO v_total_questions, v_total_marks
    FROM public.quiz_questions qq
    WHERE qq.quiz_id = v_attempt.quiz_id;

    IF pg_catalog.jsonb_array_length(p_answers) > v_total_questions THEN
        RAISE EXCEPTION 'The answer list contains more entries than the quiz has questions.';
    END IF;

    -- Insert only submitted choices; every choice is validated and scored server-side.
    FOR v_answer IN SELECT value FROM pg_catalog.jsonb_array_elements(p_answers) AS x(value)
    LOOP
        IF pg_catalog.jsonb_typeof(v_answer) <> 'object' THEN
            RAISE EXCEPTION 'Each answer must be a JSON object.';
        END IF;
        IF COALESCE(v_answer ->> 'question_id', '') = '' THEN
            RAISE EXCEPTION 'Every answer must include question_id.';
        END IF;
        BEGIN
            v_question_id := (v_answer ->> 'question_id')::UUID;
        EXCEPTION WHEN invalid_text_representation THEN
            RAISE EXCEPTION 'One answer contains an invalid question_id.';
        END;
        IF v_question_id = ANY(v_seen_ids) THEN
            RAISE EXCEPTION 'Duplicate answers for the same question are not allowed.';
        END IF;
        v_seen_ids := pg_catalog.array_append(v_seen_ids, v_question_id);

        v_selected_option := NULLIF(pg_catalog.btrim(v_answer ->> 'selected_option'), '');

        SELECT qq.options, ak.correct_option, qq.marks
        INTO v_options, v_correct_option, v_marks
        FROM public.quiz_questions qq
        JOIN public.quiz_answer_keys ak ON ak.question_id = qq.id
        WHERE qq.id = v_question_id AND qq.quiz_id = v_attempt.quiz_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'An answer references a question that does not belong to this quiz or has no answer key.';
        END IF;
        IF v_selected_option IS NULL THEN
            CONTINUE;
        END IF;
        IF NOT (v_options ? v_selected_option) THEN
            RAISE EXCEPTION 'A selected_option does not match one of the question''s options.';
        END IF;

        v_is_correct := (v_selected_option = v_correct_option);
        INSERT INTO public.quiz_attempt_answers (attempt_id, question_id, selected_option, is_correct)
        VALUES (p_attempt_id, v_question_id, v_selected_option, v_is_correct);
    END LOOP;

    SELECT COALESCE(sum(qq.marks) FILTER (WHERE qaa.is_correct), 0)::INTEGER,
           (count(*) FILTER (WHERE qaa.is_correct))::INTEGER
    INTO v_score, v_correct_count
    FROM public.quiz_questions qq
    JOIN public.quiz_attempt_answers qaa
      ON qaa.question_id = qq.id AND qaa.attempt_id = p_attempt_id
    WHERE qq.quiz_id = v_attempt.quiz_id;

    v_score := COALESCE(v_score, 0);
    v_correct_count := COALESCE(v_correct_count, 0);

    IF v_attempt.challenge_date IS NOT NULL THEN
        v_xp_candidate := 5 + (2 * v_correct_count);
        v_source_type := 'daily_challenge';
        v_source_id := v_attempt.id;
    ELSE
        v_xp_candidate := 2 * v_correct_count;
        v_source_type := 'quiz';
        v_source_id := v_attempt.quiz_id;
    END IF;

    UPDATE public.quiz_attempts
    SET status = 'submitted',
        completed_at = pg_catalog.now(),
        score = v_score,
        total_marks = v_total_marks,
        correct_count = v_correct_count,
        total_questions = v_total_questions,
        xp_awarded = 0
    WHERE id = p_attempt_id;

    -- Uniqueness prevents duplicate rewards. Non-daily quizzes reward a user once per quiz;
    -- Daily Challenge reward source is the attempt ID, allowing one reward each calendar day.
    IF v_xp_candidate > 0 THEN
        INSERT INTO public.xp_ledger (user_id, source_type, source_id, amount, description)
        VALUES (
            v_uid,
            v_source_type,
            v_source_id,
            v_xp_candidate,
            CASE WHEN v_source_type = 'daily_challenge'
                 THEN 'Daily Challenge completion'
                 ELSE 'First rewarded completion of quiz'
            END
        )
        ON CONFLICT (user_id, source_type, source_id) DO NOTHING
        RETURNING id INTO v_ledger_id;

        IF v_ledger_id IS NOT NULL THEN
            v_xp_awarded := v_xp_candidate;
            UPDATE public.profiles
            SET xp = xp + v_xp_awarded
            WHERE id = v_uid;
        END IF;
    END IF;

    UPDATE public.quiz_attempts
    SET xp_awarded = v_xp_awarded
    WHERE id = p_attempt_id;

    -- Only the Daily Challenge updates the streak in this migration.
    -- Other qualifying activities can be connected to the same activity-day table by later SQL modules.
    IF v_attempt.challenge_date IS NOT NULL THEN
        v_activity_date := v_attempt.challenge_date;
        INSERT INTO public.user_learning_days (user_id, activity_date, activity_type, source_id, xp_earned)
        VALUES (v_uid, v_activity_date, 'daily_challenge', p_attempt_id, v_xp_awarded)
        ON CONFLICT (user_id, activity_date) DO NOTHING
        RETURNING activity_date INTO v_new_activity_date;

        IF v_new_activity_date IS NOT NULL THEN
            SELECT p.streak, p.longest_streak, p.last_activity_date
            INTO v_profile_streak, v_longest_streak, v_last_activity_date
            FROM public.profiles p
            WHERE p.id = v_uid
            FOR UPDATE;

            IF v_last_activity_date IS NULL THEN
                v_new_streak := 1;
            ELSIF v_last_activity_date = v_activity_date THEN
                v_new_streak := v_profile_streak;
            ELSIF v_last_activity_date = (v_activity_date - 1) THEN
                v_new_streak := v_profile_streak + 1;
            ELSIF v_last_activity_date < (v_activity_date - 1) THEN
                v_new_streak := 1;
            ELSE
                -- Do not roll a streak backwards if an older activity is recorded later.
                v_new_streak := v_profile_streak;
            END IF;

            IF v_last_activity_date IS NULL OR v_activity_date > v_last_activity_date THEN
                UPDATE public.profiles
                SET streak = v_new_streak,
                    longest_streak = GREATEST(v_longest_streak, v_new_streak),
                    last_activity_date = v_activity_date
                WHERE id = v_uid;
            END IF;
        ELSE
            -- The day may already have been recorded by another qualifying module.
            UPDATE public.user_learning_days
            SET xp_earned = xp_earned + v_xp_awarded
            WHERE user_id = v_uid AND activity_date = v_activity_date;
        END IF;
    END IF;

    SELECT qa.* INTO v_attempt
    FROM public.quiz_attempts qa WHERE qa.id = p_attempt_id;

    RETURN pg_catalog.jsonb_build_object(
        'attempt_id', v_attempt.id,
        'status', v_attempt.status,
        'score', v_attempt.score,
        'total_marks', v_attempt.total_marks,
        'correct_count', v_attempt.correct_count,
        'total_questions', v_attempt.total_questions,
        'xp_awarded', v_attempt.xp_awarded,
        'streak', (SELECT p.streak FROM public.profiles p WHERE p.id = v_uid)
    );
END;
$function$;

-- Retrieve correct answers and explanations only after an owned attempt is submitted.
CREATE OR REPLACE FUNCTION public.get_quiz_attempt_result(p_attempt_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := auth.uid();
    v_attempt RECORD;
    v_answers JSONB := '[]'::JSONB;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'You must be signed in to view a quiz result.';
    END IF;

    SELECT qa.* INTO v_attempt
    FROM public.quiz_attempts qa
    WHERE qa.id = p_attempt_id AND qa.user_id = v_uid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quiz attempt not found for the current user.';
    END IF;
    IF v_attempt.status = 'in_progress' THEN
        RAISE EXCEPTION 'Results are available only after the attempt is submitted or expires.';
    END IF;

    IF v_attempt.status = 'submitted' THEN
        SELECT COALESCE(
            pg_catalog.jsonb_agg(
                pg_catalog.jsonb_build_object(
                    'question_id', qq.id,
                    'question_number', qq.question_number,
                    'question_text', qq.question_text,
                    'options', qq.options,
                    'selected_option', qaa.selected_option,
                    'correct_option', ak.correct_option,
                    'is_correct', qaa.is_correct,
                    'explanation', ak.explanation,
                    'marks', qq.marks
                ) ORDER BY qq.question_number
            ),
            '[]'::JSONB
        )
        INTO v_answers
        FROM public.quiz_questions qq
        JOIN public.quiz_answer_keys ak ON ak.question_id = qq.id
        LEFT JOIN public.quiz_attempt_answers qaa
          ON qaa.question_id = qq.id AND qaa.attempt_id = p_attempt_id
        WHERE qq.quiz_id = v_attempt.quiz_id;
    END IF;

    RETURN pg_catalog.jsonb_build_object(
        'attempt_id', v_attempt.id,
        'quiz_id', v_attempt.quiz_id,
        'status', v_attempt.status,
        'score', v_attempt.score,
        'total_marks', v_attempt.total_marks,
        'correct_count', v_attempt.correct_count,
        'total_questions', v_attempt.total_questions,
        'xp_awarded', v_attempt.xp_awarded,
        'answers', v_answers
    );
END;
$function$;

-- -----------------------------------------------------------------------------
-- 8. Row Level Security
-- Helper avoids requiring anonymous visitors to have SELECT permission on profiles
-- just to browse published quiz content. It only reports whether the current caller
-- is an active moderator/super admin; it accepts no arbitrary user ID.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_smartnekam_quiz_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.role IN ('moderator', 'super_admin')
          AND p.status = 'active'
    );
$function$;
REVOKE ALL PRIVILEGES ON FUNCTION public.is_smartnekam_quiz_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_smartnekam_quiz_admin() TO anon, authenticated;

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answer_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_learning_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quizzes_select_published_or_owned ON public.quizzes;
CREATE POLICY quizzes_select_published_or_owned
ON public.quizzes FOR SELECT TO anon, authenticated
USING (
    status = 'published'
    OR created_by = (SELECT auth.uid())
    OR public.is_smartnekam_quiz_admin()
);

DROP POLICY IF EXISTS quizzes_insert_own_draft ON public.quizzes;
CREATE POLICY quizzes_insert_own_draft
ON public.quizzes FOR INSERT TO authenticated
WITH CHECK (
    created_by = (SELECT auth.uid())
    AND status = 'draft'
    AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid()) AND p.status = 'active'
    )
);

DROP POLICY IF EXISTS quizzes_update_own_draft ON public.quizzes;
CREATE POLICY quizzes_update_own_draft
ON public.quizzes FOR UPDATE TO authenticated
USING (
    status = 'draft' AND (
        created_by = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = (SELECT auth.uid()) AND p.role IN ('moderator', 'super_admin')
        )
    )
)
WITH CHECK (
    status = 'draft' AND (
        created_by = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = (SELECT auth.uid()) AND p.role IN ('moderator', 'super_admin')
        )
    )
);

DROP POLICY IF EXISTS quizzes_delete_own_draft ON public.quizzes;
CREATE POLICY quizzes_delete_own_draft
ON public.quizzes FOR DELETE TO authenticated
USING (
    status = 'draft' AND (
        created_by = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = (SELECT auth.uid()) AND p.role IN ('moderator', 'super_admin')
        )
    )
);

DROP POLICY IF EXISTS quiz_questions_select_published_or_owned ON public.quiz_questions;
CREATE POLICY quiz_questions_select_published_or_owned
ON public.quiz_questions FOR SELECT TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.quizzes q
        WHERE q.id = quiz_id AND (
            q.status = 'published'
            OR q.created_by = (SELECT auth.uid())
            OR public.is_smartnekam_quiz_admin()
        )
    )
);

DROP POLICY IF EXISTS quiz_questions_insert_draft_owner ON public.quiz_questions;
CREATE POLICY quiz_questions_insert_draft_owner
ON public.quiz_questions FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.quizzes q
        WHERE q.id = quiz_id AND q.status = 'draft' AND (
            q.created_by = (SELECT auth.uid())
            OR EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = (SELECT auth.uid()) AND p.role IN ('moderator', 'super_admin')
            )
        )
    )
);

DROP POLICY IF EXISTS quiz_questions_update_draft_owner ON public.quiz_questions;
CREATE POLICY quiz_questions_update_draft_owner
ON public.quiz_questions FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.quizzes q
        WHERE q.id = quiz_id AND q.status = 'draft' AND (
            q.created_by = (SELECT auth.uid())
            OR EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = (SELECT auth.uid()) AND p.role IN ('moderator', 'super_admin')
            )
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.quizzes q
        WHERE q.id = quiz_id AND q.status = 'draft' AND (
            q.created_by = (SELECT auth.uid())
            OR EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = (SELECT auth.uid()) AND p.role IN ('moderator', 'super_admin')
            )
        )
    )
);

DROP POLICY IF EXISTS quiz_questions_delete_draft_owner ON public.quiz_questions;
CREATE POLICY quiz_questions_delete_draft_owner
ON public.quiz_questions FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.quizzes q
        WHERE q.id = quiz_id AND q.status = 'draft' AND (
            q.created_by = (SELECT auth.uid())
            OR EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = (SELECT auth.uid()) AND p.role IN ('moderator', 'super_admin')
            )
        )
    )
);

DROP POLICY IF EXISTS quiz_answer_keys_select_owner_or_admin ON public.quiz_answer_keys;
CREATE POLICY quiz_answer_keys_select_owner_or_admin
ON public.quiz_answer_keys FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.quiz_questions qq
        JOIN public.quizzes q ON q.id = qq.quiz_id
        WHERE qq.id = question_id AND (
            q.created_by = (SELECT auth.uid())
            OR EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = (SELECT auth.uid()) AND p.role IN ('moderator', 'super_admin')
            )
        )
    )
);

DROP POLICY IF EXISTS quiz_answer_keys_insert_draft_owner ON public.quiz_answer_keys;
CREATE POLICY quiz_answer_keys_insert_draft_owner
ON public.quiz_answer_keys FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.quiz_questions qq
        JOIN public.quizzes q ON q.id = qq.quiz_id
        WHERE qq.id = question_id AND q.status = 'draft' AND (
            q.created_by = (SELECT auth.uid())
            OR EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = (SELECT auth.uid()) AND p.role IN ('moderator', 'super_admin')
            )
        )
    )
);

DROP POLICY IF EXISTS quiz_answer_keys_update_draft_owner ON public.quiz_answer_keys;
CREATE POLICY quiz_answer_keys_update_draft_owner
ON public.quiz_answer_keys FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.quiz_questions qq
        JOIN public.quizzes q ON q.id = qq.quiz_id
        WHERE qq.id = question_id AND q.status = 'draft' AND (
            q.created_by = (SELECT auth.uid())
            OR EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = (SELECT auth.uid()) AND p.role IN ('moderator', 'super_admin')
            )
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.quiz_questions qq
        JOIN public.quizzes q ON q.id = qq.quiz_id
        WHERE qq.id = question_id AND q.status = 'draft' AND (
            q.created_by = (SELECT auth.uid())
            OR EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = (SELECT auth.uid()) AND p.role IN ('moderator', 'super_admin')
            )
        )
    )
);

DROP POLICY IF EXISTS quiz_answer_keys_delete_draft_owner ON public.quiz_answer_keys;
CREATE POLICY quiz_answer_keys_delete_draft_owner
ON public.quiz_answer_keys FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.quiz_questions qq
        JOIN public.quizzes q ON q.id = qq.quiz_id
        WHERE qq.id = question_id AND q.status = 'draft' AND (
            q.created_by = (SELECT auth.uid())
            OR EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = (SELECT auth.uid()) AND p.role IN ('moderator', 'super_admin')
            )
        )
    )
);

DROP POLICY IF EXISTS daily_challenges_select_today_or_admin ON public.daily_challenges;
CREATE POLICY daily_challenges_select_today_or_admin
ON public.daily_challenges FOR SELECT TO authenticated
USING (
    challenge_date = ((pg_catalog.now() AT TIME ZONE 'Africa/Dar_es_Salaam')::DATE)
    OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid()) AND p.role IN ('moderator', 'super_admin')
    )
);

DROP POLICY IF EXISTS quiz_attempts_select_own_or_admin ON public.quiz_attempts;
CREATE POLICY quiz_attempts_select_own_or_admin
ON public.quiz_attempts FOR SELECT TO authenticated
USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid()) AND p.role IN ('moderator', 'super_admin')
    )
);

DROP POLICY IF EXISTS quiz_attempt_answers_select_submitted_own ON public.quiz_attempt_answers;
CREATE POLICY quiz_attempt_answers_select_submitted_own
ON public.quiz_attempt_answers FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.quiz_attempts qa
        WHERE qa.id = attempt_id
          AND qa.user_id = (SELECT auth.uid())
          AND qa.status = 'submitted'
    )
);

DROP POLICY IF EXISTS xp_ledger_select_own ON public.xp_ledger;
CREATE POLICY xp_ledger_select_own
ON public.xp_ledger FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS user_learning_days_select_own ON public.user_learning_days;
CREATE POLICY user_learning_days_select_own
ON public.user_learning_days FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

-- -----------------------------------------------------------------------------
-- 9. Least-privilege grants: writes to attempts/answers/XP happen through RPCs
-- -----------------------------------------------------------------------------
REVOKE ALL PRIVILEGES ON TABLE public.quizzes FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.quiz_questions FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.quiz_answer_keys FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.daily_challenges FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.quiz_attempts FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.quiz_attempt_answers FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.xp_ledger FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.user_learning_days FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.quizzes TO anon, authenticated;
GRANT INSERT (title, description, subject_id, level, quiz_type, duration_minutes)
    ON TABLE public.quizzes TO authenticated;
GRANT UPDATE (title, description, subject_id, level, quiz_type, duration_minutes)
    ON TABLE public.quizzes TO authenticated;
GRANT DELETE ON TABLE public.quizzes TO authenticated;

GRANT SELECT ON TABLE public.quiz_questions TO anon, authenticated;
GRANT INSERT (quiz_id, question_number, question_text, options, marks)
    ON TABLE public.quiz_questions TO authenticated;
GRANT UPDATE (question_number, question_text, options, marks)
    ON TABLE public.quiz_questions TO authenticated;
GRANT DELETE ON TABLE public.quiz_questions TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quiz_answer_keys TO authenticated;
GRANT SELECT ON TABLE public.daily_challenges TO authenticated;
GRANT SELECT ON TABLE public.quiz_attempts TO authenticated;
GRANT SELECT ON TABLE public.quiz_attempt_answers TO authenticated;
GRANT SELECT ON TABLE public.xp_ledger TO authenticated;
GRANT SELECT ON TABLE public.user_learning_days TO authenticated;

REVOKE ALL PRIVILEGES ON FUNCTION public.is_smartnekam_quiz_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_smartnekam_quiz_admin() TO anon, authenticated;

REVOKE ALL PRIVILEGES ON FUNCTION public.publish_quiz(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.assign_daily_challenge(UUID, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.start_quiz_attempt(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.start_daily_challenge() FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.submit_quiz_attempt(UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.get_quiz_attempt_result(UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.publish_quiz(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_daily_challenge(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_quiz_attempt(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_daily_challenge() TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_quiz_attempt(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_quiz_attempt_result(UUID) TO authenticated;

COMMIT;

-- Expected result: Success. No rows returned.
-- Verification query:
-- SELECT to_regclass('public.quizzes'), to_regclass('public.quiz_questions'),
--        to_regclass('public.quiz_answer_keys'), to_regclass('public.daily_challenges'),
--        to_regclass('public.quiz_attempts'), to_regclass('public.quiz_attempt_answers'),
--        to_regclass('public.xp_ledger'), to_regclass('public.user_learning_days');

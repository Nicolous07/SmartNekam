-- SmartNekam SQL 039: Admin Daily Challenge Manager
-- Prerequisites: SQL 004 (quiz engine) and SQL 007 (notifications + audit log).
-- Creates a complete 5-question daily challenge, publishes/schedules it, and
-- sends in-app notifications to active users in a single transactional RPC.

CREATE OR REPLACE FUNCTION public.admin_create_daily_challenge(
    p_title TEXT,
    p_description TEXT DEFAULT NULL,
    p_level TEXT DEFAULT NULL,
    p_challenge_date DATE DEFAULT NULL,
    p_questions JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_actor UUID := auth.uid();
    v_today DATE := (pg_catalog.now() AT TIME ZONE 'Africa/Dar_es_Salaam')::DATE;
    v_quiz_id UUID;
    v_question_id UUID;
    v_question JSONB;
    v_options JSONB;
    v_text TEXT;
    v_correct TEXT;
    v_explanation TEXT;
    v_key TEXT;
    v_number INTEGER := 0;
    v_notifications INTEGER := 0;
BEGIN
    IF v_actor IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = v_actor AND p.role IN ('moderator', 'super_admin') AND p.status = 'active'
    ) THEN
        RAISE EXCEPTION 'Only active moderators or super admins can create Daily Challenges.';
    END IF;
    IF p_title IS NULL OR pg_catalog.length(pg_catalog.btrim(p_title)) = 0 THEN
        RAISE EXCEPTION 'Daily Challenge title is required.';
    END IF;
    IF pg_catalog.length(pg_catalog.btrim(p_title)) > 200 THEN
        RAISE EXCEPTION 'Daily Challenge title cannot exceed 200 characters.';
    END IF;
    IF p_level IS NOT NULL AND p_level NOT IN ('O_LEVEL', 'A_LEVEL', 'UNIVERSITY') THEN
        RAISE EXCEPTION 'Level must be O_LEVEL, A_LEVEL, UNIVERSITY, or NULL for all levels.';
    END IF;
    IF p_challenge_date IS NULL OR p_challenge_date < v_today THEN
        RAISE EXCEPTION 'Challenge date must be today or a future date in Africa/Dar_es_Salaam.';
    END IF;
    IF p_questions IS NULL OR pg_catalog.jsonb_typeof(p_questions) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Daily Challenge questions must be supplied as a JSON array.';
    END IF;
    IF pg_catalog.jsonb_array_length(p_questions) <> 5 THEN
        RAISE EXCEPTION 'Daily Challenge must contain exactly 5 questions.';
    END IF;
    -- Serialize attempts to schedule the same date so two concurrent admins cannot replace each other.
    PERFORM pg_catalog.pg_advisory_xact_lock(39039, (p_challenge_date - DATE '2000-01-01'));
    IF EXISTS (SELECT 1 FROM public.daily_challenges dc WHERE dc.challenge_date = p_challenge_date) THEN
        RAISE EXCEPTION 'A Daily Challenge is already scheduled for this date. Select another date.';
    END IF;

    INSERT INTO public.quizzes (title, description, level, quiz_type, duration_minutes)
    VALUES (pg_catalog.btrim(p_title), NULLIF(pg_catalog.btrim(COALESCE(p_description, '')), ''), p_level, 'daily', 5)
    RETURNING id INTO v_quiz_id;

    FOR v_question IN SELECT value FROM pg_catalog.jsonb_array_elements(p_questions) AS questions(value)
    LOOP
        v_number := v_number + 1;
        v_text := pg_catalog.btrim(COALESCE(v_question->>'question_text', ''));
        v_options := v_question->'options';
        v_correct := pg_catalog.upper(pg_catalog.btrim(COALESCE(v_question->>'correct_option', '')));
        v_explanation := NULLIF(pg_catalog.btrim(COALESCE(v_question->>'explanation', '')), '');

        IF v_text = '' THEN
            RAISE EXCEPTION 'Question % must have question text.', v_number;
        END IF;
        IF pg_catalog.jsonb_typeof(v_options) IS DISTINCT FROM 'object' THEN
            RAISE EXCEPTION 'Question % must include an options object.', v_number;
        END IF;
        FOREACH v_key IN ARRAY ARRAY['A','B','C','D'] LOOP
            IF pg_catalog.length(pg_catalog.btrim(COALESCE(v_options->>v_key, ''))) = 0 THEN
                RAISE EXCEPTION 'Question % must provide all four options A, B, C, and D.', v_number;
            END IF;
        END LOOP;
        IF v_correct NOT IN ('A','B','C','D') OR NOT (v_options ? v_correct) THEN
            RAISE EXCEPTION 'Question % must choose a correct option from A, B, C, or D.', v_number;
        END IF;

        INSERT INTO public.quiz_questions (quiz_id, question_number, question_text, options, marks)
        VALUES (v_quiz_id, v_number, v_text, v_options, 1)
        RETURNING id INTO v_question_id;

        INSERT INTO public.quiz_answer_keys (question_id, correct_option, explanation)
        VALUES (v_question_id, v_correct, v_explanation);
    END LOOP;

    -- Existing secured RPCs enforce publication validation and staff authorization.
    PERFORM public.publish_quiz(v_quiz_id);
    PERFORM public.assign_daily_challenge(v_quiz_id, p_challenge_date);

    -- Keep notifications inside the same transaction as the schedule. A configured
    -- public.notifications INSERT webhook can deliver device push as well.
    INSERT INTO public.notifications (user_id, title, body, notification_type, data)
    SELECT p.id,
           'Daily Challenge mpya',
           pg_catalog.format('Changamoto mpya "%s" imepangiwa tarehe %s. Fungua Learn kushiriki.', pg_catalog.btrim(p_title), p_challenge_date::TEXT),
           'announcement',
           pg_catalog.jsonb_build_object(
               'href', '/learn/daily-challenge',
               'kind', 'daily_challenge',
               'challenge_date', p_challenge_date::TEXT,
               'quiz_id', v_quiz_id
           )
    FROM public.profiles p
    WHERE p.status = 'active';
    GET DIAGNOSTICS v_notifications = ROW_COUNT;

    INSERT INTO public.admin_audit_log (actor_id, action_name, entity_type, entity_id, details)
    VALUES (
        v_actor, 'create_daily_challenge', 'quiz', v_quiz_id,
        pg_catalog.jsonb_build_object(
            'challenge_date', p_challenge_date,
            'title', pg_catalog.btrim(p_title),
            'level', p_level,
            'questions', 5,
            'notifications_sent', v_notifications
        )
    );

    RETURN pg_catalog.jsonb_build_object(
        'quiz_id', v_quiz_id,
        'challenge_date', p_challenge_date,
        'notifications_sent', v_notifications
    );
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.admin_create_daily_challenge(TEXT, TEXT, TEXT, DATE, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_daily_challenge(TEXT, TEXT, TEXT, DATE, JSONB) TO authenticated;

COMMENT ON FUNCTION public.admin_create_daily_challenge(TEXT, TEXT, TEXT, DATE, JSONB)
IS 'Creates a validated five-question Daily Challenge, publishes and schedules it, sends in-app notifications to active users, and writes an audit event.';

-- SmartNekam SQL 052: show answer review for expired Daily Challenge attempts
-- This migration was applied to the connected SmartNekam Supabase project.
-- It keeps answer keys private until the authenticated owner has submitted or expired.
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

    IF v_attempt.status IN ('submitted', 'expired') THEN
        SELECT COALESCE(
            pg_catalog.jsonb_agg(
                pg_catalog.jsonb_build_object(
                    'question_id', qq.id,
                    'question_number', qq.question_number,
                    'question_text', qq.question_text,
                    'options', qq.options,
                    'selected_option', qaa.selected_option,
                    'correct_option', ak.correct_option,
                    'is_correct', COALESCE(qaa.is_correct, FALSE),
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

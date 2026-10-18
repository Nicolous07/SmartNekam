-- SmartNekam SQL 043: Study Planner completion must not update system-managed profiles fields.
-- Fixes: "System-managed profile fields cannot be changed directly."
-- This RPC completes the user's own task and records the learning day, but deliberately
-- DOES NOT UPDATE public.profiles (streak, XP, last_activity_date, or other protected fields).
-- Prerequisites: SQL 001A/001B, 004 and 008.

BEGIN;

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
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    -- Only the authenticated owner can complete their own planned task.
    UPDATE public.study_plan_items
       SET status = 'completed',
           completed_at = pg_catalog.now(),
           updated_at = pg_catalog.now()
     WHERE id = p_item_id
       AND user_id = v_uid
       AND status <> 'completed'
     RETURNING id INTO v_item_id;

    IF NOT FOUND THEN
        SELECT i.status
          INTO v_existing_status
          FROM public.study_plan_items AS i
         WHERE i.id = p_item_id
           AND i.user_id = v_uid;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Study plan item not found.';
        END IF;

        RETURN pg_catalog.jsonb_build_object(
            'success', TRUE,
            'already_completed', (v_existing_status = 'completed'),
            'status', v_existing_status,
            'item_id', p_item_id
        );
    END IF;

    -- Record a qualifying study activity, preserving any other activity already logged today.
    INSERT INTO public.user_learning_days
        (user_id, activity_date, activity_type, source_id, xp_earned)
    VALUES
        (v_uid, v_activity_date, 'study_plan', v_item_id, 0)
    ON CONFLICT (user_id, activity_date) DO NOTHING;

    RETURN pg_catalog.jsonb_build_object(
        'success', TRUE,
        'already_completed', FALSE,
        'item_id', v_item_id,
        'status', 'completed',
        'activity_date', v_activity_date,
        'activity_recorded', TRUE
    );
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.complete_study_plan_item(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_study_plan_item(UUID) TO authenticated;

COMMIT;

-- Verification: result should contain one function row. The function body should not
-- contain an UPDATE public.profiles statement.
SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
       (pg_catalog.pg_get_functiondef(p.oid) NOT ILIKE '%UPDATE public.profiles%') AS avoids_direct_profile_update,
       p.prosecdef AS security_definer
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'complete_study_plan_item';

-- SmartNekam: fix Admin-assigned mentors not appearing in the Mentors directory
-- Run in Supabase Dashboard > SQL Editor.
-- This keeps the existing frontend unchanged.

BEGIN;

-- 1) Replace the role-assignment RPC with the same authorization/audit checks,
--    and ensure assigning role='mentor' also creates/activates a public mentor card.
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
    v_display_name TEXT;
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

    SELECT p.role, NULLIF(pg_catalog.btrim(p.full_name), '')
    INTO v_target_role, v_display_name
    FROM public.profiles AS p
    WHERE p.id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target profile not found.';
    END IF;

    UPDATE public.profiles
    SET role = p_new_role
    WHERE id = p_user_id;

    -- A role assignment from the Admin panel is an explicit approval to list this
    -- user as a mentor. Keep any existing mentor profile details where present.
    IF p_new_role = 'mentor' THEN
        INSERT INTO public.mentors (
            user_id, display_name, verified, status, reviewed_by, reviewed_at
        ) VALUES (
            p_user_id,
            COALESCE(v_display_name, 'SmartNekam Mentor'),
            TRUE,
            'active',
            v_actor,
            pg_catalog.now()
        )
        ON CONFLICT (user_id) DO UPDATE
        SET display_name = COALESCE(
                NULLIF(pg_catalog.btrim(public.mentors.display_name), ''),
                EXCLUDED.display_name
            ),
            verified = TRUE,
            status = 'active',
            reviewed_by = EXCLUDED.reviewed_by,
            reviewed_at = EXCLUDED.reviewed_at,
            updated_at = pg_catalog.now();
    END IF;

    INSERT INTO public.admin_audit_log (actor_id, action_name, entity_type, entity_id, details)
    VALUES (
        v_actor, 'change_profile_role', 'profile', p_user_id,
        pg_catalog.jsonb_build_object(
            'old_role', v_target_role,
            'new_role', p_new_role,
            'reason', p_reason,
            'mentor_card_synced', (p_new_role = 'mentor')
        )
    );
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.admin_set_profile_role(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_profile_role(UUID, TEXT, TEXT) TO authenticated;

-- 2) Repair users who already have role='mentor' but no row in public.mentors.
--    Existing mentor profiles are left untouched; only missing cards are inserted.
INSERT INTO public.mentors (user_id, display_name, verified, status, reviewed_at)
SELECT p.id,
       COALESCE(NULLIF(pg_catalog.btrim(p.full_name), ''), 'SmartNekam Mentor'),
       TRUE,
       'active',
       pg_catalog.now()
FROM public.profiles AS p
WHERE p.role = 'mentor'
  AND NOT EXISTS (
      SELECT 1 FROM public.mentors AS m WHERE m.user_id = p.id
  );

COMMIT;

-- Verification: this should show all active, verified mentor cards.
SELECT p.id AS user_id, p.full_name, p.role,
       m.id AS mentor_id, m.status, m.verified, m.subjects, m.created_at
FROM public.profiles AS p
JOIN public.mentors AS m ON m.user_id = p.id
WHERE p.role = 'mentor'
ORDER BY m.created_at DESC;

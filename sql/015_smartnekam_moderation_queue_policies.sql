-- SmartNekam | SQL 015: Staff-only content moderation queue access
-- Run after SQL 001A-014. Does not delete or modify existing user data.
-- This adds row-read access to pending notes/past papers for authenticated moderators only.

BEGIN;

DROP POLICY IF EXISTS notes_read_moderator_queue ON public.notes;
CREATE POLICY notes_read_moderator_queue
ON public.notes FOR SELECT TO authenticated
USING (
    public.is_smartnekam_moderator()
    AND status IN ('pending', 'rejected', 'removed')
);

DROP POLICY IF EXISTS past_papers_read_moderator_queue ON public.past_papers;
CREATE POLICY past_papers_read_moderator_queue
ON public.past_papers FOR SELECT TO authenticated
USING (
    public.is_smartnekam_moderator()
    AND status IN ('pending', 'rejected', 'removed')
);

-- Private invite links need a lookup by invite code without exposing private-group rows.
CREATE OR REPLACE FUNCTION public.join_smartnekam_study_group_by_code(p_invite_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_group_id UUID;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;
    IF p_invite_code IS NULL OR pg_catalog.length(pg_catalog.btrim(p_invite_code)) < 6 THEN
        RAISE EXCEPTION 'Invite code is invalid.';
    END IF;
    SELECT g.id INTO v_group_id
    FROM public.study_groups AS g
    WHERE pg_catalog.upper(g.invite_code) = pg_catalog.upper(pg_catalog.btrim(p_invite_code))
      AND g.status = 'active'
    LIMIT 1;
    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'Study group was not found or is not accepting members.';
    END IF;
    PERFORM public.join_study_group(v_group_id, p_invite_code);
    RETURN v_group_id;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.join_smartnekam_study_group_by_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_smartnekam_study_group_by_code(TEXT) TO authenticated;

COMMIT;

-- This migration is intentionally restrictive. It does not add a policy to payment_provider_events.

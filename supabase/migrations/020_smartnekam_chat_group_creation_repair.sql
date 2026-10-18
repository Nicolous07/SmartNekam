-- SmartNekam SQL 020: repair chat group creation for installations where SQL 017
-- was incomplete or the PostgREST function schema cache did not refresh.
-- Requires SQL 006 (chat tables) and SQL 017 (chat group/message support).
-- Safe to re-run; does not delete conversations or messages.

BEGIN;

CREATE TABLE IF NOT EXISTS public.chat_group_settings (
  conversation_id UUID PRIMARY KEY REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  description TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public','private')),
  invite_code TEXT NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (length(btrim(description)) <= 1000)
);

CREATE INDEX IF NOT EXISTS chat_group_settings_discover_idx
  ON public.chat_group_settings (visibility, created_at DESC);

ALTER TABLE public.chat_group_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_group_settings_read_public_or_member ON public.chat_group_settings;
CREATE POLICY chat_group_settings_read_public_or_member ON public.chat_group_settings
FOR SELECT TO authenticated USING (
  visibility = 'public'
  OR created_by = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.chat_participants cp
    WHERE cp.conversation_id = chat_group_settings.conversation_id
      AND cp.user_id = (SELECT auth.uid())
      AND cp.left_at IS NULL
  )
);
REVOKE ALL ON TABLE public.chat_group_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.chat_group_settings TO authenticated;

-- Recreate the group creator with explicit guards and qualified references.
DROP FUNCTION IF EXISTS public.create_smartnekam_chat_group(TEXT, TEXT, TEXT);
CREATE FUNCTION public.create_smartnekam_chat_group(
  p_title TEXT,
  p_description TEXT DEFAULT '',
  p_visibility TEXT DEFAULT 'private'
)
RETURNS TABLE(conversation_id UUID, invite_code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_conversation UUID;
  v_code TEXT;
  v_title TEXT := btrim(COALESCE(p_title, ''));
  v_description TEXT := btrim(COALESCE(p_description, ''));
  v_visibility TEXT := lower(btrim(COALESCE(p_visibility, '')));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_uid AND p.status = 'active'
  ) THEN
    RAISE EXCEPTION 'active_profile_required';
  END IF;
  IF pg_catalog.length(v_title) < 3 OR pg_catalog.length(v_title) > 100 THEN
    RAISE EXCEPTION 'group_title_invalid';
  END IF;
  IF pg_catalog.length(v_description) > 1000 THEN
    RAISE EXCEPTION 'group_description_too_long';
  END IF;
  IF v_visibility NOT IN ('public', 'private') THEN
    RAISE EXCEPTION 'group_visibility_invalid';
  END IF;

  INSERT INTO public.chat_conversations (conversation_type, title, created_by, status)
  VALUES ('group', v_title, v_uid, 'active')
  RETURNING id INTO v_conversation;

  INSERT INTO public.chat_group_settings (conversation_id, created_by, description, visibility)
  VALUES (v_conversation, v_uid, v_description, v_visibility)
  RETURNING chat_group_settings.invite_code INTO v_code;

  INSERT INTO public.chat_participants (conversation_id, user_id, participant_role, left_at)
  VALUES (v_conversation, v_uid, 'admin', NULL)
  ON CONFLICT ON CONSTRAINT chat_participants_unique
  DO UPDATE SET participant_role = 'admin', left_at = NULL;

  RETURN QUERY SELECT v_conversation, v_code;
END;
$function$;
REVOKE ALL ON FUNCTION public.create_smartnekam_chat_group(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_smartnekam_chat_group(TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.discover_smartnekam_chat_groups(p_query TEXT DEFAULT '')
RETURNS TABLE(
  conversation_id UUID,
  title TEXT,
  description TEXT,
  visibility TEXT,
  member_count BIGINT,
  created_by UUID,
  creator_name TEXT,
  created_at TIMESTAMPTZ,
  is_member BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT c.id, c.title::TEXT, s.description::TEXT, s.visibility::TEXT,
    (SELECT pg_catalog.count(*) FROM public.chat_participants cp
      WHERE cp.conversation_id = c.id AND cp.left_at IS NULL)::BIGINT,
    s.created_by, p.full_name::TEXT, s.created_at,
    EXISTS (SELECT 1 FROM public.chat_participants mine
      WHERE mine.conversation_id = c.id AND mine.user_id = (SELECT auth.uid()) AND mine.left_at IS NULL)
  FROM public.chat_group_settings s
  JOIN public.chat_conversations c ON c.id = s.conversation_id
    AND c.conversation_type = 'group' AND c.status = 'active'
  JOIN public.profiles p ON p.id = s.created_by
  WHERE s.visibility = 'public'
    AND (
      pg_catalog.btrim(COALESCE(p_query, '')) = ''
      OR c.title ILIKE '%' || pg_catalog.btrim(p_query) || '%'
      OR s.description ILIKE '%' || pg_catalog.btrim(p_query) || '%'
    )
  ORDER BY s.created_at DESC
  LIMIT 50;
$function$;
REVOKE ALL ON FUNCTION public.discover_smartnekam_chat_groups(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.discover_smartnekam_chat_groups(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_smartnekam_public_chat_group(p_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_uid UUID := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_group_settings s
    JOIN public.chat_conversations c ON c.id = s.conversation_id
    WHERE s.conversation_id = p_conversation_id AND s.visibility = 'public'
      AND c.conversation_type = 'group' AND c.status = 'active'
  ) THEN RAISE EXCEPTION 'public_group_not_found'; END IF;

  INSERT INTO public.chat_participants (conversation_id, user_id, participant_role, left_at)
  VALUES (p_conversation_id, v_uid, 'member', NULL)
  ON CONFLICT ON CONSTRAINT chat_participants_unique DO UPDATE SET left_at = NULL;
END;
$function$;
REVOKE ALL ON FUNCTION public.join_smartnekam_public_chat_group(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_smartnekam_public_chat_group(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_smartnekam_private_chat_group(p_invite_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_uid UUID := (SELECT auth.uid()); v_conversation UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT s.conversation_id INTO v_conversation
  FROM public.chat_group_settings s
  JOIN public.chat_conversations c ON c.id = s.conversation_id
  WHERE pg_catalog.upper(s.invite_code) = pg_catalog.upper(pg_catalog.btrim(COALESCE(p_invite_code, '')))
    AND s.visibility = 'private' AND c.conversation_type = 'group' AND c.status = 'active';
  IF v_conversation IS NULL THEN RAISE EXCEPTION 'invite_code_invalid'; END IF;

  INSERT INTO public.chat_participants (conversation_id, user_id, participant_role, left_at)
  VALUES (v_conversation, v_uid, 'member', NULL)
  ON CONFLICT ON CONSTRAINT chat_participants_unique DO UPDATE SET left_at = NULL;
  RETURN v_conversation;
END;
$function$;
REVOKE ALL ON FUNCTION public.join_smartnekam_private_chat_group(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_smartnekam_private_chat_group(TEXT) TO authenticated;

-- Supabase Data API (PostgREST) refreshes its RPC signature cache.
NOTIFY pgrst, 'reload schema';
COMMIT;

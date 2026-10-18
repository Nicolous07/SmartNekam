-- SmartNekam SQL 021
-- Fix ambiguous conversation_id in group creation, allow members to invite group users,
-- and add creator-follow support for Home Feed posts.
-- Requires migrations 006, 016, 018 and the existing chat group migrations 017/020.
-- Safe to re-run; existing posts, conversations and memberships are preserved.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Repair group creation. The RETURNS TABLE output column conversation_id is a
-- PL/pgSQL variable, so a bare ON CONFLICT (conversation_id, user_id) is ambiguous.
-- Target the explicit unique constraint instead.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_smartnekam_chat_group(
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
  v_title TEXT := pg_catalog.btrim(COALESCE(p_title, ''));
  v_description TEXT := pg_catalog.btrim(COALESCE(p_description, ''));
  v_visibility TEXT := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_visibility, '')));
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

-- -----------------------------------------------------------------------------
-- 2. Any active group participant can invite active SmartNekam users. The creator
-- is a group admin, but invitations are intentionally available to other members.
-- The member list arrives as UUIDs selected through the in-app user search.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_smartnekam_chat_group_members(
  p_conversation_id UUID,
  p_user_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_added INTEGER := 0;
  v_requested INTEGER := COALESCE(pg_catalog.cardinality(p_user_ids), 0);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF v_requested < 1 THEN
    RAISE EXCEPTION 'select_at_least_one_user';
  END IF;
  IF v_requested > 50 THEN
    RAISE EXCEPTION 'group_invite_limit_50';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.chat_conversations c
    JOIN public.chat_participants mine ON mine.conversation_id = c.id
    WHERE c.id = p_conversation_id
      AND c.conversation_type = 'group'
      AND c.status = 'active'
      AND mine.user_id = v_uid
      AND mine.left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'active_group_membership_required';
  END IF;

  INSERT INTO public.chat_participants AS existing_member
    (conversation_id, user_id, participant_role, left_at)
  SELECT p_conversation_id, p.id, 'member', NULL
  FROM public.profiles p
  WHERE p.id = ANY(COALESCE(p_user_ids, ARRAY[]::UUID[]))
    AND p.status = 'active'
    AND p.id <> v_uid
  ON CONFLICT ON CONSTRAINT chat_participants_unique
  DO UPDATE SET left_at = NULL
  WHERE existing_member.left_at IS NOT NULL;

  GET DIAGNOSTICS v_added = ROW_COUNT;
  RETURN v_added;
END;
$function$;
REVOKE ALL ON FUNCTION public.add_smartnekam_chat_group_members(UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_smartnekam_chat_group_members(UUID, UUID[]) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Followers. Following is tied to an authenticated profile and can never be
-- used to follow oneself. Follower relationships are readable to signed-in users.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_follows (
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT user_follows_not_self CHECK (follower_id <> following_id),
  CONSTRAINT user_follows_unique UNIQUE (follower_id, following_id)
);
CREATE INDEX IF NOT EXISTS user_follows_following_created_idx
  ON public.user_follows (following_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_follows_follower_created_idx
  ON public.user_follows (follower_id, created_at DESC);

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_follows_read_authenticated ON public.user_follows;
CREATE POLICY user_follows_read_authenticated ON public.user_follows
  FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS user_follows_insert_self ON public.user_follows;
CREATE POLICY user_follows_insert_self ON public.user_follows
  FOR INSERT TO authenticated
  WITH CHECK (
    follower_id = (SELECT auth.uid())
    AND follower_id <> following_id
  );
DROP POLICY IF EXISTS user_follows_delete_self ON public.user_follows;
CREATE POLICY user_follows_delete_self ON public.user_follows
  FOR DELETE TO authenticated USING (follower_id = (SELECT auth.uid()));
REVOKE ALL ON TABLE public.user_follows FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.user_follows TO authenticated;

-- Append follow fields to the existing view, preserving SQL 016/018 column order.
CREATE OR REPLACE VIEW public.posts_feed AS
SELECT
    p.id,
    CASE WHEN p.is_anonymous THEN NULL ELSE p.author_id END AS author_id,
    p.category,
    p.subject,
    p.content,
    p.image_url,
    p.created_at,
    CASE WHEN p.is_anonymous THEN NULL ELSE pr.full_name::TEXT END AS author_name,
    CASE WHEN p.is_anonymous THEN NULL ELSE pr.username::TEXT END AS author_username,
    CASE WHEN p.is_anonymous THEN NULL ELSE pr.avatar_url::TEXT END AS author_avatar,
    CASE WHEN p.is_anonymous THEN NULL ELSE pr.role::TEXT END AS author_role,
    (SELECT pg_catalog.count(*)::INTEGER FROM public.post_likes pl WHERE pl.post_id = p.id) AS like_count,
    (SELECT pg_catalog.count(*)::INTEGER FROM public.post_comments pc WHERE pc.post_id = p.id AND pc.status = 'published') AS comment_count,
    (SELECT pg_catalog.count(*)::INTEGER FROM public.post_shares ps WHERE ps.post_id = p.id) AS share_count,
    EXISTS (SELECT 1 FROM public.post_likes pl WHERE pl.post_id = p.id AND pl.user_id = (SELECT auth.uid())) AS liked_by_me,
    p.is_anonymous,
    p.attachments,
    CASE WHEN p.is_anonymous THEN 0 ELSE
      (SELECT pg_catalog.count(*)::INTEGER FROM public.user_follows uf WHERE uf.following_id = p.author_id)
    END AS author_follower_count,
    CASE WHEN p.is_anonymous THEN FALSE ELSE
      EXISTS (
        SELECT 1 FROM public.user_follows uf
        WHERE uf.follower_id = (SELECT auth.uid()) AND uf.following_id = p.author_id
      )
    END AS following_author_by_me
FROM public.posts p
JOIN public.profiles pr ON pr.id = p.author_id
WHERE p.status = 'published';
GRANT SELECT ON public.posts_feed TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;

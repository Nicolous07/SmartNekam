-- SmartNekam SQL 018 — Post Attachments + University Peer Mentorship
-- Preconditions: SQL 016 (social feed/chat), SQL 006 (mentors/sessions), and SQL 017.
-- Safe to re-run: additive schema changes and replaceable policies/functions.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Attachments for social posts (public feed media only; never private files)
-- ---------------------------------------------------------------------------
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::JSONB;

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'posts_attachments_check'
      AND conrelid = 'public.posts'::REGCLASS
  ) THEN
    ALTER TABLE public.posts
      ADD CONSTRAINT posts_attachments_check CHECK (
        CASE
          WHEN pg_catalog.jsonb_typeof(attachments) = 'array'
          THEN pg_catalog.jsonb_array_length(attachments) <= 5
          ELSE FALSE
        END
      );
  END IF;
END;
$block$;

-- Append attachments after all existing columns so CREATE OR REPLACE VIEW remains compatible.
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
    (SELECT count(*)::INTEGER FROM public.post_likes pl WHERE pl.post_id = p.id) AS like_count,
    (SELECT count(*)::INTEGER FROM public.post_comments pc WHERE pc.post_id = p.id AND pc.status = 'published') AS comment_count,
    (SELECT count(*)::INTEGER FROM public.post_shares ps WHERE ps.post_id = p.id) AS share_count,
    EXISTS (SELECT 1 FROM public.post_likes pl WHERE pl.post_id = p.id AND pl.user_id = (SELECT auth.uid())) AS liked_by_me,
    p.is_anonymous,
    p.attachments
FROM public.posts p
JOIN public.profiles pr ON pr.id = p.author_id
WHERE p.status = 'published';

GRANT SELECT ON public.posts_feed TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-attachments', 'post-attachments', TRUE, 10485760,
  ARRAY[
    'image/jpeg','image/png','image/webp','image/gif','application/pdf',
    'text/plain','text/csv','application/msword','application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]::TEXT[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS smartnekam_post_attachments_select_public ON storage.objects;
CREATE POLICY smartnekam_post_attachments_select_public ON storage.objects
FOR SELECT TO public USING (bucket_id = 'post-attachments');

DROP POLICY IF EXISTS smartnekam_post_attachments_insert_own ON storage.objects;
CREATE POLICY smartnekam_post_attachments_insert_own ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'post-attachments'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
);

DROP POLICY IF EXISTS smartnekam_post_attachments_update_own ON storage.objects;
CREATE POLICY smartnekam_post_attachments_update_own ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'post-attachments' AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT)
WITH CHECK (bucket_id = 'post-attachments' AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT);

DROP POLICY IF EXISTS smartnekam_post_attachments_delete_own ON storage.objects;
CREATE POLICY smartnekam_post_attachments_delete_own ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'post-attachments'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
);

-- ---------------------------------------------------------------------------
-- 2. Only University-level accounts can submit a peer mentor profile.
-- Existing profiles remain intact; new mentor requests remain pending until review.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS mentors_insert_own_pending ON public.mentors;
CREATE POLICY mentors_insert_own_pending ON public.mentors FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND status = 'pending_review'
  AND verified = FALSE
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.status = 'active'
      AND p.level = 'UNIVERSITY'
  )
);

DROP POLICY IF EXISTS mentors_update_own ON public.mentors;
CREATE POLICY mentors_update_own ON public.mentors FOR UPDATE TO authenticated
USING (
  user_id = (SELECT auth.uid())
  AND status IN ('pending_review', 'active')
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.level = 'UNIVERSITY')
)
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND status IN ('pending_review', 'active')
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.level = 'UNIVERSITY')
);

-- ---------------------------------------------------------------------------
-- 3. Include accepted mentor conversations in the normal SmartNekam inbox.
-- When a mentor accepts, SQL 006 creates a conversation_type='mentor' chat.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_chat_inbox()
RETURNS TABLE (
    conversation_id UUID,
    conversation_type TEXT,
    other_user_id UUID,
    other_full_name TEXT,
    other_username TEXT,
    other_avatar_url TEXT,
    last_message TEXT,
    last_message_at TIMESTAMPTZ,
    unread_count BIGINT,
    can_message BOOLEAN,
    group_visibility TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT * FROM (
        SELECT
            c.id AS conversation_id,
            c.conversation_type::TEXT AS conversation_type,
            other_p.id AS other_user_id,
            other_p.full_name::TEXT AS other_full_name,
            other_p.username::TEXT AS other_username,
            other_p.avatar_url::TEXT AS other_avatar_url,
            last_msg.body::TEXT AS last_message,
            COALESCE(last_msg.created_at, c.updated_at) AS last_message_at,
            COALESCE(unread.amount, 0)::BIGINT AS unread_count,
            CASE WHEN c.conversation_type = 'mentor' THEN TRUE
                 ELSE public.can_start_smartnekam_direct_message(other_p.id) END AS can_message,
            NULL::TEXT AS group_visibility
        FROM public.chat_participants mine
        JOIN public.chat_conversations c ON c.id = mine.conversation_id
        JOIN public.chat_participants theirs ON theirs.conversation_id = c.id AND theirs.user_id <> mine.user_id AND theirs.left_at IS NULL
        JOIN public.profiles other_p ON other_p.id = theirs.user_id AND other_p.status = 'active'
        LEFT JOIN LATERAL (
            SELECT m.body, m.created_at FROM public.chat_messages m
            WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1
        ) last_msg ON TRUE
        LEFT JOIN LATERAL (
            SELECT count(*) AS amount FROM public.chat_messages m
            WHERE m.conversation_id = c.id
              AND m.sender_id <> mine.user_id
              AND m.created_at > COALESCE(mine.last_read_at, 'epoch'::TIMESTAMPTZ)
        ) unread ON TRUE
        WHERE mine.user_id = (SELECT auth.uid())
          AND mine.left_at IS NULL
          AND c.conversation_type IN ('direct', 'mentor')
          AND c.status = 'active'

        UNION ALL

        SELECT
            c.id AS conversation_id,
            c.conversation_type::TEXT AS conversation_type,
            NULL::UUID AS other_user_id,
            c.title::TEXT AS other_full_name,
            NULL::TEXT AS other_username,
            NULL::TEXT AS other_avatar_url,
            last_msg.body::TEXT AS last_message,
            COALESCE(last_msg.created_at, c.updated_at) AS last_message_at,
            COALESCE(unread.amount, 0)::BIGINT AS unread_count,
            TRUE AS can_message,
            s.visibility::TEXT AS group_visibility
        FROM public.chat_participants mine
        JOIN public.chat_conversations c ON c.id = mine.conversation_id
            AND c.conversation_type = 'group' AND c.status = 'active'
        JOIN public.chat_group_settings s ON s.conversation_id = c.id
        LEFT JOIN LATERAL (
            SELECT m.body, m.created_at FROM public.chat_messages m
            WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1
        ) last_msg ON TRUE
        LEFT JOIN LATERAL (
            SELECT count(*) AS amount FROM public.chat_messages m
            WHERE m.conversation_id = c.id
              AND m.sender_id <> mine.user_id
              AND m.created_at > COALESCE(mine.last_read_at, 'epoch'::TIMESTAMPTZ)
        ) unread ON TRUE
        WHERE mine.user_id = (SELECT auth.uid()) AND mine.left_at IS NULL
    ) AS chats
    ORDER BY chats.last_message_at DESC NULLS LAST;
$function$;
REVOKE ALL ON FUNCTION public.get_my_chat_inbox() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_chat_inbox() TO authenticated;

COMMIT;

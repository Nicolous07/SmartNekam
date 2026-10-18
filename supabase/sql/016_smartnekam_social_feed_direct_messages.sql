-- SmartNekam | SQL 016: Home social feed, comment threads, usernames and direct messaging.
-- Prerequisites: SQL 001A/001B, SQL 006, SQL 007 and SQL 013.
-- Safe to re-run during development; does not drop existing user content.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Public profile fields required for social posts and username discovery.
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username VARCHAR(20);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- Assign stable usernames to users created before this migration.
UPDATE public.profiles
SET username = 'student_' || substr(replace(id::text, '-', ''), 1, 10)
WHERE username IS NULL OR btrim(username) = '';

ALTER TABLE public.profiles
    ALTER COLUMN username SET DEFAULT ('student_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
ALTER TABLE public.profiles ALTER COLUMN username SET NOT NULL;

DO $constraint$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.profiles'::regclass
          AND conname = 'profiles_username_format_check'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_username_format_check
            CHECK (username ~ '^[a-z0-9_]{3,20}$');
    END IF;
END;
$constraint$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_unique_idx
    ON public.profiles (lower(username));

-- Existing profile form calls these RPCs; keep profile edits constrained to safe fields.
CREATE OR REPLACE FUNCTION public.is_username_available(p_username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_username TEXT := lower(btrim(COALESCE(p_username, '')));
    v_uid UUID := (SELECT auth.uid());
BEGIN
    IF v_uid IS NULL OR v_username !~ '^[a-z0-9_]{3,20}$' THEN
        RETURN FALSE;
    END IF;
    RETURN NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE lower(p.username) = v_username AND p.id <> v_uid
    );
END;
$function$;
REVOKE ALL ON FUNCTION public.is_username_available(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_username_available(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_my_profile(
    p_full_name TEXT,
    p_username TEXT,
    p_avatar_url TEXT DEFAULT NULL,
    p_bio TEXT DEFAULT '',
    p_remove_avatar BOOLEAN DEFAULT FALSE,
    p_cover_url TEXT DEFAULT NULL,
    p_remove_cover BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_username TEXT := lower(btrim(COALESCE(p_username, '')));
    v_name TEXT := btrim(COALESCE(p_full_name, ''));
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
    IF length(v_name) < 3 OR length(v_name) > 120 THEN RAISE EXCEPTION 'invalid_name'; END IF;
    IF v_username !~ '^[a-z0-9_]{3,20}$' THEN RAISE EXCEPTION 'invalid_username'; END IF;
    IF EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.username) = v_username AND p.id <> v_uid) THEN
        RAISE EXCEPTION 'username_taken';
    END IF;
    IF length(COALESCE(p_bio, '')) > 280 THEN RAISE EXCEPTION 'bio_too_long'; END IF;

    UPDATE public.profiles p
    SET full_name = v_name,
        username = v_username,
        bio = COALESCE(p_bio, ''),
        avatar_url = CASE
            WHEN COALESCE(p_remove_avatar, FALSE) THEN NULL
            WHEN p_avatar_url IS NOT NULL THEN p_avatar_url
            ELSE p.avatar_url
        END,
        cover_url = CASE
            WHEN COALESCE(p_remove_cover, FALSE) THEN NULL
            WHEN p_cover_url IS NOT NULL THEN p_cover_url
            ELSE p.cover_url
        END,
        updated_at = pg_catalog.now()
    WHERE p.id = v_uid AND p.status = 'active';

    IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_found_or_inactive'; END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.update_my_profile(TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_profile(TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, BOOLEAN) TO authenticated;

-- Make username discovery genuinely useful for new users: users with no explicit
-- DM preference may be contacted by username. Existing user-selected privacy
-- settings (group_members/no_one) are preserved.
ALTER TABLE public.user_privacy_settings
    ALTER COLUMN allow_direct_messages SET DEFAULT 'everyone';

CREATE OR REPLACE FUNCTION public.can_start_smartnekam_direct_message(p_other_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_user_id UUID := (SELECT auth.uid());
    v_dm_policy TEXT;
BEGIN
    IF v_user_id IS NULL OR p_other_user_id IS NULL OR p_other_user_id = v_user_id THEN
        RETURN FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = v_user_id AND p.status = 'active'
    ) OR NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = p_other_user_id AND p.status = 'active'
    ) THEN
        RETURN FALSE;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.user_blocks b
        WHERE (b.blocker_id = v_user_id AND b.blocked_user_id = p_other_user_id)
           OR (b.blocker_id = p_other_user_id AND b.blocked_user_id = v_user_id)
    ) THEN
        RETURN FALSE;
    END IF;

    SELECT COALESCE(
        (SELECT s.allow_direct_messages
         FROM public.user_privacy_settings s
         WHERE s.user_id = p_other_user_id),
        'everyone'
    ) INTO v_dm_policy;

    IF v_dm_policy = 'no_one' THEN
        RETURN FALSE;
    ELSIF v_dm_policy = 'group_members' THEN
        RETURN EXISTS (
            SELECT 1
            FROM public.group_members mine
            JOIN public.group_members theirs ON theirs.group_id = mine.group_id
            JOIN public.study_groups g ON g.id = mine.group_id AND g.status = 'active'
            WHERE mine.user_id = v_user_id AND theirs.user_id = p_other_user_id
        );
    END IF;

    RETURN v_dm_policy = 'everyone';
END;
$function$;
REVOKE ALL PRIVILEGES ON FUNCTION public.can_start_smartnekam_direct_message(UUID) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Home feed posts, likes, threaded comments, and share counts.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
    category VARCHAR(24) NOT NULL DEFAULT 'academics',
    subject VARCHAR(100),
    content TEXT NOT NULL,
    image_url TEXT,
    is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'published',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT posts_category_check CHECK (category IN ('academics', 'guidance', 'campus_life', 'general')),
    CONSTRAINT posts_status_check CHECK (status IN ('published', 'hidden', 'removed')),
    CONSTRAINT posts_content_check CHECK (length(btrim(content)) BETWEEN 3 AND 5000),
    CONSTRAINT posts_image_url_check CHECK (image_url IS NULL OR image_url ~* '^https?://')
);
CREATE INDEX IF NOT EXISTS posts_published_feed_idx ON public.posts (created_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS posts_author_created_idx ON public.posts (author_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.post_likes (
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS post_likes_user_idx ON public.post_likes (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.post_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    author_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'published',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT post_comments_content_check CHECK (length(btrim(content)) BETWEEN 1 AND 2000),
    CONSTRAINT post_comments_status_check CHECK (status IN ('published', 'hidden', 'removed'))
);
CREATE INDEX IF NOT EXISTS post_comments_post_created_idx ON public.post_comments (post_id, created_at ASC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS post_comments_parent_idx ON public.post_comments (parent_comment_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.post_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    shared_by UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
    share_method VARCHAR(16) NOT NULL DEFAULT 'link',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT post_shares_method_check CHECK (share_method IN ('link', 'native', 'copy'))
);
CREATE INDEX IF NOT EXISTS post_shares_post_created_idx ON public.post_shares (post_id, created_at DESC);

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
    p.is_anonymous
FROM public.posts p
JOIN public.profiles pr ON pr.id = p.author_id
WHERE p.status = 'published';

CREATE OR REPLACE VIEW public.post_comments_feed AS
SELECT
    c.id,
    c.post_id,
    c.parent_comment_id,
    c.author_id,
    c.content,
    c.created_at,
    pr.full_name::TEXT AS author_name,
    pr.username::TEXT AS author_username,
    pr.avatar_url::TEXT AS author_avatar
FROM public.post_comments c
JOIN public.profiles pr ON pr.id = c.author_id
JOIN public.posts p ON p.id = c.post_id
WHERE c.status = 'published' AND p.status = 'published';

-- Keep anonymous author IDs out of direct table reads. The feed uses a view
-- that masks author fields; policy checks use this narrow helper so users do not
-- need SELECT rights on the base posts table.
CREATE OR REPLACE FUNCTION public.smartnekam_post_is_published(p_post_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.posts p
        WHERE p.id = p_post_id AND p.status = 'published'
    );
$function$;
REVOKE ALL PRIVILEGES ON FUNCTION public.smartnekam_post_is_published(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.smartnekam_post_is_published(UUID) TO authenticated;

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS posts_select_published_or_owner ON public.posts;
CREATE POLICY posts_select_published_or_owner ON public.posts
FOR SELECT TO authenticated
USING (status = 'published' OR author_id = (SELECT auth.uid()) OR public.is_smartnekam_moderator());
DROP POLICY IF EXISTS posts_insert_own ON public.posts;
CREATE POLICY posts_insert_own ON public.posts
FOR INSERT TO authenticated
WITH CHECK (author_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.status = 'active'
));
DROP POLICY IF EXISTS posts_update_own_or_moderator ON public.posts;
CREATE POLICY posts_update_own_or_moderator ON public.posts
FOR UPDATE TO authenticated
USING (author_id = (SELECT auth.uid()) OR public.is_smartnekam_moderator())
WITH CHECK (author_id = (SELECT auth.uid()) OR public.is_smartnekam_moderator());
DROP POLICY IF EXISTS posts_delete_own_or_moderator ON public.posts;
CREATE POLICY posts_delete_own_or_moderator ON public.posts
FOR DELETE TO authenticated
USING (author_id = (SELECT auth.uid()) OR public.is_smartnekam_moderator());

DROP POLICY IF EXISTS post_likes_select_public_posts ON public.post_likes;
CREATE POLICY post_likes_select_public_posts ON public.post_likes
FOR SELECT TO authenticated USING (public.smartnekam_post_is_published(post_id));
DROP POLICY IF EXISTS post_likes_insert_own ON public.post_likes;
CREATE POLICY post_likes_insert_own ON public.post_likes
FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()) AND public.smartnekam_post_is_published(post_id));
DROP POLICY IF EXISTS post_likes_delete_own ON public.post_likes;
CREATE POLICY post_likes_delete_own ON public.post_likes
FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS post_comments_select_public ON public.post_comments;
CREATE POLICY post_comments_select_public ON public.post_comments
FOR SELECT TO authenticated USING (
    status = 'published' AND public.smartnekam_post_is_published(post_id)
);
DROP POLICY IF EXISTS post_comments_insert_own ON public.post_comments;
CREATE POLICY post_comments_insert_own ON public.post_comments
FOR INSERT TO authenticated WITH CHECK (
    author_id = (SELECT auth.uid())
    AND public.smartnekam_post_is_published(post_id)
    AND (
        parent_comment_id IS NULL OR EXISTS (
            SELECT 1 FROM public.post_comments parent
            WHERE parent.id = public.post_comments.parent_comment_id
              AND parent.post_id = public.post_comments.post_id
              AND parent.status = 'published'
        )
    )
);
DROP POLICY IF EXISTS post_comments_update_own_or_moderator ON public.post_comments;
CREATE POLICY post_comments_update_own_or_moderator ON public.post_comments
FOR UPDATE TO authenticated
USING (author_id = (SELECT auth.uid()) OR public.is_smartnekam_moderator())
WITH CHECK (author_id = (SELECT auth.uid()) OR public.is_smartnekam_moderator());
DROP POLICY IF EXISTS post_comments_delete_own_or_moderator ON public.post_comments;
CREATE POLICY post_comments_delete_own_or_moderator ON public.post_comments
FOR DELETE TO authenticated USING (author_id = (SELECT auth.uid()) OR public.is_smartnekam_moderator());

-- Prevent content authors from restoring moderator-hidden/removed posts or comments.
-- Trusted server/admin SQL running with auth.uid() NULL can still manage these states.
CREATE OR REPLACE FUNCTION public.guard_social_content_moderation_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND (SELECT auth.uid()) IS NOT NULL
       AND NOT public.is_smartnekam_moderator() THEN
        RAISE EXCEPTION 'Only SmartNekam moderators may change content moderation status.';
    END IF;
    RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.guard_social_content_moderation_state() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS posts_guard_moderation_status ON public.posts;
CREATE TRIGGER posts_guard_moderation_status
BEFORE UPDATE OF status ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.guard_social_content_moderation_state();
DROP TRIGGER IF EXISTS post_comments_guard_moderation_status ON public.post_comments;
CREATE TRIGGER post_comments_guard_moderation_status
BEFORE UPDATE OF status ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.guard_social_content_moderation_state();

DROP POLICY IF EXISTS post_shares_select_public_posts ON public.post_shares;
CREATE POLICY post_shares_select_public_posts ON public.post_shares
FOR SELECT TO authenticated USING (public.smartnekam_post_is_published(post_id));
DROP POLICY IF EXISTS post_shares_insert_own ON public.post_shares;
CREATE POLICY post_shares_insert_own ON public.post_shares
FOR INSERT TO authenticated WITH CHECK (shared_by = (SELECT auth.uid()) AND public.smartnekam_post_is_published(post_id));

REVOKE ALL PRIVILEGES ON TABLE public.posts, public.post_likes, public.post_comments, public.post_shares FROM PUBLIC, anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.post_likes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_comments TO authenticated;
GRANT SELECT, INSERT ON public.post_shares TO authenticated;
GRANT SELECT ON public.posts_feed, public.post_comments_feed TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Public media buckets for post images and avatars.
-- These buckets contain public-facing profile/feed images only, never private documents.
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('post-images', 'post-images', TRUE, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif']::TEXT[]),
    ('avatars', 'avatars', TRUE, 8388608, ARRAY['image/jpeg','image/png','image/webp']::TEXT[])
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS smartnekam_post_images_select_public ON storage.objects;
CREATE POLICY smartnekam_post_images_select_public ON storage.objects
FOR SELECT TO public USING (bucket_id = 'post-images');
DROP POLICY IF EXISTS smartnekam_post_images_insert_own ON storage.objects;
CREATE POLICY smartnekam_post_images_insert_own ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'post-images' AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
);
DROP POLICY IF EXISTS smartnekam_post_images_update_own ON storage.objects;
CREATE POLICY smartnekam_post_images_update_own ON storage.objects
FOR UPDATE TO authenticated USING (
    bucket_id = 'post-images' AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
) WITH CHECK (
    bucket_id = 'post-images' AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
);
DROP POLICY IF EXISTS smartnekam_post_images_delete_own ON storage.objects;
CREATE POLICY smartnekam_post_images_delete_own ON storage.objects
FOR DELETE TO authenticated USING (
    bucket_id = 'post-images' AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
);

DROP POLICY IF EXISTS smartnekam_avatars_select_public ON storage.objects;
CREATE POLICY smartnekam_avatars_select_public ON storage.objects
FOR SELECT TO public USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS smartnekam_avatars_insert_own ON storage.objects;
CREATE POLICY smartnekam_avatars_insert_own ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
);
DROP POLICY IF EXISTS smartnekam_avatars_update_own ON storage.objects;
CREATE POLICY smartnekam_avatars_update_own ON storage.objects
FOR UPDATE TO authenticated USING (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
) WITH CHECK (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
);
DROP POLICY IF EXISTS smartnekam_avatars_delete_own ON storage.objects;
CREATE POLICY smartnekam_avatars_delete_own ON storage.objects
FOR DELETE TO authenticated USING (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
);

-- -----------------------------------------------------------------------------
-- 4. Username discovery and WhatsApp-style direct message inbox/message RPCs.
-- The search RPC returns only safe public identity fields, never email/phone.
-- Existing SQL 013 privacy and block rules still govern whether a new DM may start.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_smartnekam_users(p_query TEXT, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    username TEXT,
    avatar_url TEXT,
    role TEXT,
    can_message BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_query TEXT := lower(regexp_replace(btrim(COALESCE(p_query, '')), '^@', ''));
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
    IF length(v_query) < 2 THEN RETURN; END IF;

    RETURN QUERY
    SELECT p.id,
           p.full_name::TEXT,
           p.username::TEXT,
           p.avatar_url::TEXT,
           p.role::TEXT,
           public.can_start_smartnekam_direct_message(p.id) AS can_message
    FROM public.profiles p
    LEFT JOIN public.user_privacy_settings ups ON ups.user_id = p.id
    WHERE p.id <> v_uid
      AND p.status = 'active'
      AND COALESCE(ups.profile_visibility, 'community') <> 'private'
      AND NOT EXISTS (
          SELECT 1 FROM public.user_blocks b
          WHERE (b.blocker_id = v_uid AND b.blocked_user_id = p.id)
             OR (b.blocker_id = p.id AND b.blocked_user_id = v_uid)
      )
      AND (lower(p.username) LIKE v_query || '%' OR lower(p.full_name) LIKE '%' || v_query || '%')
    ORDER BY (lower(p.username) = v_query) DESC, (lower(p.username) LIKE v_query || '%') DESC, p.full_name
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 20);
END;
$function$;
REVOKE ALL ON FUNCTION public.search_smartnekam_users(TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_smartnekam_users(TEXT, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_chat_inbox()
RETURNS TABLE (
    conversation_id UUID,
    other_user_id UUID,
    other_full_name TEXT,
    other_username TEXT,
    other_avatar_url TEXT,
    last_message TEXT,
    last_message_at TIMESTAMPTZ,
    unread_count BIGINT,
    can_message BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_uid UUID := (SELECT auth.uid());
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

    RETURN QUERY
    SELECT c.id,
           other_p.id,
           other_p.full_name::TEXT,
           other_p.username::TEXT,
           other_p.avatar_url::TEXT,
           last_msg.body::TEXT,
           COALESCE(last_msg.created_at, c.updated_at),
           COALESCE(unread.amount, 0)::BIGINT,
           public.can_start_smartnekam_direct_message(other_p.id)
    FROM public.chat_participants mine
    JOIN public.chat_conversations c ON c.id = mine.conversation_id
    JOIN public.chat_participants theirs
      ON theirs.conversation_id = c.id AND theirs.user_id <> v_uid AND theirs.left_at IS NULL
    JOIN public.profiles other_p ON other_p.id = theirs.user_id AND other_p.status = 'active'
    LEFT JOIN LATERAL (
        SELECT m.body, m.created_at
        FROM public.chat_messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC
        LIMIT 1
    ) last_msg ON TRUE
    LEFT JOIN LATERAL (
        SELECT count(*) AS amount
        FROM public.chat_messages m
        WHERE m.conversation_id = c.id
          AND m.sender_id <> v_uid
          AND m.created_at > COALESCE(mine.last_read_at, 'epoch'::TIMESTAMPTZ)
    ) unread ON TRUE
    WHERE mine.user_id = v_uid
      AND mine.left_at IS NULL
      AND c.conversation_type = 'direct'
      AND c.status = 'active'
    ORDER BY COALESCE(last_msg.created_at, c.updated_at) DESC;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_my_chat_inbox() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_chat_inbox() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_smartnekam_chat_messages(p_conversation_id UUID, p_limit INTEGER DEFAULT 80)
RETURNS TABLE (
    id UUID,
    conversation_id UUID,
    sender_id UUID,
    sender_name TEXT,
    sender_username TEXT,
    sender_avatar TEXT,
    body TEXT,
    attachment_path TEXT,
    message_type TEXT,
    reply_to_message_id UUID,
    edited_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_uid UUID := (SELECT auth.uid());
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.chat_participants cp
        WHERE cp.conversation_id = p_conversation_id AND cp.user_id = v_uid AND cp.left_at IS NULL
    ) THEN RAISE EXCEPTION 'conversation_not_available'; END IF;

    RETURN QUERY
    SELECT m.id, m.conversation_id, m.sender_id,
           p.full_name::TEXT, p.username::TEXT, p.avatar_url::TEXT,
           m.body::TEXT, m.attachment_path::TEXT, m.message_type::TEXT,
           m.reply_to_message_id, m.edited_at, m.created_at
    FROM (
        SELECT cm.*
        FROM public.chat_messages cm
        WHERE cm.conversation_id = p_conversation_id
        ORDER BY cm.created_at DESC
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 80), 1), 100)
    ) m
    JOIN public.profiles p ON p.id = m.sender_id
    ORDER BY m.created_at ASC;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_smartnekam_chat_messages(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_smartnekam_chat_messages(UUID, INTEGER) TO authenticated;

-- Include direct messages in Supabase Realtime when that publication exists.
DO $publication$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
       AND NOT EXISTS (
           SELECT 1 FROM pg_publication_tables
           WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
       ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
    END IF;
END;
$publication$;

COMMIT;

-- Verification query:
-- SELECT to_regclass('public.posts'), to_regclass('public.post_likes'),
--        to_regclass('public.post_comments'), to_regclass('public.post_shares'),
--        to_regprocedure('public.search_smartnekam_users(text,integer)'),
--        to_regprocedure('public.get_my_chat_inbox()'),
--        to_regprocedure('public.get_smartnekam_chat_messages(uuid,integer)');

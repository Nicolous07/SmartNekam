-- SmartNekam SQL 017
-- Registration identity, unique username rules, profile media, chat groups,
-- and reply/edit/delete/reaction controls for direct and group chat messages.
-- Prerequisites: SQL 001A/001B, 003, 006, 013 and 016.
-- Safe to re-run during development; does not delete user content.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Registration identity: never create the generic "SmartNekam Student" name.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.smartnekam_normalize_identity(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $function$
    SELECT regexp_replace(lower(COALESCE(p_value, '')), '[^a-z0-9]', '', 'g');
$function$;

-- Fix legacy placeholder display names using the name/email already stored in Auth.
UPDATE public.profiles p
SET full_name = COALESCE(
    NULLIF(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(btrim(u.raw_user_meta_data ->> 'name'), ''),
    NULLIF(split_part(COALESCE(u.email, ''), '@', 1), ''),
    CASE WHEN u.phone IS NOT NULL THEN 'Mwanafunzi ' || right(regexp_replace(u.phone, '\D', '', 'g'), 4) END,
    'Mwanafunzi ' || right(replace(p.id::text, '-', ''), 4)
),
updated_at = now()
FROM auth.users u
WHERE u.id = p.id
  AND lower(btrim(COALESCE(p.full_name, ''))) IN ('smartnekam student', 'student');

-- Avoid existing usernames that normalize to the same string as display name.
UPDATE public.profiles p
SET username = 'student_' || substr(replace(p.id::text, '-', ''), 1, 10)
WHERE public.smartnekam_normalize_identity(p.username) <> ''
  AND public.smartnekam_normalize_identity(p.username) = public.smartnekam_normalize_identity(p.full_name);

CREATE OR REPLACE FUNCTION public.smartnekam_validate_profile_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
    NEW.full_name := btrim(COALESCE(NEW.full_name, ''));
    NEW.username := lower(btrim(COALESCE(NEW.username, '')));

    IF length(NEW.full_name) < 3 OR length(NEW.full_name) > 120 THEN
        RAISE EXCEPTION 'display_name_invalid';
    END IF;
    IF NEW.username !~ '^[a-z0-9_]{3,20}$' THEN
        RAISE EXCEPTION 'username_invalid_use_3_to_20_letters_numbers_or_underscores';
    END IF;
    IF public.smartnekam_normalize_identity(NEW.username) = public.smartnekam_normalize_identity(NEW.full_name) THEN
        RAISE EXCEPTION 'username_must_be_different_from_display_name';
    END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS profiles_validate_identity ON public.profiles;
CREATE TRIGGER profiles_validate_identity
BEFORE INSERT OR UPDATE OF full_name, username ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.smartnekam_validate_profile_identity();

-- Public pre-signup availability check. It reveals only whether a username is free.
CREATE OR REPLACE FUNCTION public.is_smartnekam_username_available(p_username TEXT, p_display_name TEXT DEFAULT '')
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_username TEXT := lower(btrim(COALESCE(p_username, '')));
BEGIN
    IF v_username !~ '^[a-z0-9_]{3,20}$' THEN RETURN FALSE; END IF;
    IF public.smartnekam_normalize_identity(v_username) = public.smartnekam_normalize_identity(p_display_name) THEN RETURN FALSE; END IF;
    RETURN NOT EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.username) = v_username);
END;
$function$;
REVOKE ALL ON FUNCTION public.is_smartnekam_username_available(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_smartnekam_username_available(TEXT, TEXT) TO anon, authenticated;

-- Auth trigger accepts display name + username from email/phone registration.
-- OAuth/legacy registrations get a unique generated username instead of a fake display name.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_full_name TEXT;
    v_username TEXT;
BEGIN
    v_full_name := COALESCE(
        NULLIF(btrim(NEW.raw_user_meta_data ->> 'full_name'), ''),
        NULLIF(btrim(NEW.raw_user_meta_data ->> 'name'), ''),
        NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
        CASE WHEN NEW.phone IS NOT NULL THEN 'Mwanafunzi ' || right(regexp_replace(NEW.phone, '\D', '', 'g'), 4) END,
        'Mwanafunzi ' || right(replace(NEW.id::text, '-', ''), 4)
    );
    v_username := lower(btrim(COALESCE(NEW.raw_user_meta_data ->> 'username', '')));
    IF v_username = '' THEN
        v_username := 'student_' || substr(replace(NEW.id::text, '-', ''), 1, 10);
    END IF;
    IF v_username !~ '^[a-z0-9_]{3,20}$' THEN RAISE EXCEPTION 'username_invalid'; END IF;
    IF public.smartnekam_normalize_identity(v_username) = public.smartnekam_normalize_identity(v_full_name) THEN
        RAISE EXCEPTION 'username_must_be_different_from_display_name';
    END IF;

    INSERT INTO public.profiles (id, full_name, phone, email, username)
    VALUES (NEW.id, v_full_name, NEW.phone, NEW.email, v_username)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$function$;
REVOKE ALL PRIVILEGES ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

-- Extend existing profile-edit RPC with the same uniqueness/display-name rule.
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
    IF length(v_name) < 3 OR length(v_name) > 120 THEN RAISE EXCEPTION 'display_name_invalid'; END IF;
    IF v_username !~ '^[a-z0-9_]{3,20}$' THEN RAISE EXCEPTION 'username_invalid'; END IF;
    IF public.smartnekam_normalize_identity(v_username) = public.smartnekam_normalize_identity(v_name) THEN
        RAISE EXCEPTION 'username_must_be_different_from_display_name';
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.username) = v_username AND p.id <> v_uid) THEN
        RAISE EXCEPTION 'username_taken';
    END IF;
    IF length(COALESCE(p_bio, '')) > 280 THEN RAISE EXCEPTION 'bio_too_long'; END IF;

    UPDATE public.profiles p
    SET full_name = v_name,
        username = v_username,
        bio = COALESCE(p_bio, ''),
        avatar_url = CASE WHEN COALESCE(p_remove_avatar, FALSE) THEN NULL WHEN p_avatar_url IS NOT NULL THEN p_avatar_url ELSE p.avatar_url END,
        cover_url = CASE WHEN COALESCE(p_remove_cover, FALSE) THEN NULL WHEN p_cover_url IS NOT NULL THEN p_cover_url ELSE p.cover_url END,
        updated_at = pg_catalog.now()
    WHERE p.id = v_uid AND p.status = 'active';
    IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_found_or_inactive'; END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.update_my_profile(TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_profile(TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, BOOLEAN) TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. Public-facing profile cover images. Profile avatars use the existing avatars bucket.
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-covers', 'profile-covers', TRUE, 8388608, ARRAY['image/jpeg','image/png','image/webp']::TEXT[])
ON CONFLICT (id) DO UPDATE SET public = TRUE, file_size_limit = 8388608,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']::TEXT[];

DROP POLICY IF EXISTS smartnekam_profile_covers_select_public ON storage.objects;
CREATE POLICY smartnekam_profile_covers_select_public ON storage.objects
FOR SELECT TO public USING (bucket_id = 'profile-covers');
DROP POLICY IF EXISTS smartnekam_profile_covers_insert_own ON storage.objects;
CREATE POLICY smartnekam_profile_covers_insert_own ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'profile-covers' AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT);
DROP POLICY IF EXISTS smartnekam_profile_covers_update_own ON storage.objects;
CREATE POLICY smartnekam_profile_covers_update_own ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'profile-covers' AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT)
WITH CHECK (bucket_id = 'profile-covers' AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT);
DROP POLICY IF EXISTS smartnekam_profile_covers_delete_own ON storage.objects;
CREATE POLICY smartnekam_profile_covers_delete_own ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'profile-covers' AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT);

-- -----------------------------------------------------------------------------
-- 3. Chat groups: separate from public Study Groups (study_groups).
-- Public chat groups can be discovered/joined; private groups require an invite code.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_group_settings (
    conversation_id UUID PRIMARY KEY REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    description TEXT NOT NULL DEFAULT '',
    visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public','private')),
    invite_code TEXT NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (length(btrim(description)) <= 1000)
);
CREATE INDEX IF NOT EXISTS chat_group_settings_discover_idx ON public.chat_group_settings (visibility, created_at DESC);
ALTER TABLE public.chat_group_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_group_settings_read_public_or_member ON public.chat_group_settings;
CREATE POLICY chat_group_settings_read_public_or_member ON public.chat_group_settings
FOR SELECT TO authenticated USING (
    visibility = 'public'
    OR created_by = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.chat_participants cp WHERE cp.conversation_id = chat_group_settings.conversation_id AND cp.user_id = (SELECT auth.uid()) AND cp.left_at IS NULL)
);
REVOKE ALL ON public.chat_group_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.chat_group_settings TO authenticated;

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
RETURNS TABLE(conversation_id UUID, title TEXT, description TEXT, visibility TEXT, member_count BIGINT, created_by UUID, creator_name TEXT, created_at TIMESTAMPTZ, is_member BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT c.id, c.title::TEXT, s.description::TEXT, s.visibility::TEXT,
           (SELECT count(*) FROM public.chat_participants cp WHERE cp.conversation_id = c.id AND cp.left_at IS NULL)::BIGINT,
           s.created_by, p.full_name::TEXT, s.created_at,
           EXISTS (SELECT 1 FROM public.chat_participants mine WHERE mine.conversation_id = c.id AND mine.user_id = (SELECT auth.uid()) AND mine.left_at IS NULL)
    FROM public.chat_group_settings s
    JOIN public.chat_conversations c ON c.id = s.conversation_id AND c.conversation_type = 'group' AND c.status = 'active'
    JOIN public.profiles p ON p.id = s.created_by
    WHERE s.visibility = 'public'
      AND (btrim(COALESCE(p_query,'')) = '' OR c.title ILIKE '%' || btrim(p_query) || '%' OR s.description ILIKE '%' || btrim(p_query) || '%')
    ORDER BY s.created_at DESC LIMIT 50;
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
    IF NOT EXISTS (SELECT 1 FROM public.chat_group_settings s JOIN public.chat_conversations c ON c.id=s.conversation_id WHERE s.conversation_id=p_conversation_id AND s.visibility='public' AND c.status='active') THEN
        RAISE EXCEPTION 'public_group_not_found';
    END IF;
    INSERT INTO public.chat_participants (conversation_id,user_id,participant_role)
    VALUES (p_conversation_id,v_uid,'member') ON CONFLICT (conversation_id,user_id) DO UPDATE SET left_at=NULL;
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
    FROM public.chat_group_settings s JOIN public.chat_conversations c ON c.id=s.conversation_id
    WHERE upper(s.invite_code)=upper(btrim(COALESCE(p_invite_code,''))) AND s.visibility='private' AND c.status='active';
    IF v_conversation IS NULL THEN RAISE EXCEPTION 'invite_code_invalid'; END IF;
    INSERT INTO public.chat_participants (conversation_id,user_id,participant_role)
    VALUES (v_conversation,v_uid,'member') ON CONFLICT (conversation_id,user_id) DO UPDATE SET left_at=NULL;
    RETURN v_conversation;
END;
$function$;
REVOKE ALL ON FUNCTION public.join_smartnekam_private_chat_group(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_smartnekam_private_chat_group(TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Chat message reply, edit, soft-delete and reactions.
-- -----------------------------------------------------------------------------
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.smartnekam_validate_chat_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE v_parent_conversation UUID;
BEGIN
    IF NEW.reply_to_message_id IS NOT NULL THEN
        SELECT m.conversation_id INTO v_parent_conversation FROM public.chat_messages m WHERE m.id = NEW.reply_to_message_id;
        IF v_parent_conversation IS NULL OR v_parent_conversation <> NEW.conversation_id THEN
            RAISE EXCEPTION 'reply_target_must_be_in_same_conversation';
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS chat_messages_validate_reply ON public.chat_messages;
CREATE TRIGGER chat_messages_validate_reply BEFORE INSERT OR UPDATE OF reply_to_message_id, conversation_id ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.smartnekam_validate_chat_reply();

CREATE TABLE IF NOT EXISTS public.chat_message_reactions (
    message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
    reaction TEXT NOT NULL CHECK (reaction IN ('👍','❤️','😂','😮','😢','🙏','🔥')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (message_id, user_id, reaction)
);
CREATE INDEX IF NOT EXISTS chat_message_reactions_message_idx ON public.chat_message_reactions (message_id, created_at DESC);
ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_message_reactions_select_participant ON public.chat_message_reactions;
CREATE POLICY chat_message_reactions_select_participant ON public.chat_message_reactions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.id=message_id AND public.is_chat_conversation_participant(m.conversation_id)));
DROP POLICY IF EXISTS chat_message_reactions_insert_own_participant ON public.chat_message_reactions;
CREATE POLICY chat_message_reactions_insert_own_participant ON public.chat_message_reactions FOR INSERT TO authenticated
WITH CHECK (user_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.id=message_id AND m.deleted_at IS NULL AND public.is_chat_conversation_participant(m.conversation_id)));
DROP POLICY IF EXISTS chat_message_reactions_delete_own ON public.chat_message_reactions;
CREATE POLICY chat_message_reactions_delete_own ON public.chat_message_reactions FOR DELETE TO authenticated USING (user_id=(SELECT auth.uid()));
REVOKE ALL ON public.chat_message_reactions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.chat_message_reactions TO authenticated;

CREATE OR REPLACE FUNCTION public.edit_smartnekam_chat_message(p_message_id UUID, p_body TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_uid UUID := (SELECT auth.uid());
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
    IF length(btrim(COALESCE(p_body,''))) < 1 OR length(p_body) > 4000 THEN RAISE EXCEPTION 'message_body_invalid'; END IF;
    UPDATE public.chat_messages m SET body=btrim(p_body), edited_at=now()
    WHERE m.id=p_message_id AND m.sender_id=v_uid AND m.deleted_at IS NULL
      AND public.is_chat_conversation_participant(m.conversation_id);
    IF NOT FOUND THEN RAISE EXCEPTION 'message_not_editable'; END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.edit_smartnekam_chat_message(UUID,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_smartnekam_chat_message(UUID,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_smartnekam_chat_message(p_message_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_uid UUID := (SELECT auth.uid());
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
    UPDATE public.chat_messages m SET body='[Ujumbe umefutwa]', attachment_path=NULL, deleted_at=now(), edited_at=NULL
    WHERE m.id=p_message_id AND m.sender_id=v_uid AND m.deleted_at IS NULL
      AND public.is_chat_conversation_participant(m.conversation_id);
    IF NOT FOUND THEN RAISE EXCEPTION 'message_not_deletable'; END IF;
    DELETE FROM public.chat_message_reactions r WHERE r.message_id=p_message_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.delete_smartnekam_chat_message(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_smartnekam_chat_message(UUID) TO authenticated;

-- Inbox now includes both direct chats and group chats.
DROP FUNCTION IF EXISTS public.get_my_chat_inbox();
CREATE FUNCTION public.get_my_chat_inbox()
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
            public.can_start_smartnekam_direct_message(other_p.id) AS can_message,
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
          AND c.conversation_type = 'direct'
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

-- Add deletion marker to message results; callers only receive messages in their conversations.
DROP FUNCTION IF EXISTS public.get_smartnekam_chat_messages(UUID, INTEGER);
CREATE FUNCTION public.get_smartnekam_chat_messages(p_conversation_id UUID, p_limit INTEGER DEFAULT 80)
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
    created_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_uid UUID := (SELECT auth.uid());
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.chat_participants cp WHERE cp.conversation_id=p_conversation_id AND cp.user_id=v_uid AND cp.left_at IS NULL) THEN
        RAISE EXCEPTION 'conversation_not_available';
    END IF;
    RETURN QUERY
    SELECT m.id,m.conversation_id,m.sender_id,p.full_name::TEXT,p.username::TEXT,p.avatar_url::TEXT,
           m.body::TEXT,m.attachment_path::TEXT,m.message_type::TEXT,m.reply_to_message_id,m.edited_at,m.created_at,m.deleted_at
    FROM (SELECT cm.* FROM public.chat_messages cm WHERE cm.conversation_id=p_conversation_id ORDER BY cm.created_at DESC LIMIT LEAST(GREATEST(COALESCE(p_limit,80),1),100)) m
    JOIN public.profiles p ON p.id=m.sender_id
    ORDER BY m.created_at ASC;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_smartnekam_chat_messages(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_smartnekam_chat_messages(UUID, INTEGER) TO authenticated;

-- Include reactions in realtime where the Supabase publication is available.
DO $publication$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='chat_message_reactions') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reactions;
        END IF;
    END IF;
END;
$publication$;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Verify after running:
-- SELECT to_regprocedure('public.is_smartnekam_username_available(text,text)'),
--        to_regprocedure('public.create_smartnekam_chat_group(text,text,text)'),
--        to_regprocedure('public.discover_smartnekam_chat_groups(text)'),
--        to_regprocedure('public.join_smartnekam_public_chat_group(uuid)'),
--        to_regprocedure('public.join_smartnekam_private_chat_group(text)'),
--        to_regprocedure('public.edit_smartnekam_chat_message(uuid,text)'),
--        to_regprocedure('public.delete_smartnekam_chat_message(uuid)');

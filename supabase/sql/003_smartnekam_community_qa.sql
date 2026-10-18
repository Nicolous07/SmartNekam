-- SmartNekam | SQL 003: Community & Q&A
-- Prerequisites: SQL 001A (Foundation tables), SQL 001B (Auth triggers), and SQL 002 (Learning Library)
-- Run this ENTIRE script in Supabase Dashboard > SQL Editor > New query.
-- Re-runnable during development; it does not drop existing tables or user data.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Study groups
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.study_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    level VARCHAR(30),
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
    creator_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES public.profiles(id) ON DELETE CASCADE,
    privacy VARCHAR(20) NOT NULL DEFAULT 'public',
    invite_code VARCHAR(20) NOT NULL DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
    member_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT study_groups_name_not_blank CHECK (length(btrim(name)) > 0),
    CONSTRAINT study_groups_level_check CHECK (level IS NULL OR level IN ('O_LEVEL', 'A_LEVEL', 'UNIVERSITY')),
    CONSTRAINT study_groups_privacy_check CHECK (privacy IN ('public', 'private')),
    CONSTRAINT study_groups_status_check CHECK (status IN ('active', 'archived', 'removed')),
    CONSTRAINT study_groups_member_count_check CHECK (member_count >= 0),
    CONSTRAINT study_groups_invite_code_unique UNIQUE (invite_code)
);

CREATE INDEX IF NOT EXISTS study_groups_discover_idx
    ON public.study_groups (status, privacy, created_at DESC);
CREATE INDEX IF NOT EXISTS study_groups_subject_level_idx
    ON public.study_groups (subject_id, level);
CREATE INDEX IF NOT EXISTS study_groups_creator_idx
    ON public.study_groups (creator_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 2. Memberships
-- Membership changes go through join_study_group / leave_study_group RPCs.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_members (
    group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, user_id),
    CONSTRAINT group_members_role_check CHECK (role IN ('admin', 'moderator', 'member'))
);
CREATE INDEX IF NOT EXISTS group_members_user_idx
    ON public.group_members (user_id, joined_at DESC);

-- Add the group's creator as its first admin automatically.
CREATE OR REPLACE FUNCTION public.add_study_group_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (NEW.id, NEW.creator_id, 'admin')
    ON CONFLICT (group_id, user_id) DO NOTHING;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS study_groups_add_creator ON public.study_groups;
CREATE TRIGGER study_groups_add_creator
AFTER INSERT ON public.study_groups
FOR EACH ROW EXECUTE FUNCTION public.add_study_group_creator();

CREATE OR REPLACE FUNCTION public.adjust_study_group_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.study_groups
        SET member_count = member_count + 1
        WHERE id = NEW.group_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.study_groups
        SET member_count = GREATEST(member_count - 1, 0)
        WHERE id = OLD.group_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS group_members_adjust_count ON public.group_members;
CREATE TRIGGER group_members_adjust_count
AFTER INSERT OR DELETE ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.adjust_study_group_member_count();

-- Safe helper functions used by RLS. They expose only membership/permission booleans.
CREATE OR REPLACE FUNCTION public.is_study_group_member(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.group_members gm
        WHERE gm.group_id = p_group_id
          AND gm.user_id = (SELECT auth.uid())
    );
$function$;

CREATE OR REPLACE FUNCTION public.can_view_study_group(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.study_groups g
        WHERE g.id = p_group_id
          AND g.status <> 'removed'
          AND (
              g.privacy = 'public'
              OR EXISTS (
                  SELECT 1 FROM public.group_members gm
                  WHERE gm.group_id = g.id
                    AND gm.user_id = (SELECT auth.uid())
              )
          )
    );
$function$;

CREATE OR REPLACE FUNCTION public.can_manage_study_group(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.study_groups g
        WHERE g.id = p_group_id
          AND (
              g.creator_id = (SELECT auth.uid())
              OR EXISTS (
                  SELECT 1 FROM public.group_members gm
                  WHERE gm.group_id = g.id
                    AND gm.user_id = (SELECT auth.uid())
                    AND gm.role = 'admin'
              )
          )
    );
$function$;

CREATE OR REPLACE FUNCTION public.join_study_group(p_group_id UUID, p_invite_code TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_privacy TEXT;
    v_invite_code TEXT;
    v_status TEXT;
    v_uid UUID := (SELECT auth.uid());
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'You must be signed in to join a study group.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = v_uid AND p.status = 'active'
    ) THEN
        RAISE EXCEPTION 'An active SmartNekam profile is required.';
    END IF;

    SELECT g.privacy, g.invite_code, g.status
    INTO v_privacy, v_invite_code, v_status
    FROM public.study_groups g
    WHERE g.id = p_group_id;

    IF NOT FOUND OR v_status = 'removed' THEN
        RAISE EXCEPTION 'Study group not found.';
    END IF;
    IF v_status <> 'active' THEN
        RAISE EXCEPTION 'This study group is not accepting new members.';
    END IF;
    IF v_privacy = 'private'
       AND upper(btrim(COALESCE(p_invite_code, ''))) <> upper(v_invite_code) THEN
        RAISE EXCEPTION 'A valid invite code is required for this private group.';
    END IF;

    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (p_group_id, v_uid, 'member')
    ON CONFLICT (group_id, user_id) DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.leave_study_group(p_group_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'You must be signed in to leave a study group.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.study_groups g
        WHERE g.id = p_group_id AND g.creator_id = v_uid
    ) THEN
        RAISE EXCEPTION 'The group creator cannot leave the group. Archive it or transfer ownership first.';
    END IF;
    DELETE FROM public.group_members
    WHERE group_id = p_group_id AND user_id = v_uid;
END;
$function$;

-- -----------------------------------------------------------------------------
-- 3. Group posts and comments
-- attachment_paths store private Storage object paths, not public URLs.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
    author_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES public.profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL DEFAULT '',
    attachment_paths TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT group_posts_body_or_attachment_check
        CHECK (length(btrim(body)) > 0 OR cardinality(attachment_paths) > 0),
    CONSTRAINT group_posts_attachments_count_check CHECK (cardinality(attachment_paths) <= 10)
);
CREATE INDEX IF NOT EXISTS group_posts_feed_idx
    ON public.group_posts (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS group_posts_author_idx
    ON public.group_posts (author_id, created_at DESC);

-- Real-time study-group chat messages. Only group members can read or send messages.
CREATE TABLE IF NOT EXISTS public.study_group_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES public.profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL DEFAULT '',
    attachment_paths TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT study_group_messages_body_or_attachment_check
        CHECK (length(btrim(body)) > 0 OR cardinality(attachment_paths) > 0),
    CONSTRAINT study_group_messages_attachments_count_check CHECK (cardinality(attachment_paths) <= 5)
);
CREATE INDEX IF NOT EXISTS study_group_messages_feed_idx
    ON public.study_group_messages (group_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.group_post_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.group_posts(id) ON DELETE CASCADE,
    author_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES public.profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT group_post_comments_body_not_blank CHECK (length(btrim(body)) > 0)
);
CREATE INDEX IF NOT EXISTS group_post_comments_post_idx
    ON public.group_post_comments (post_id, created_at ASC);

-- Files shared inside a study group. The actual binary remains in private Storage.
CREATE TABLE IF NOT EXISTS public.study_group_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES public.profiles(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL UNIQUE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(10) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT study_group_files_name_not_blank CHECK (length(btrim(file_name)) > 0),
    CONSTRAINT study_group_files_type_check CHECK (lower(file_type) IN ('pdf', 'jpg', 'jpeg', 'png')),
    CONSTRAINT study_group_files_size_check CHECK (file_size_bytes > 0 AND file_size_bytes <= 26214400),
    CONSTRAINT study_group_files_path_matches_group CHECK (
        storage_path LIKE uploader_id::text || '/groups/' || group_id::text || '/%'
    )
);
CREATE INDEX IF NOT EXISTS study_group_files_group_idx
    ON public.study_group_files (group_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 4. Questions and answers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
    title VARCHAR(200),
    body TEXT NOT NULL,
    attachments TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    upvotes INTEGER NOT NULL DEFAULT 0,
    best_answer_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT questions_title_not_blank CHECK (title IS NULL OR length(btrim(title)) > 0),
    CONSTRAINT questions_body_not_blank CHECK (length(btrim(body)) > 0),
    CONSTRAINT questions_attachments_count_check CHECK (cardinality(attachments) <= 3),
    CONSTRAINT questions_upvotes_nonnegative CHECK (upvotes >= 0),
    CONSTRAINT questions_status_check CHECK (status IN ('open', 'resolved', 'closed', 'removed'))
);
CREATE INDEX IF NOT EXISTS questions_subject_feed_idx
    ON public.questions (subject_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS questions_user_feed_idx
    ON public.questions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.question_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES public.profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT question_comments_body_not_blank CHECK (length(btrim(body)) > 0)
);
CREATE INDEX IF NOT EXISTS question_comments_question_idx
    ON public.question_comments (question_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES public.profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    attachments TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    upvotes INTEGER NOT NULL DEFAULT 0,
    is_best_answer BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT answers_body_not_blank CHECK (length(btrim(body)) > 0),
    CONSTRAINT answers_attachments_count_check CHECK (cardinality(attachments) <= 3),
    CONSTRAINT answers_upvotes_nonnegative CHECK (upvotes >= 0)
);
CREATE INDEX IF NOT EXISTS answers_question_feed_idx
    ON public.answers (question_id, created_at ASC);
CREATE INDEX IF NOT EXISTS answers_user_feed_idx
    ON public.answers (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS answers_one_best_per_question_idx
    ON public.answers (question_id) WHERE is_best_answer = TRUE;

DO $block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'questions_best_answer_id_fkey'
          AND conrelid = 'public.questions'::regclass
    ) THEN
        ALTER TABLE public.questions
        ADD CONSTRAINT questions_best_answer_id_fkey
        FOREIGN KEY (best_answer_id) REFERENCES public.answers(id) ON DELETE SET NULL;
    END IF;
END;
$block$;

-- A question's owner can select the best answer. XP is handled in the later Gamification SQL.
CREATE OR REPLACE FUNCTION public.set_best_answer(p_question_id UUID, p_answer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_question_owner UUID;
    v_question_status TEXT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'You must be signed in to select a best answer.';
    END IF;

    SELECT q.user_id, q.status
    INTO v_question_owner, v_question_status
    FROM public.questions q
    WHERE q.id = p_question_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Question not found.';
    END IF;
    IF v_question_owner <> v_uid THEN
        RAISE EXCEPTION 'Only the question author can select the best answer.';
    END IF;
    IF v_question_status IN ('closed', 'removed') THEN
        RAISE EXCEPTION 'This question cannot accept a best answer.';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.answers a
        WHERE a.id = p_answer_id AND a.question_id = p_question_id
    ) THEN
        RAISE EXCEPTION 'The selected answer does not belong to this question.';
    END IF;

    UPDATE public.answers
    SET is_best_answer = FALSE
    WHERE question_id = p_question_id AND is_best_answer = TRUE;

    UPDATE public.answers
    SET is_best_answer = TRUE
    WHERE id = p_answer_id AND question_id = p_question_id;

    UPDATE public.questions
    SET best_answer_id = p_answer_id,
        status = 'resolved',
        updated_at = pg_catalog.now()
    WHERE id = p_question_id;
END;
$function$;

-- -----------------------------------------------------------------------------
-- 5. Question and answer votes. Unique keys prevent duplicate votes per user.
-- Vote totals are updated by triggers, never by client-submitted totals.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_votes (
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (question_id, user_id)
);
CREATE TABLE IF NOT EXISTS public.answer_votes (
    answer_id UUID NOT NULL REFERENCES public.answers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (answer_id, user_id)
);

CREATE OR REPLACE FUNCTION public.adjust_question_upvotes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.questions SET upvotes = upvotes + 1 WHERE id = NEW.question_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.questions SET upvotes = GREATEST(upvotes - 1, 0) WHERE id = OLD.question_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.adjust_answer_upvotes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.answers SET upvotes = upvotes + 1 WHERE id = NEW.answer_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.answers SET upvotes = GREATEST(upvotes - 1, 0) WHERE id = OLD.answer_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS question_votes_adjust_upvotes ON public.question_votes;
CREATE TRIGGER question_votes_adjust_upvotes
AFTER INSERT OR DELETE ON public.question_votes
FOR EACH ROW EXECUTE FUNCTION public.adjust_question_upvotes();
DROP TRIGGER IF EXISTS answer_votes_adjust_upvotes ON public.answer_votes;
CREATE TRIGGER answer_votes_adjust_upvotes
AFTER INSERT OR DELETE ON public.answer_votes
FOR EACH ROW EXECUTE FUNCTION public.adjust_answer_upvotes();

-- -----------------------------------------------------------------------------
-- 6. Private Storage for community files
-- Expected paths:
--   <auth-user-uuid>/groups/<group-uuid>/<filename>
--   <auth-user-uuid>/questions/<question-uuid>/<filename>
-- Question attachments: app validation must enforce up to 3 images OR 1 PDF.
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'community-attachments',
    'community-attachments',
    FALSE,
    26214400,
    ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS community_attachments_read_own_or_visible ON storage.objects;
CREATE POLICY community_attachments_read_own_or_visible
ON storage.objects FOR SELECT TO anon, authenticated
USING (
    bucket_id = 'community-attachments'
    AND (
        (
            (SELECT auth.uid()) IS NOT NULL
            AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
        )
        OR (
            (storage.foldername(name))[2] = 'groups'
            AND public.can_view_study_group(((storage.foldername(name))[3])::uuid)
        )
        OR (
            (storage.foldername(name))[2] = 'questions'
            AND EXISTS (
                SELECT 1 FROM public.questions q
                WHERE q.id = ((storage.foldername(name))[3])::uuid
                  AND (q.status <> 'removed' OR q.user_id = (SELECT auth.uid()))
            )
        )
        OR (
            (storage.foldername(name))[2] = 'answers'
            AND EXISTS (
                SELECT 1
                FROM public.answers a
                JOIN public.questions q ON q.id = a.question_id
                WHERE a.id = ((storage.foldername(name))[3])::uuid
                  AND (q.status <> 'removed' OR q.user_id = (SELECT auth.uid()) OR a.user_id = (SELECT auth.uid()))
            )
        )
    )
);

DROP POLICY IF EXISTS community_attachments_upload_own_group_or_question ON storage.objects;
CREATE POLICY community_attachments_upload_own_group_or_question
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'community-attachments'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (
        (
            (storage.foldername(name))[2] = 'groups'
            AND public.is_study_group_member(((storage.foldername(name))[3])::uuid)
        )
        OR (
            (storage.foldername(name))[2] = 'questions'
            AND EXISTS (
                SELECT 1 FROM public.questions q
                WHERE q.id = ((storage.foldername(name))[3])::uuid
                  AND q.user_id = (SELECT auth.uid())
                  AND q.status = 'open'
            )
        )
        OR (
            (storage.foldername(name))[2] = 'answers'
            AND EXISTS (
                SELECT 1
                FROM public.answers a
                JOIN public.questions q ON q.id = a.question_id
                WHERE a.id = ((storage.foldername(name))[3])::uuid
                  AND a.user_id = (SELECT auth.uid())
                  AND q.status = 'open'
            )
        )
    )
);

DROP POLICY IF EXISTS community_attachments_update_own ON storage.objects;
CREATE POLICY community_attachments_update_own
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'community-attachments'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
)
WITH CHECK (
    bucket_id = 'community-attachments'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (
        (
            (storage.foldername(name))[2] = 'groups'
            AND public.is_study_group_member(((storage.foldername(name))[3])::uuid)
        )
        OR (
            (storage.foldername(name))[2] = 'questions'
            AND EXISTS (
                SELECT 1 FROM public.questions q
                WHERE q.id = ((storage.foldername(name))[3])::uuid
                  AND q.user_id = (SELECT auth.uid())
                  AND q.status = 'open'
            )
        )
        OR (
            (storage.foldername(name))[2] = 'answers'
            AND EXISTS (
                SELECT 1
                FROM public.answers a
                JOIN public.questions q ON q.id = a.question_id
                WHERE a.id = ((storage.foldername(name))[3])::uuid
                  AND a.user_id = (SELECT auth.uid())
                  AND q.status = 'open'
            )
        )
    )
);

DROP POLICY IF EXISTS community_attachments_delete_own ON storage.objects;
CREATE POLICY community_attachments_delete_own
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'community-attachments'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

-- -----------------------------------------------------------------------------
-- 7. Updated-at triggers
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS study_groups_set_updated_at ON public.study_groups;
CREATE TRIGGER study_groups_set_updated_at
BEFORE UPDATE ON public.study_groups
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS group_posts_set_updated_at ON public.group_posts;
CREATE TRIGGER group_posts_set_updated_at
BEFORE UPDATE ON public.group_posts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS group_post_comments_set_updated_at ON public.group_post_comments;
CREATE TRIGGER group_post_comments_set_updated_at
BEFORE UPDATE ON public.group_post_comments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS questions_set_updated_at ON public.questions;
CREATE TRIGGER questions_set_updated_at
BEFORE UPDATE ON public.questions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS question_comments_set_updated_at ON public.question_comments;
CREATE TRIGGER question_comments_set_updated_at
BEFORE UPDATE ON public.question_comments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 8. RLS policies
-- -----------------------------------------------------------------------------
ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_votes ENABLE ROW LEVEL SECURITY;

-- Study groups: public groups can be discovered; private groups are visible to members.
DROP POLICY IF EXISTS study_groups_select_visible ON public.study_groups;
CREATE POLICY study_groups_select_visible
ON public.study_groups FOR SELECT TO anon, authenticated
USING (
    status <> 'removed'
    AND (privacy = 'public' OR public.is_study_group_member(id) OR creator_id = (SELECT auth.uid()))
);
DROP POLICY IF EXISTS study_groups_insert_own ON public.study_groups;
CREATE POLICY study_groups_insert_own
ON public.study_groups FOR INSERT TO authenticated
WITH CHECK (creator_id = (SELECT auth.uid()) AND member_count = 0 AND status = 'active');
DROP POLICY IF EXISTS study_groups_update_admin ON public.study_groups;
CREATE POLICY study_groups_update_admin
ON public.study_groups FOR UPDATE TO authenticated
USING (public.can_manage_study_group(id))
WITH CHECK (public.can_manage_study_group(id));
DROP POLICY IF EXISTS study_groups_delete_admin ON public.study_groups;
CREATE POLICY study_groups_delete_admin
ON public.study_groups FOR DELETE TO authenticated
USING (public.can_manage_study_group(id));

DROP POLICY IF EXISTS group_members_select_visible ON public.group_members;
CREATE POLICY group_members_select_visible
ON public.group_members FOR SELECT TO anon, authenticated
USING (user_id = (SELECT auth.uid()) OR public.can_view_study_group(group_id));

DROP POLICY IF EXISTS group_posts_select_visible ON public.group_posts;
CREATE POLICY group_posts_select_visible
ON public.group_posts FOR SELECT TO anon, authenticated
USING (public.can_view_study_group(group_id));
DROP POLICY IF EXISTS group_posts_insert_member ON public.group_posts;
CREATE POLICY group_posts_insert_member
ON public.group_posts FOR INSERT TO authenticated
WITH CHECK (author_id = (SELECT auth.uid()) AND public.is_study_group_member(group_id));
DROP POLICY IF EXISTS group_posts_update_author_or_admin ON public.group_posts;
CREATE POLICY group_posts_update_author_or_admin
ON public.group_posts FOR UPDATE TO authenticated
USING (author_id = (SELECT auth.uid()) OR public.can_manage_study_group(group_id))
WITH CHECK (author_id = (SELECT auth.uid()) OR public.can_manage_study_group(group_id));
DROP POLICY IF EXISTS group_posts_delete_author_or_admin ON public.group_posts;
CREATE POLICY group_posts_delete_author_or_admin
ON public.group_posts FOR DELETE TO authenticated
USING (author_id = (SELECT auth.uid()) OR public.can_manage_study_group(group_id));

DROP POLICY IF EXISTS study_group_messages_select_members ON public.study_group_messages;
CREATE POLICY study_group_messages_select_members
ON public.study_group_messages FOR SELECT TO authenticated
USING (public.is_study_group_member(group_id));
DROP POLICY IF EXISTS study_group_messages_insert_members ON public.study_group_messages;
CREATE POLICY study_group_messages_insert_members
ON public.study_group_messages FOR INSERT TO authenticated
WITH CHECK (sender_id = (SELECT auth.uid()) AND public.is_study_group_member(group_id));
DROP POLICY IF EXISTS study_group_messages_delete_sender_or_admin ON public.study_group_messages;
CREATE POLICY study_group_messages_delete_sender_or_admin
ON public.study_group_messages FOR DELETE TO authenticated
USING (sender_id = (SELECT auth.uid()) OR public.can_manage_study_group(group_id));

DROP POLICY IF EXISTS group_post_comments_select_visible ON public.group_post_comments;
CREATE POLICY group_post_comments_select_visible
ON public.group_post_comments FOR SELECT TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.group_posts p
        WHERE p.id = post_id AND public.can_view_study_group(p.group_id)
    )
);
DROP POLICY IF EXISTS group_post_comments_insert_member ON public.group_post_comments;
CREATE POLICY group_post_comments_insert_member
ON public.group_post_comments FOR INSERT TO authenticated
WITH CHECK (
    author_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.group_posts p
        WHERE p.id = post_id AND public.is_study_group_member(p.group_id)
    )
);
DROP POLICY IF EXISTS group_post_comments_update_author_or_admin ON public.group_post_comments;
CREATE POLICY group_post_comments_update_author_or_admin
ON public.group_post_comments FOR UPDATE TO authenticated
USING (
    author_id = (SELECT auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.group_posts p
        WHERE p.id = post_id AND public.can_manage_study_group(p.group_id)
    )
)
WITH CHECK (
    author_id = (SELECT auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.group_posts p
        WHERE p.id = post_id AND public.can_manage_study_group(p.group_id)
    )
);
DROP POLICY IF EXISTS group_post_comments_delete_author_or_admin ON public.group_post_comments;
CREATE POLICY group_post_comments_delete_author_or_admin
ON public.group_post_comments FOR DELETE TO authenticated
USING (
    author_id = (SELECT auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.group_posts p
        WHERE p.id = post_id AND public.can_manage_study_group(p.group_id)
    )
);

DROP POLICY IF EXISTS study_group_files_select_visible ON public.study_group_files;
CREATE POLICY study_group_files_select_visible
ON public.study_group_files FOR SELECT TO anon, authenticated
USING (public.can_view_study_group(group_id));
DROP POLICY IF EXISTS study_group_files_insert_member ON public.study_group_files;
CREATE POLICY study_group_files_insert_member
ON public.study_group_files FOR INSERT TO authenticated
WITH CHECK (
    uploader_id = (SELECT auth.uid())
    AND public.is_study_group_member(group_id)
    AND storage_path LIKE (SELECT auth.uid())::text || '/groups/' || group_id::text || '/%'
);
DROP POLICY IF EXISTS study_group_files_delete_uploader_or_admin ON public.study_group_files;
CREATE POLICY study_group_files_delete_uploader_or_admin
ON public.study_group_files FOR DELETE TO authenticated
USING (uploader_id = (SELECT auth.uid()) OR public.can_manage_study_group(group_id));

-- Q&A questions are publicly readable unless removed; writing requires authentication.
DROP POLICY IF EXISTS questions_select_public_or_own ON public.questions;
CREATE POLICY questions_select_public_or_own
ON public.questions FOR SELECT TO anon, authenticated
USING (status <> 'removed' OR user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS questions_insert_own ON public.questions;
CREATE POLICY questions_insert_own
ON public.questions FOR INSERT TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND status = 'open'
    AND upvotes = 0
    AND best_answer_id IS NULL
);
DROP POLICY IF EXISTS questions_update_own ON public.questions;
CREATE POLICY questions_update_own
ON public.questions FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()) AND status <> 'removed')
WITH CHECK (user_id = (SELECT auth.uid()) AND status <> 'removed');
DROP POLICY IF EXISTS questions_delete_own_open ON public.questions;
CREATE POLICY questions_delete_own_open
ON public.questions FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()) AND status = 'open');

DROP POLICY IF EXISTS question_comments_select_visible ON public.question_comments;
CREATE POLICY question_comments_select_visible
ON public.question_comments FOR SELECT TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.questions q
        WHERE q.id = question_id
          AND (q.status <> 'removed' OR q.user_id = (SELECT auth.uid()))
    )
);
DROP POLICY IF EXISTS question_comments_insert_own ON public.question_comments;
CREATE POLICY question_comments_insert_own
ON public.question_comments FOR INSERT TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.questions q WHERE q.id = question_id AND q.status = 'open')
);
DROP POLICY IF EXISTS question_comments_update_own ON public.question_comments;
CREATE POLICY question_comments_update_own
ON public.question_comments FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS question_comments_delete_own ON public.question_comments;
CREATE POLICY question_comments_delete_own
ON public.question_comments FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS answers_select_visible_question ON public.answers;
CREATE POLICY answers_select_visible_question
ON public.answers FOR SELECT TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.questions q
        WHERE q.id = question_id
          AND (q.status <> 'removed' OR q.user_id = (SELECT auth.uid()))
    )
);
DROP POLICY IF EXISTS answers_insert_own_open_question ON public.answers;
CREATE POLICY answers_insert_own_open_question
ON public.answers FOR INSERT TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND is_best_answer = FALSE
    AND upvotes = 0
    AND EXISTS (
        SELECT 1 FROM public.questions q
        WHERE q.id = question_id AND q.status = 'open'
    )
);
DROP POLICY IF EXISTS answers_update_own_nonbest ON public.answers;
CREATE POLICY answers_update_own_nonbest
ON public.answers FOR UPDATE TO authenticated
USING (
    user_id = (SELECT auth.uid())
    AND is_best_answer = FALSE
    AND EXISTS (SELECT 1 FROM public.questions q WHERE q.id = question_id AND q.status = 'open')
)
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND is_best_answer = FALSE
    AND EXISTS (SELECT 1 FROM public.questions q WHERE q.id = question_id AND q.status = 'open')
);
DROP POLICY IF EXISTS answers_delete_own_nonbest ON public.answers;
CREATE POLICY answers_delete_own_nonbest
ON public.answers FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()) AND is_best_answer = FALSE);

DROP POLICY IF EXISTS question_votes_select_own ON public.question_votes;
CREATE POLICY question_votes_select_own
ON public.question_votes FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS question_votes_insert_own ON public.question_votes;
CREATE POLICY question_votes_insert_own
ON public.question_votes FOR INSERT TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.questions q WHERE q.id = question_id AND q.status <> 'removed')
);
DROP POLICY IF EXISTS question_votes_delete_own ON public.question_votes;
CREATE POLICY question_votes_delete_own
ON public.question_votes FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS answer_votes_select_own ON public.answer_votes;
CREATE POLICY answer_votes_select_own
ON public.answer_votes FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS answer_votes_insert_own ON public.answer_votes;
CREATE POLICY answer_votes_insert_own
ON public.answer_votes FOR INSERT TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.answers a
        JOIN public.questions q ON q.id = a.question_id
        WHERE a.id = answer_id AND q.status <> 'removed'
    )
);
DROP POLICY IF EXISTS answer_votes_delete_own ON public.answer_votes;
CREATE POLICY answer_votes_delete_own
ON public.answer_votes FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

-- -----------------------------------------------------------------------------
-- 9. Public, limited profile fields for community cards; excludes phone and email.
-- The underlying profile table remains private under its existing RLS policies.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.community_profiles AS
SELECT
    id,
    full_name,
    role,
    level,
    form_or_year,
    school_id,
    university_id,
    combination,
    course,
    region,
    xp,
    streak,
    created_at
FROM public.profiles
WHERE status = 'active';
GRANT SELECT ON public.community_profiles TO anon, authenticated;

-- Add group messages to Supabase Realtime when the default publication exists.
DO $block$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
       AND NOT EXISTS (
           SELECT 1 FROM pg_publication_tables
           WHERE pubname = 'supabase_realtime'
             AND schemaname = 'public'
             AND tablename = 'study_group_messages'
       ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.study_group_messages;
    END IF;
END;
$block$;

-- -----------------------------------------------------------------------------
-- 10. Least-privilege grants
-- -----------------------------------------------------------------------------
REVOKE ALL PRIVILEGES ON TABLE
    public.study_groups,
    public.group_members,
    public.group_posts,
    public.study_group_messages,
    public.group_post_comments,
    public.study_group_files,
    public.questions,
    public.question_comments,
    public.answers,
    public.question_votes,
    public.answer_votes
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.study_groups, public.group_members,
    public.group_posts, public.group_post_comments, public.study_group_files,
    public.questions, public.question_comments, public.answers
TO anon, authenticated;
GRANT SELECT ON TABLE public.study_group_messages TO authenticated;

GRANT INSERT (name, description, level, subject_id, school_id, privacy)
    ON TABLE public.study_groups TO authenticated;
GRANT UPDATE (name, description, level, subject_id, school_id, privacy, status)
    ON TABLE public.study_groups TO authenticated;
GRANT DELETE ON TABLE public.study_groups TO authenticated;

GRANT INSERT (group_id, author_id, body, attachment_paths)
    ON TABLE public.group_posts TO authenticated;
GRANT UPDATE (body, attachment_paths)
    ON TABLE public.group_posts TO authenticated;
GRANT DELETE ON TABLE public.group_posts TO authenticated;

GRANT INSERT (group_id, sender_id, body, attachment_paths)
    ON TABLE public.study_group_messages TO authenticated;
GRANT DELETE ON TABLE public.study_group_messages TO authenticated;

GRANT INSERT (post_id, author_id, body)
    ON TABLE public.group_post_comments TO authenticated;
GRANT UPDATE (body) ON TABLE public.group_post_comments TO authenticated;
GRANT DELETE ON TABLE public.group_post_comments TO authenticated;

GRANT INSERT (group_id, uploader_id, storage_path, file_name, file_type, file_size_bytes)
    ON TABLE public.study_group_files TO authenticated;
GRANT DELETE ON TABLE public.study_group_files TO authenticated;

GRANT INSERT (user_id, subject_id, title, body, attachments)
    ON TABLE public.questions TO authenticated;
GRANT UPDATE (subject_id, title, body, attachments)
    ON TABLE public.questions TO authenticated;
GRANT DELETE ON TABLE public.questions TO authenticated;

GRANT INSERT (question_id, user_id, body) ON TABLE public.question_comments TO authenticated;
GRANT UPDATE (body) ON TABLE public.question_comments TO authenticated;
GRANT DELETE ON TABLE public.question_comments TO authenticated;

GRANT INSERT (question_id, user_id, body, attachments)
    ON TABLE public.answers TO authenticated;
GRANT UPDATE (body, attachments) ON TABLE public.answers TO authenticated;
GRANT DELETE ON TABLE public.answers TO authenticated;

GRANT SELECT, INSERT, DELETE ON TABLE public.question_votes, public.answer_votes TO authenticated;

REVOKE ALL PRIVILEGES ON FUNCTION public.add_study_group_creator() FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.adjust_study_group_member_count() FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.adjust_question_upvotes() FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.adjust_answer_upvotes() FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.join_study_group(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON FUNCTION public.leave_study_group(UUID) FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON FUNCTION public.set_best_answer(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON FUNCTION public.is_study_group_member(UUID) FROM PUBLIC;
REVOKE ALL PRIVILEGES ON FUNCTION public.can_view_study_group(UUID) FROM PUBLIC;
REVOKE ALL PRIVILEGES ON FUNCTION public.can_manage_study_group(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.join_study_group(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_study_group(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_best_answer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_study_group_member(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_study_group(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_study_group(UUID) TO authenticated;

COMMIT;

-- Expected result: Success. No rows returned.
-- Verify tables after this script:
-- SELECT to_regclass('public.study_groups'), to_regclass('public.group_members'),
--        to_regclass('public.group_posts'), to_regclass('public.study_group_messages'),
--        to_regclass('public.group_post_comments'),
--        to_regclass('public.study_group_files'), to_regclass('public.questions'),
--        to_regclass('public.question_comments'), to_regclass('public.answers'),
--        to_regclass('public.question_votes'), to_regclass('public.answer_votes');

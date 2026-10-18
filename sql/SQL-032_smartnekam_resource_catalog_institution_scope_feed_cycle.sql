-- SmartNekam SQL-032: Textbooks + subject catalog + institutional communities + feed discovery
-- Prerequisites: SQL 001A/001B, 002, 003, 007, 013, 016/018, and 028.
-- Backup first. This migration adds columns/tables/policies, preserves resource/group/post content, and removes stale membership links that no longer match institutional scope.

BEGIN;

-- 1) Allow custom subject names when a contributor selects "Others".
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS custom_subject TEXT;
ALTER TABLE public.past_papers ADD COLUMN IF NOT EXISTS custom_subject TEXT;
GRANT UPDATE (custom_subject) ON public.notes TO authenticated;
GRANT UPDATE (custom_subject) ON public.past_papers TO authenticated;

-- Keep notes and past-paper uploads limited to active profiles after adding the custom subject field.
DROP POLICY IF EXISTS notes_insert_own_pending ON public.notes;
CREATE POLICY notes_insert_own_pending ON public.notes FOR INSERT TO authenticated WITH CHECK (
  uploader_id=(SELECT auth.uid()) AND status='pending' AND downloads=0 AND reviewed_at IS NULL AND reviewed_by IS NULL AND rejection_reason IS NULL
  AND split_part(storage_path, '/', 1)=(SELECT auth.uid())::text
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.status='active')
  AND EXISTS (SELECT 1 FROM public.subjects s WHERE s.id=public.notes.subject_id AND s.level=public.notes.level
    AND ((lower(s.name) IN ('others','other','masomo mengine') AND length(btrim(COALESCE(public.notes.custom_subject,''))) > 0)
      OR (lower(s.name) NOT IN ('others','other','masomo mengine') AND public.notes.custom_subject IS NULL)))
);
DROP POLICY IF EXISTS notes_update_own_pending ON public.notes;
CREATE POLICY notes_update_own_pending ON public.notes FOR UPDATE TO authenticated
USING (uploader_id=(SELECT auth.uid()) AND status='pending')
WITH CHECK (uploader_id=(SELECT auth.uid()) AND status='pending' AND split_part(storage_path, '/', 1)=(SELECT auth.uid())::text
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.status='active')
  AND EXISTS (SELECT 1 FROM public.subjects s WHERE s.id=public.notes.subject_id AND s.level=public.notes.level
    AND ((lower(s.name) IN ('others','other','masomo mengine') AND length(btrim(COALESCE(public.notes.custom_subject,''))) > 0)
      OR (lower(s.name) NOT IN ('others','other','masomo mengine') AND public.notes.custom_subject IS NULL))));
DROP POLICY IF EXISTS past_papers_insert_own_pending ON public.past_papers;
CREATE POLICY past_papers_insert_own_pending ON public.past_papers FOR INSERT TO authenticated WITH CHECK (
  uploader_id=(SELECT auth.uid()) AND status='pending' AND downloads=0 AND reviewed_at IS NULL AND reviewed_by IS NULL AND rejection_reason IS NULL
  AND split_part(storage_path, '/', 1)=(SELECT auth.uid())::text
  AND (marking_scheme_path IS NULL OR split_part(marking_scheme_path, '/', 1)=(SELECT auth.uid())::text)
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.status='active')
  AND EXISTS (SELECT 1 FROM public.subjects s WHERE s.id=public.past_papers.subject_id AND s.level=public.past_papers.level
    AND ((lower(s.name) IN ('others','other','masomo mengine') AND length(btrim(COALESCE(public.past_papers.custom_subject,''))) > 0)
      OR (lower(s.name) NOT IN ('others','other','masomo mengine') AND public.past_papers.custom_subject IS NULL)))
);
DROP POLICY IF EXISTS past_papers_update_own_pending ON public.past_papers;
CREATE POLICY past_papers_update_own_pending ON public.past_papers FOR UPDATE TO authenticated
USING (uploader_id=(SELECT auth.uid()) AND status='pending')
WITH CHECK (uploader_id=(SELECT auth.uid()) AND status='pending' AND split_part(storage_path, '/', 1)=(SELECT auth.uid())::text
  AND (marking_scheme_path IS NULL OR split_part(marking_scheme_path, '/', 1)=(SELECT auth.uid())::text)
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.status='active')
  AND EXISTS (SELECT 1 FROM public.subjects s WHERE s.id=public.past_papers.subject_id AND s.level=public.past_papers.level
    AND ((lower(s.name) IN ('others','other','masomo mengine') AND length(btrim(COALESCE(public.past_papers.custom_subject,''))) > 0)
      OR (lower(s.name) NOT IN ('others','other','masomo mengine') AND public.past_papers.custom_subject IS NULL))));

-- 2) Book/textbook library. Files remain in the private learning-resources bucket.
CREATE TABLE IF NOT EXISTS public.textbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uploader_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
    custom_subject TEXT,
    level VARCHAR(30) NOT NULL CHECK (level IN ('O_LEVEL','A_LEVEL','UNIVERSITY')),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    author VARCHAR(180),
    publisher VARCHAR(180),
    publication_year INTEGER,
    storage_path TEXT NOT NULL UNIQUE,
    file_type VARCHAR(10) NOT NULL CHECK (lower(file_type) IN ('pdf','epub','docx','pptx','jpg','jpeg','png')),
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 26214400),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','removed')),
    downloads BIGINT NOT NULL DEFAULT 0 CHECK (downloads >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    CONSTRAINT textbooks_title_not_blank CHECK (length(btrim(title)) > 0),
    CONSTRAINT textbooks_publication_year_check CHECK (publication_year IS NULL OR publication_year BETWEEN 1450 AND 2200)
);
CREATE INDEX IF NOT EXISTS textbooks_subject_level_idx ON public.textbooks(subject_id, level);
CREATE INDEX IF NOT EXISTS textbooks_status_created_idx ON public.textbooks(status, created_at DESC);
CREATE INDEX IF NOT EXISTS textbooks_uploader_created_idx ON public.textbooks(uploader_id, created_at DESC);
ALTER TABLE public.textbooks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS textbooks_read_approved_or_own ON public.textbooks;
CREATE POLICY textbooks_read_approved_or_own ON public.textbooks FOR SELECT TO anon, authenticated
USING (status = 'approved' OR uploader_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS textbooks_moderator_read_all ON public.textbooks;
CREATE POLICY textbooks_moderator_read_all ON public.textbooks FOR SELECT TO authenticated
USING (public.is_smartnekam_moderator());
DROP POLICY IF EXISTS textbooks_insert_own_pending ON public.textbooks;
CREATE POLICY textbooks_insert_own_pending ON public.textbooks FOR INSERT TO authenticated
WITH CHECK (uploader_id = (SELECT auth.uid()) AND status = 'pending' AND downloads = 0 AND reviewed_at IS NULL AND reviewed_by IS NULL AND rejection_reason IS NULL AND split_part(storage_path, '/', 1)=(SELECT auth.uid())::text AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.status='active') AND EXISTS (SELECT 1 FROM public.subjects s WHERE s.id=public.textbooks.subject_id AND s.level=public.textbooks.level AND ((lower(s.name) IN ('others','other','masomo mengine') AND length(btrim(COALESCE(public.textbooks.custom_subject,''))) > 0) OR (lower(s.name) NOT IN ('others','other','masomo mengine') AND public.textbooks.custom_subject IS NULL))));
DROP POLICY IF EXISTS textbooks_update_own_pending ON public.textbooks;
CREATE POLICY textbooks_update_own_pending ON public.textbooks FOR UPDATE TO authenticated
USING (uploader_id = (SELECT auth.uid()) AND status = 'pending')
WITH CHECK (uploader_id = (SELECT auth.uid()) AND status = 'pending' AND split_part(storage_path, '/', 1)=(SELECT auth.uid())::text AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.status='active') AND EXISTS (SELECT 1 FROM public.subjects s WHERE s.id=public.textbooks.subject_id AND s.level=public.textbooks.level AND ((lower(s.name) IN ('others','other','masomo mengine') AND length(btrim(COALESCE(public.textbooks.custom_subject,''))) > 0) OR (lower(s.name) NOT IN ('others','other','masomo mengine') AND public.textbooks.custom_subject IS NULL))));
DROP POLICY IF EXISTS textbooks_delete_own_pending ON public.textbooks;
CREATE POLICY textbooks_delete_own_pending ON public.textbooks FOR DELETE TO authenticated
USING (uploader_id = (SELECT auth.uid()) AND status = 'pending' AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.status='active'));
GRANT SELECT ON public.textbooks TO anon, authenticated;
GRANT INSERT, DELETE ON public.textbooks TO authenticated;
GRANT UPDATE (subject_id, custom_subject, level, title, description, author, publisher, publication_year, storage_path, file_type, file_size_bytes)
ON public.textbooks TO authenticated;

CREATE TABLE IF NOT EXISTS public.textbook_downloads (
    textbook_id UUID NOT NULL REFERENCES public.textbooks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
    downloaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (textbook_id, user_id)
);
ALTER TABLE public.textbook_downloads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS textbook_downloads_select_own ON public.textbook_downloads;
CREATE POLICY textbook_downloads_select_own ON public.textbook_downloads FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS textbook_downloads_insert_approved ON public.textbook_downloads;
CREATE POLICY textbook_downloads_insert_approved ON public.textbook_downloads FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.status='active') AND EXISTS (SELECT 1 FROM public.textbooks t WHERE t.id = textbook_id AND t.status = 'approved'));
GRANT SELECT, INSERT ON public.textbook_downloads TO authenticated;
CREATE OR REPLACE FUNCTION public.smartnekam_count_textbook_download()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  UPDATE public.textbooks SET downloads = downloads + 1 WHERE id = NEW.textbook_id;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS textbook_downloads_count ON public.textbook_downloads;
CREATE TRIGGER textbook_downloads_count AFTER INSERT ON public.textbook_downloads
FOR EACH ROW EXECUTE FUNCTION public.smartnekam_count_textbook_download();

-- Expand private Storage bucket file support for EPUB books. Keep max size at 25 MiB.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'application/epub+zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg','image/png'
]::text[],
    file_size_limit = 26214400
WHERE id = 'learning-resources';

DROP POLICY IF EXISTS learning_resources_read_own_or_approved ON storage.objects;
CREATE POLICY learning_resources_read_own_or_approved ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'learning-resources' AND (
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
    OR EXISTS (SELECT 1 FROM public.notes n WHERE n.storage_path = name AND n.status = 'approved')
    OR EXISTS (SELECT 1 FROM public.past_papers p WHERE (p.storage_path = name OR p.marking_scheme_path = name) AND p.status = 'approved')
    OR EXISTS (SELECT 1 FROM public.textbooks t WHERE t.storage_path = name AND t.status = 'approved')
  )
);

-- 3) Seed a broad subject catalogue; safe to run repeatedly.
WITH seed(name, level, category) AS (VALUES
('Mathematics','O_LEVEL','STEM'),('Biology','O_LEVEL','STEM'),('Chemistry','O_LEVEL','STEM'),('Physics','O_LEVEL','STEM'),
('English Language','O_LEVEL','Languages'),('Kiswahili','O_LEVEL','Languages'),('Geography','O_LEVEL','Humanities'),('History','O_LEVEL','Humanities'),
('Civics','O_LEVEL','Humanities'),('Commerce','O_LEVEL','Business'),('Book Keeping','O_LEVEL','Business'),('Computer Studies','O_LEVEL','Technology'),
('Agriculture','O_LEVEL','Applied'),('French','O_LEVEL','Languages'),('Arabic','O_LEVEL','Languages'),('Literature in English','O_LEVEL','Languages'),
('Bible Knowledge','O_LEVEL','Humanities'),('Islamic Knowledge','O_LEVEL','Humanities'),('Home Economics','O_LEVEL','Applied'),('Fine Art','O_LEVEL','Arts'),
('Technical Drawing','O_LEVEL','Applied'),('Physical Education','O_LEVEL','Applied'),('Entrepreneurship','O_LEVEL','Business'),('Others','O_LEVEL','Other'),
('Advanced Mathematics','A_LEVEL','STEM'),('General Studies','A_LEVEL','Humanities'),('Physics','A_LEVEL','STEM'),('Chemistry','A_LEVEL','STEM'),('Biology','A_LEVEL','STEM'),
('Geography','A_LEVEL','Humanities'),('History','A_LEVEL','Humanities'),('Economics','A_LEVEL','Business'),('English Language','A_LEVEL','Languages'),
('Kiswahili','A_LEVEL','Languages'),('Computer Science','A_LEVEL','Technology'),('Agriculture','A_LEVEL','Applied'),('Literature in English','A_LEVEL','Languages'),
('Divinity','A_LEVEL','Humanities'),('Islamic Studies','A_LEVEL','Humanities'),('Fine Art','A_LEVEL','Arts'),('Commerce','A_LEVEL','Business'),('Accountancy','A_LEVEL','Business'),('Others','A_LEVEL','Other'),
('Computer Science','UNIVERSITY','Technology'),('Information Technology','UNIVERSITY','Technology'),('Software Engineering','UNIVERSITY','Technology'),
('Artificial Intelligence','UNIVERSITY','Technology'),('Data Science','UNIVERSITY','Technology'),('Cybersecurity','UNIVERSITY','Technology'),('Mathematics','UNIVERSITY','STEM'),
('Statistics','UNIVERSITY','STEM'),('Physics','UNIVERSITY','STEM'),('Chemistry','UNIVERSITY','STEM'),('Biology','UNIVERSITY','STEM'),
('Medicine','UNIVERSITY','Health'),('Nursing','UNIVERSITY','Health'),('Pharmacy','UNIVERSITY','Health'),('Public Health','UNIVERSITY','Health'),('Dentistry','UNIVERSITY','Health'),
('Law','UNIVERSITY','Law'),('Economics','UNIVERSITY','Business'),('Finance','UNIVERSITY','Business'),('Accounting','UNIVERSITY','Business'),('Business Administration','UNIVERSITY','Business'),
('Education','UNIVERSITY','Education'),('Civil Engineering','UNIVERSITY','Engineering'),('Electrical Engineering','UNIVERSITY','Engineering'),('Mechanical Engineering','UNIVERSITY','Engineering'),
('Chemical Engineering','UNIVERSITY','Engineering'),('Agricultural Engineering','UNIVERSITY','Engineering'),('Agriculture','UNIVERSITY','Applied'),('Veterinary Medicine','UNIVERSITY','Health'),
('Environmental Science','UNIVERSITY','Environment'),('Architecture','UNIVERSITY','Built Environment'),('Procurement and Logistics','UNIVERSITY','Business'),
('Tourism and Hospitality','UNIVERSITY','Business'),('Social Work','UNIVERSITY','Social Science'),('Political Science','UNIVERSITY','Social Science'),('Psychology','UNIVERSITY','Social Science'),
('Journalism and Mass Communication','UNIVERSITY','Communication'),('Library and Information Science','UNIVERSITY','Information'),('Others','UNIVERSITY','Other')
)
INSERT INTO public.subjects(name, level, category)
SELECT s.name, s.level, s.category FROM seed s
WHERE NOT EXISTS (SELECT 1 FROM public.subjects x WHERE lower(x.name)=lower(s.name) AND x.level=s.level);

-- 4) Separate school/university-specific groups and questions from global Q&A.
ALTER TABLE public.study_groups ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES public.universities(id) ON DELETE SET NULL;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES public.universities(id) ON DELETE SET NULL;
DO $block$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='study_groups_one_institution_scope' AND conrelid='public.study_groups'::regclass) THEN
    ALTER TABLE public.study_groups ADD CONSTRAINT study_groups_one_institution_scope CHECK (school_id IS NULL OR university_id IS NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='questions_one_institution_scope' AND conrelid='public.questions'::regclass) THEN
    ALTER TABLE public.questions ADD CONSTRAINT questions_one_institution_scope CHECK (school_id IS NULL OR university_id IS NULL);
  END IF;
END;
$block$;
CREATE INDEX IF NOT EXISTS study_groups_school_scope_idx ON public.study_groups(school_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS study_groups_university_scope_idx ON public.study_groups(university_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS questions_school_scope_idx ON public.questions(school_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS questions_university_scope_idx ON public.questions(university_id, status, created_at DESC);

-- A normal user cannot convert institution-only content into globally visible content by editing its scope.
CREATE OR REPLACE FUNCTION public.prevent_smartnekam_scope_reassignment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  IF (NEW.school_id IS DISTINCT FROM OLD.school_id OR NEW.university_id IS DISTINCT FROM OLD.university_id)
     AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='super_admin' AND p.status='active') THEN
    RAISE EXCEPTION 'Institution scope cannot be changed by this account.';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.prevent_smartnekam_scope_reassignment() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS study_groups_keep_scope ON public.study_groups;
CREATE TRIGGER study_groups_keep_scope BEFORE UPDATE OF school_id, university_id ON public.study_groups
FOR EACH ROW EXECUTE FUNCTION public.prevent_smartnekam_scope_reassignment();
DROP TRIGGER IF EXISTS questions_keep_scope ON public.questions;
CREATE TRIGGER questions_keep_scope BEFORE UPDATE OF school_id, university_id ON public.questions
FOR EACH ROW EXECUTE FUNCTION public.prevent_smartnekam_scope_reassignment();

CREATE OR REPLACE FUNCTION public.can_view_study_group(p_group_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.study_groups g
    WHERE g.id=p_group_id AND g.status <> 'removed'
      AND (
        (g.school_id IS NULL AND g.university_id IS NULL)
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.status='active'
          AND ((g.school_id IS NOT NULL AND p.school_id=g.school_id) OR (g.university_id IS NOT NULL AND p.university_id=g.university_id)))
      )
      AND (g.privacy='public' OR EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id=g.id AND gm.user_id=(SELECT auth.uid())) OR g.creator_id=(SELECT auth.uid()))
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_manage_study_group(p_group_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.study_groups g
    JOIN public.profiles p ON p.id=(SELECT auth.uid()) AND p.status='active'
    WHERE g.id=p_group_id AND g.status <> 'removed'
      AND ((g.school_id IS NULL AND g.university_id IS NULL)
        OR (g.school_id IS NOT NULL AND g.school_id=p.school_id)
        OR (g.university_id IS NOT NULL AND g.university_id=p.university_id))
      AND (g.creator_id=p.id OR EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id=g.id AND gm.user_id=p.id AND gm.role='admin'))
  );
$function$;

CREATE OR REPLACE FUNCTION public.join_study_group(p_group_id UUID, p_invite_code TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_uid UUID := (SELECT auth.uid()); v_privacy TEXT; v_invite TEXT; v_status TEXT; v_school UUID; v_university UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'You must be signed in to join a study group.'; END IF;
  SELECT g.privacy,g.invite_code,g.status,g.school_id,g.university_id INTO v_privacy,v_invite,v_status,v_school,v_university
  FROM public.study_groups g WHERE g.id=p_group_id;
  IF NOT FOUND OR v_status='removed' THEN RAISE EXCEPTION 'Study group not found.'; END IF;
  IF v_status <> 'active' THEN RAISE EXCEPTION 'This study group is not accepting new members.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_uid AND p.status='active'
      AND ((v_school IS NULL AND v_university IS NULL) OR (v_school IS NOT NULL AND p.school_id=v_school) OR (v_university IS NOT NULL AND p.university_id=v_university)))
  THEN RAISE EXCEPTION 'Kikundi hiki ni cha wanafunzi wa shule/chuo husika pekee.'; END IF;
  IF v_privacy='private' AND upper(btrim(COALESCE(p_invite_code,''))) <> upper(v_invite) THEN
    RAISE EXCEPTION 'A valid invite code is required for this private group.';
  END IF;
  INSERT INTO public.group_members(group_id,user_id,role) VALUES(p_group_id,v_uid,'member') ON CONFLICT(group_id,user_id) DO NOTHING;
END;
$function$;
REVOKE ALL ON FUNCTION public.join_study_group(UUID,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_study_group(UUID,TEXT) TO authenticated;

DROP POLICY IF EXISTS study_groups_select_visible ON public.study_groups;
CREATE POLICY study_groups_select_visible ON public.study_groups FOR SELECT TO anon,authenticated USING (public.can_view_study_group(id));
DROP POLICY IF EXISTS study_groups_insert_own ON public.study_groups;
CREATE POLICY study_groups_insert_own ON public.study_groups FOR INSERT TO authenticated WITH CHECK (
 creator_id=(SELECT auth.uid()) AND member_count=0 AND status='active' AND
 EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.status='active'
  AND ((public.study_groups.school_id IS NULL AND public.study_groups.university_id IS NULL)
    OR (public.study_groups.school_id IS NOT NULL AND p.school_id=public.study_groups.school_id)
    OR (public.study_groups.university_id IS NOT NULL AND p.university_id=public.study_groups.university_id)))
);
GRANT INSERT (name, description, level, subject_id, school_id, university_id, privacy) ON public.study_groups TO authenticated;

GRANT INSERT (school_id, university_id) ON public.questions TO authenticated;

DROP POLICY IF EXISTS questions_select_public_or_own ON public.questions;
CREATE POLICY questions_select_public_or_own ON public.questions FOR SELECT TO anon,authenticated USING (
 (status <> 'removed' OR user_id=(SELECT auth.uid())) AND
 ((public.questions.school_id IS NULL AND public.questions.university_id IS NULL) OR EXISTS (
   SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.status='active'
    AND ((public.questions.school_id IS NOT NULL AND p.school_id=public.questions.school_id) OR (public.questions.university_id IS NOT NULL AND p.university_id=public.questions.university_id))
 ))
);
DROP POLICY IF EXISTS questions_insert_own ON public.questions;
CREATE POLICY questions_insert_own ON public.questions FOR INSERT TO authenticated WITH CHECK (
 public.questions.user_id=(SELECT auth.uid()) AND public.questions.status='open' AND public.questions.upvotes=0 AND public.questions.best_answer_id IS NULL AND
 EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.status='active'
  AND ((public.questions.school_id IS NULL AND public.questions.university_id IS NULL) OR (public.questions.school_id IS NOT NULL AND p.school_id=public.questions.school_id) OR (public.questions.university_id IS NOT NULL AND p.university_id=public.questions.university_id)))
);
DROP POLICY IF EXISTS questions_update_own ON public.questions;
CREATE POLICY questions_update_own ON public.questions FOR UPDATE TO authenticated USING (
 public.questions.user_id=(SELECT auth.uid()) AND public.questions.status <> 'removed' AND
 EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.status='active'
  AND ((public.questions.school_id IS NULL AND public.questions.university_id IS NULL) OR (public.questions.school_id IS NOT NULL AND p.school_id=public.questions.school_id) OR (public.questions.university_id IS NOT NULL AND p.university_id=public.questions.university_id)))
) WITH CHECK (
 public.questions.user_id=(SELECT auth.uid()) AND public.questions.status <> 'removed' AND
 EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.status='active'
  AND ((public.questions.school_id IS NULL AND public.questions.university_id IS NULL) OR (public.questions.school_id IS NOT NULL AND p.school_id=public.questions.school_id) OR (public.questions.university_id IS NOT NULL AND p.university_id=public.questions.university_id)))
);

-- 4b) Close legacy membership and child-row access gaps for institution-scoped groups/Q&A.
-- Membership helper now requires an active profile matching the group's institution.
CREATE OR REPLACE FUNCTION public.is_study_group_member(p_group_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    JOIN public.study_groups g ON g.id=gm.group_id AND g.status='active'
    JOIN public.profiles p ON p.id=(SELECT auth.uid()) AND p.id=gm.user_id AND p.status='active'
    WHERE gm.group_id=p_group_id
      AND ((g.school_id IS NULL AND g.university_id IS NULL)
        OR (g.school_id IS NOT NULL AND p.school_id=g.school_id)
        OR (g.university_id IS NOT NULL AND p.university_id=g.university_id))
  );
$function$;
REVOKE ALL PRIVILEGES ON FUNCTION public.is_study_group_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_study_group_member(UUID) TO anon, authenticated;

-- Remove only stale membership links that no longer match the institution or an active profile.
-- Group records/posts are not deleted; the existing member-count trigger adjusts counts.
DELETE FROM public.group_members gm
USING public.study_groups g, public.profiles p
WHERE gm.group_id=g.id AND gm.user_id=p.id
  AND (g.school_id IS NOT NULL OR g.university_id IS NOT NULL)
  AND (p.status IS DISTINCT FROM 'active'
    OR (g.school_id IS NOT NULL AND p.school_id IS DISTINCT FROM g.school_id)
    OR (g.university_id IS NOT NULL AND p.university_id IS DISTINCT FROM g.university_id));

DROP POLICY IF EXISTS group_posts_update_author_or_admin ON public.group_posts;
CREATE POLICY group_posts_update_author_or_admin ON public.group_posts FOR UPDATE TO authenticated
USING (public.can_view_study_group(group_id) AND (author_id=(SELECT auth.uid()) OR public.can_manage_study_group(group_id)))
WITH CHECK (public.can_view_study_group(group_id) AND (author_id=(SELECT auth.uid()) OR public.can_manage_study_group(group_id)));
DROP POLICY IF EXISTS group_posts_delete_author_or_admin ON public.group_posts;
CREATE POLICY group_posts_delete_author_or_admin ON public.group_posts FOR DELETE TO authenticated
USING (public.can_view_study_group(group_id) AND (author_id=(SELECT auth.uid()) OR public.can_manage_study_group(group_id)));

DROP POLICY IF EXISTS study_group_messages_delete_sender_or_admin ON public.study_group_messages;
CREATE POLICY study_group_messages_delete_sender_or_admin ON public.study_group_messages FOR DELETE TO authenticated
USING (public.is_study_group_member(group_id) AND (sender_id=(SELECT auth.uid()) OR public.can_manage_study_group(group_id)));

DROP POLICY IF EXISTS group_post_comments_update_author_or_admin ON public.group_post_comments;
CREATE POLICY group_post_comments_update_author_or_admin ON public.group_post_comments FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.group_posts gp WHERE gp.id=post_id AND public.can_view_study_group(gp.group_id))
  AND (author_id=(SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.group_posts gp WHERE gp.id=post_id AND public.can_manage_study_group(gp.group_id)))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.group_posts gp WHERE gp.id=post_id AND public.can_view_study_group(gp.group_id))
  AND (author_id=(SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.group_posts gp WHERE gp.id=post_id AND public.can_manage_study_group(gp.group_id)))
);
DROP POLICY IF EXISTS group_post_comments_delete_author_or_admin ON public.group_post_comments;
CREATE POLICY group_post_comments_delete_author_or_admin ON public.group_post_comments FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.group_posts gp WHERE gp.id=post_id AND public.can_view_study_group(gp.group_id))
  AND (author_id=(SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.group_posts gp WHERE gp.id=post_id AND public.can_manage_study_group(gp.group_id)))
);

DROP POLICY IF EXISTS study_group_files_delete_uploader_or_admin ON public.study_group_files;
CREATE POLICY study_group_files_delete_uploader_or_admin ON public.study_group_files FOR DELETE TO authenticated
USING (public.can_view_study_group(group_id) AND (uploader_id=(SELECT auth.uid()) OR public.can_manage_study_group(group_id)));

-- Reusable visibility check for questions and all rows attached to them.
CREATE OR REPLACE FUNCTION public.can_view_smartnekam_question(p_question_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.questions q
    WHERE q.id=p_question_id
      AND ((q.school_id IS NULL AND q.university_id IS NULL)
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.status='active'
          AND ((q.school_id IS NOT NULL AND p.school_id=q.school_id)
            OR (q.university_id IS NOT NULL AND p.university_id=q.university_id)))
      )
  );
$function$;
REVOKE ALL PRIVILEGES ON FUNCTION public.can_view_smartnekam_question(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_smartnekam_question(UUID) TO anon, authenticated;

DROP POLICY IF EXISTS question_comments_select_visible ON public.question_comments;
CREATE POLICY question_comments_select_visible ON public.question_comments FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.questions q WHERE q.id=question_id
  AND (q.status <> 'removed' OR q.user_id=(SELECT auth.uid()))
  AND public.can_view_smartnekam_question(q.id)));
DROP POLICY IF EXISTS question_comments_insert_own ON public.question_comments;
CREATE POLICY question_comments_insert_own ON public.question_comments FOR INSERT TO authenticated
WITH CHECK (user_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles me WHERE me.id=(SELECT auth.uid()) AND me.status='active') AND EXISTS (SELECT 1 FROM public.questions q WHERE q.id=question_id AND q.status='open' AND public.can_view_smartnekam_question(q.id)));
DROP POLICY IF EXISTS question_comments_update_own ON public.question_comments;
CREATE POLICY question_comments_update_own ON public.question_comments FOR UPDATE TO authenticated
USING (user_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles me WHERE me.id=(SELECT auth.uid()) AND me.status='active') AND EXISTS (SELECT 1 FROM public.questions q WHERE q.id=question_id AND public.can_view_smartnekam_question(q.id)))
WITH CHECK (user_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles me WHERE me.id=(SELECT auth.uid()) AND me.status='active') AND EXISTS (SELECT 1 FROM public.questions q WHERE q.id=question_id AND public.can_view_smartnekam_question(q.id)));
DROP POLICY IF EXISTS question_comments_delete_own ON public.question_comments;
CREATE POLICY question_comments_delete_own ON public.question_comments FOR DELETE TO authenticated
USING (user_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles me WHERE me.id=(SELECT auth.uid()) AND me.status='active') AND EXISTS (SELECT 1 FROM public.questions q WHERE q.id=question_id AND public.can_view_smartnekam_question(q.id)));

DROP POLICY IF EXISTS answers_select_visible_question ON public.answers;
CREATE POLICY answers_select_visible_question ON public.answers FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.questions q WHERE q.id=question_id
  AND (q.status <> 'removed' OR q.user_id=(SELECT auth.uid())) AND public.can_view_smartnekam_question(q.id)));
DROP POLICY IF EXISTS answers_insert_own_open_question ON public.answers;
CREATE POLICY answers_insert_own_open_question ON public.answers FOR INSERT TO authenticated
WITH CHECK (user_id=(SELECT auth.uid()) AND is_best_answer=FALSE AND upvotes=0
  AND EXISTS (SELECT 1 FROM public.profiles me WHERE me.id=(SELECT auth.uid()) AND me.status='active')
  AND EXISTS (SELECT 1 FROM public.questions q WHERE q.id=question_id AND q.status='open' AND public.can_view_smartnekam_question(q.id)));
DROP POLICY IF EXISTS answers_update_own_nonbest ON public.answers;
CREATE POLICY answers_update_own_nonbest ON public.answers FOR UPDATE TO authenticated
USING (user_id=(SELECT auth.uid()) AND is_best_answer=FALSE
  AND EXISTS (SELECT 1 FROM public.profiles me WHERE me.id=(SELECT auth.uid()) AND me.status='active')
  AND EXISTS (SELECT 1 FROM public.questions q WHERE q.id=question_id AND q.status='open' AND public.can_view_smartnekam_question(q.id)))
WITH CHECK (user_id=(SELECT auth.uid()) AND is_best_answer=FALSE
  AND EXISTS (SELECT 1 FROM public.profiles me WHERE me.id=(SELECT auth.uid()) AND me.status='active')
  AND EXISTS (SELECT 1 FROM public.questions q WHERE q.id=question_id AND q.status='open' AND public.can_view_smartnekam_question(q.id)));
DROP POLICY IF EXISTS answers_delete_own_nonbest ON public.answers;
CREATE POLICY answers_delete_own_nonbest ON public.answers FOR DELETE TO authenticated
USING (user_id=(SELECT auth.uid()) AND is_best_answer=FALSE
  AND EXISTS (SELECT 1 FROM public.profiles me WHERE me.id=(SELECT auth.uid()) AND me.status='active')
  AND EXISTS (SELECT 1 FROM public.questions q WHERE q.id=question_id AND public.can_view_smartnekam_question(q.id)));

DROP POLICY IF EXISTS question_votes_select_own ON public.question_votes;
CREATE POLICY question_votes_select_own ON public.question_votes FOR SELECT TO authenticated
USING (user_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles me WHERE me.id=(SELECT auth.uid()) AND me.status='active') AND public.can_view_smartnekam_question(question_id));
DROP POLICY IF EXISTS question_votes_insert_own ON public.question_votes;
CREATE POLICY question_votes_insert_own ON public.question_votes FOR INSERT TO authenticated
WITH CHECK (user_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles me WHERE me.id=(SELECT auth.uid()) AND me.status='active') AND EXISTS (SELECT 1 FROM public.questions q WHERE q.id=question_id AND q.status <> 'removed' AND public.can_view_smartnekam_question(q.id)));
DROP POLICY IF EXISTS question_votes_delete_own ON public.question_votes;
CREATE POLICY question_votes_delete_own ON public.question_votes FOR DELETE TO authenticated
USING (user_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles me WHERE me.id=(SELECT auth.uid()) AND me.status='active') AND public.can_view_smartnekam_question(question_id));

DROP POLICY IF EXISTS answer_votes_select_own ON public.answer_votes;
CREATE POLICY answer_votes_select_own ON public.answer_votes FOR SELECT TO authenticated
USING (user_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles me WHERE me.id=(SELECT auth.uid()) AND me.status='active') AND EXISTS (SELECT 1 FROM public.answers a WHERE a.id=answer_id AND public.can_view_smartnekam_question(a.question_id)));
DROP POLICY IF EXISTS answer_votes_insert_own ON public.answer_votes;
CREATE POLICY answer_votes_insert_own ON public.answer_votes FOR INSERT TO authenticated
WITH CHECK (user_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles me WHERE me.id=(SELECT auth.uid()) AND me.status='active') AND EXISTS (SELECT 1 FROM public.answers a JOIN public.questions q ON q.id=a.question_id
  WHERE a.id=answer_id AND q.status <> 'removed' AND public.can_view_smartnekam_question(q.id)));
DROP POLICY IF EXISTS answer_votes_delete_own ON public.answer_votes;
CREATE POLICY answer_votes_delete_own ON public.answer_votes FOR DELETE TO authenticated
USING (user_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles me WHERE me.id=(SELECT auth.uid()) AND me.status='active') AND EXISTS (SELECT 1 FROM public.answers a WHERE a.id=answer_id AND public.can_view_smartnekam_question(a.question_id)));

-- 5) Moderation RPC also handles textbooks, while preserving active moderator checks + audit log.
CREATE OR REPLACE FUNCTION public.review_library_content(
  p_content_type TEXT, p_content_id UUID, p_decision TEXT, p_reason TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_actor UUID := (SELECT auth.uid()); v_found_id UUID; v_status TEXT;
BEGIN
  IF v_actor IS NULL OR NOT public.is_smartnekam_moderator() THEN RAISE EXCEPTION 'Only an active SmartNekam moderator can review library content.'; END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approve','reject','remove') THEN RAISE EXCEPTION 'Decision must be approve, reject, or remove.'; END IF;
  IF p_content_type='note' THEN
    v_status := CASE p_decision WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE 'removed' END;
    UPDATE public.notes SET status=v_status, reviewed_at=pg_catalog.now(), reviewed_by=v_actor, rejection_reason=CASE WHEN p_decision='reject' THEN p_reason ELSE NULL END WHERE id=p_content_id RETURNING id INTO v_found_id;
  ELSIF p_content_type='past_paper' THEN
    v_status := CASE p_decision WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE 'removed' END;
    UPDATE public.past_papers SET status=v_status, reviewed_at=pg_catalog.now(), reviewed_by=v_actor, rejection_reason=CASE WHEN p_decision='reject' THEN p_reason ELSE NULL END WHERE id=p_content_id RETURNING id INTO v_found_id;
  ELSIF p_content_type='textbook' THEN
    v_status := CASE p_decision WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE 'removed' END;
    UPDATE public.textbooks SET status=v_status, reviewed_at=pg_catalog.now(), reviewed_by=v_actor, rejection_reason=CASE WHEN p_decision='reject' THEN p_reason ELSE NULL END WHERE id=p_content_id RETURNING id INTO v_found_id;
  ELSIF p_content_type='opportunity' THEN
    v_status := CASE p_decision WHEN 'approve' THEN 'active' WHEN 'reject' THEN 'rejected' ELSE 'closed' END;
    UPDATE public.opportunities SET status=v_status, verified=(p_decision='approve'), reviewed_by=v_actor, reviewed_at=pg_catalog.now(), rejection_reason=CASE WHEN p_decision='reject' THEN p_reason ELSE NULL END, updated_at=pg_catalog.now() WHERE id=p_content_id RETURNING id INTO v_found_id;
  ELSE RAISE EXCEPTION 'Supported content types are note, past_paper, textbook, and opportunity.';
  END IF;
  IF v_found_id IS NULL THEN RAISE EXCEPTION 'Content item not found.'; END IF;
  INSERT INTO public.admin_audit_log(actor_id,action_name,entity_type,entity_id,details)
  VALUES(v_actor,'review_library_content',p_content_type,p_content_id,jsonb_build_object('decision',p_decision,'reason_supplied',(p_reason IS NOT NULL)));
END;
$function$;
REVOKE ALL ON FUNCTION public.review_library_content(TEXT,UUID,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_library_content(TEXT,UUID,TEXT,TEXT) TO authenticated;

-- 6) A small, privacy-aware people discovery RPC for the Home Feed interlude.
CREATE OR REPLACE FUNCTION public.get_suggested_smartnekam_users(p_limit INTEGER DEFAULT 6)
RETURNS TABLE(user_id UUID, full_name TEXT, username TEXT, avatar_url TEXT, role TEXT, can_message BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $function$
  SELECT p.id, p.full_name::text, p.username::text, p.avatar_url::text, p.role::text,
         public.can_start_smartnekam_direct_message(p.id) AS can_message
  FROM public.profiles p
  LEFT JOIN public.user_privacy_settings s ON s.user_id=p.id
  WHERE (SELECT auth.uid()) IS NOT NULL AND p.id <> (SELECT auth.uid()) AND p.status='active'
    AND COALESCE(s.profile_visibility,'community') <> 'private'
    AND NOT EXISTS (SELECT 1 FROM public.user_blocks b WHERE (b.blocker_id=(SELECT auth.uid()) AND b.blocked_user_id=p.id) OR (b.blocker_id=p.id AND b.blocked_user_id=(SELECT auth.uid())))
  ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC
  LIMIT GREATEST(1,LEAST(COALESCE(p_limit,6),12));
$function$;
REVOKE ALL ON FUNCTION public.get_suggested_smartnekam_users(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_suggested_smartnekam_users(INTEGER) TO authenticated;

COMMIT;

-- After applying this migration, global Q&A must query rows where school_id IS NULL and university_id IS NULL.
-- Institution pages may query a scoped group/question only when the viewer's profile institution matches.

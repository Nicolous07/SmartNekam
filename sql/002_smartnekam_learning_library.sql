-- SmartNekam | SQL 002: Learning Library (notes, past papers, saves, downloads, private Storage)
-- Prerequisite: successfully run 001_smartnekam_foundation.sql in this project.
-- This script is designed to be re-runnable during development and does not delete data.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Notes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uploader_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
    level VARCHAR(30) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    storage_path TEXT NOT NULL UNIQUE,
    file_type VARCHAR(10) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    downloads BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    CONSTRAINT notes_level_check
        CHECK (level IN ('O_LEVEL', 'A_LEVEL', 'UNIVERSITY')),
    CONSTRAINT notes_file_type_check
        CHECK (lower(file_type) IN ('pdf', 'docx', 'pptx', 'jpg', 'jpeg', 'png')),
    CONSTRAINT notes_file_size_check
        CHECK (file_size_bytes > 0 AND file_size_bytes <= 26214400),
    CONSTRAINT notes_status_check
        CHECK (status IN ('pending', 'approved', 'rejected', 'removed')),
    CONSTRAINT notes_title_not_blank CHECK (length(btrim(title)) > 0),
    CONSTRAINT notes_description_not_blank CHECK (length(btrim(description)) > 0),
    CONSTRAINT notes_downloads_nonnegative CHECK (downloads >= 0)
);

CREATE INDEX IF NOT EXISTS notes_subject_level_idx
    ON public.notes (subject_id, level);
CREATE INDEX IF NOT EXISTS notes_status_created_idx
    ON public.notes (status, created_at DESC);
CREATE INDEX IF NOT EXISTS notes_uploader_created_idx
    ON public.notes (uploader_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notes_tags_gin_idx
    ON public.notes USING GIN (tags);

-- -----------------------------------------------------------------------------
-- 2. Past papers and optional marking schemes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.past_papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uploader_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
    level VARCHAR(30) NOT NULL,
    exam_type VARCHAR(30) NOT NULL,
    year INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    storage_path TEXT NOT NULL UNIQUE,
    marking_scheme_path TEXT UNIQUE,
    file_type VARCHAR(10) NOT NULL DEFAULT 'pdf',
    file_size_bytes BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    downloads BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    CONSTRAINT past_papers_level_check
        CHECK (level IN ('O_LEVEL', 'A_LEVEL', 'UNIVERSITY')),
    CONSTRAINT past_papers_exam_type_check
        CHECK (exam_type IN ('NECTA', 'MOCK', 'UNIVERSITY', 'OTHER')),
    CONSTRAINT past_papers_year_check CHECK (year BETWEEN 1950 AND 2200),
    CONSTRAINT past_papers_file_type_check
        CHECK (lower(file_type) IN ('pdf', 'docx', 'pptx', 'jpg', 'jpeg', 'png')),
    CONSTRAINT past_papers_file_size_check
        CHECK (file_size_bytes > 0 AND file_size_bytes <= 26214400),
    CONSTRAINT past_papers_status_check
        CHECK (status IN ('pending', 'approved', 'rejected', 'removed')),
    CONSTRAINT past_papers_title_not_blank CHECK (length(btrim(title)) > 0),
    CONSTRAINT past_papers_downloads_nonnegative CHECK (downloads >= 0)
);

CREATE INDEX IF NOT EXISTS past_papers_search_idx
    ON public.past_papers (level, subject_id, exam_type, year DESC);
CREATE INDEX IF NOT EXISTS past_papers_status_created_idx
    ON public.past_papers (status, created_at DESC);
CREATE INDEX IF NOT EXISTS past_papers_uploader_created_idx
    ON public.past_papers (uploader_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 3. Saved resources (each user can save a resource only once)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.note_saves (
    user_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES public.profiles(id) ON DELETE CASCADE,
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, note_id)
);

CREATE TABLE IF NOT EXISTS public.past_paper_saves (
    user_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES public.profiles(id) ON DELETE CASCADE,
    past_paper_id UUID NOT NULL REFERENCES public.past_papers(id) ON DELETE CASCADE,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, past_paper_id)
);

-- -----------------------------------------------------------------------------
-- 4. Download tracking: once per authenticated user/resource.
-- Counts are updated by database triggers, not by client-supplied values.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.note_downloads (
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES public.profiles(id) ON DELETE CASCADE,
    downloaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (note_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.past_paper_downloads (
    past_paper_id UUID NOT NULL REFERENCES public.past_papers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES public.profiles(id) ON DELETE CASCADE,
    downloaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (past_paper_id, user_id)
);

CREATE OR REPLACE FUNCTION public.increment_note_download_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.notes
       SET downloads = downloads + 1
     WHERE id = NEW.note_id;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_past_paper_download_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.past_papers
       SET downloads = downloads + 1
     WHERE id = NEW.past_paper_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS note_downloads_increment_count ON public.note_downloads;
CREATE TRIGGER note_downloads_increment_count
AFTER INSERT ON public.note_downloads
FOR EACH ROW EXECUTE FUNCTION public.increment_note_download_count();

DROP TRIGGER IF EXISTS past_paper_downloads_increment_count ON public.past_paper_downloads;
CREATE TRIGGER past_paper_downloads_increment_count
AFTER INSERT ON public.past_paper_downloads
FOR EACH ROW EXECUTE FUNCTION public.increment_past_paper_download_count();

REVOKE ALL PRIVILEGES ON FUNCTION public.increment_note_download_count() FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.increment_past_paper_download_count() FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Private Storage bucket for learning resources (25 MiB per file)
--    File paths should start with the uploader's auth user UUID, e.g.
--    <auth.uid()>/notes/<filename>. Only approved resources are readable by others.
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'learning-resources',
    'learning-resources',
    FALSE,
    26214400,
    ARRAY[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'image/jpeg',
        'image/png'
    ]
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- 6. Row Level Security
-- -----------------------------------------------------------------------------
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.past_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.past_paper_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.past_paper_downloads ENABLE ROW LEVEL SECURITY;

-- Notes: public metadata only for approved resources; uploader can see own submissions.
DROP POLICY IF EXISTS notes_read_approved_or_own ON public.notes;
CREATE POLICY notes_read_approved_or_own
ON public.notes FOR SELECT TO anon, authenticated
USING (status = 'approved' OR uploader_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS notes_insert_own_pending ON public.notes;
CREATE POLICY notes_insert_own_pending
ON public.notes FOR INSERT TO authenticated
WITH CHECK (
    uploader_id = (SELECT auth.uid())
    AND status = 'pending'
    AND downloads = 0
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
    AND rejection_reason IS NULL
);

DROP POLICY IF EXISTS notes_update_own_pending ON public.notes;
CREATE POLICY notes_update_own_pending
ON public.notes FOR UPDATE TO authenticated
USING (uploader_id = (SELECT auth.uid()) AND status = 'pending')
WITH CHECK (uploader_id = (SELECT auth.uid()) AND status = 'pending');

DROP POLICY IF EXISTS notes_delete_own_pending ON public.notes;
CREATE POLICY notes_delete_own_pending
ON public.notes FOR DELETE TO authenticated
USING (uploader_id = (SELECT auth.uid()) AND status = 'pending');

-- Past papers: same moderation workflow as notes.
DROP POLICY IF EXISTS past_papers_read_approved_or_own ON public.past_papers;
CREATE POLICY past_papers_read_approved_or_own
ON public.past_papers FOR SELECT TO anon, authenticated
USING (status = 'approved' OR uploader_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS past_papers_insert_own_pending ON public.past_papers;
CREATE POLICY past_papers_insert_own_pending
ON public.past_papers FOR INSERT TO authenticated
WITH CHECK (
    uploader_id = (SELECT auth.uid())
    AND status = 'pending'
    AND downloads = 0
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
    AND rejection_reason IS NULL
);

DROP POLICY IF EXISTS past_papers_update_own_pending ON public.past_papers;
CREATE POLICY past_papers_update_own_pending
ON public.past_papers FOR UPDATE TO authenticated
USING (uploader_id = (SELECT auth.uid()) AND status = 'pending')
WITH CHECK (uploader_id = (SELECT auth.uid()) AND status = 'pending');

DROP POLICY IF EXISTS past_papers_delete_own_pending ON public.past_papers;
CREATE POLICY past_papers_delete_own_pending
ON public.past_papers FOR DELETE TO authenticated
USING (uploader_id = (SELECT auth.uid()) AND status = 'pending');

-- Save notes.
DROP POLICY IF EXISTS note_saves_read_own ON public.note_saves;
CREATE POLICY note_saves_read_own
ON public.note_saves FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS note_saves_insert_own_approved ON public.note_saves;
CREATE POLICY note_saves_insert_own_approved
ON public.note_saves FOR INSERT TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_id AND n.status = 'approved')
);

DROP POLICY IF EXISTS note_saves_delete_own ON public.note_saves;
CREATE POLICY note_saves_delete_own
ON public.note_saves FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

-- Save past papers.
DROP POLICY IF EXISTS past_paper_saves_read_own ON public.past_paper_saves;
CREATE POLICY past_paper_saves_read_own
ON public.past_paper_saves FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS past_paper_saves_insert_own_approved ON public.past_paper_saves;
CREATE POLICY past_paper_saves_insert_own_approved
ON public.past_paper_saves FOR INSERT TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.past_papers p WHERE p.id = past_paper_id AND p.status = 'approved')
);

DROP POLICY IF EXISTS past_paper_saves_delete_own ON public.past_paper_saves;
CREATE POLICY past_paper_saves_delete_own
ON public.past_paper_saves FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

-- Download records: authenticated users can record one download per approved resource.
DROP POLICY IF EXISTS note_downloads_read_own ON public.note_downloads;
CREATE POLICY note_downloads_read_own
ON public.note_downloads FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS note_downloads_insert_own_approved ON public.note_downloads;
CREATE POLICY note_downloads_insert_own_approved
ON public.note_downloads FOR INSERT TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_id AND n.status = 'approved')
);

DROP POLICY IF EXISTS past_paper_downloads_read_own ON public.past_paper_downloads;
CREATE POLICY past_paper_downloads_read_own
ON public.past_paper_downloads FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS past_paper_downloads_insert_own_approved ON public.past_paper_downloads;
CREATE POLICY past_paper_downloads_insert_own_approved
ON public.past_paper_downloads FOR INSERT TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.past_papers p WHERE p.id = past_paper_id AND p.status = 'approved')
);

-- Storage: private files only; own folders are manageable by their owner, and approved
-- resources can be read by other users. The matching database row must be approved.
DROP POLICY IF EXISTS learning_resources_read_own_or_approved ON storage.objects;
CREATE POLICY learning_resources_read_own_or_approved
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'learning-resources'
    AND (
        (storage.foldername(name))[1] = (SELECT auth.uid())::text
        OR EXISTS (
            SELECT 1 FROM public.notes n
            WHERE n.storage_path = name AND n.status = 'approved'
        )
        OR EXISTS (
            SELECT 1 FROM public.past_papers p
            WHERE (p.storage_path = name OR p.marking_scheme_path = name)
              AND p.status = 'approved'
        )
    )
);

DROP POLICY IF EXISTS learning_resources_upload_own_folder ON storage.objects;
CREATE POLICY learning_resources_upload_own_folder
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'learning-resources'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS learning_resources_update_own_folder ON storage.objects;
CREATE POLICY learning_resources_update_own_folder
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'learning-resources'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
)
WITH CHECK (
    bucket_id = 'learning-resources'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS learning_resources_delete_own_folder ON storage.objects;
CREATE POLICY learning_resources_delete_own_folder
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'learning-resources'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

-- -----------------------------------------------------------------------------
-- 7. Least-privilege API grants
-- -----------------------------------------------------------------------------
REVOKE ALL PRIVILEGES ON TABLE
    public.notes,
    public.past_papers,
    public.note_saves,
    public.past_paper_saves,
    public.note_downloads,
    public.past_paper_downloads
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.notes, public.past_papers TO anon, authenticated;
GRANT INSERT ON TABLE public.notes, public.past_papers TO authenticated;
GRANT UPDATE (subject_id, level, title, description, storage_path, file_type, file_size_bytes, tags)
    ON TABLE public.notes TO authenticated;
GRANT UPDATE (subject_id, level, exam_type, year, title, storage_path, marking_scheme_path, file_type, file_size_bytes)
    ON TABLE public.past_papers TO authenticated;
GRANT DELETE ON TABLE public.notes, public.past_papers TO authenticated;

GRANT SELECT, INSERT, DELETE ON TABLE public.note_saves, public.past_paper_saves TO authenticated;
GRANT SELECT, INSERT ON TABLE public.note_downloads, public.past_paper_downloads TO authenticated;

COMMIT;

-- Expected result: Success. No rows returned.
-- Notes and past papers are pending review by default. Admin review permissions are added
-- in the moderation/admin SQL module; do not manually change status from the client.

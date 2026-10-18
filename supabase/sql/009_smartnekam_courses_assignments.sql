-- SmartNekam | SQL 009: Courses, Lessons, Enrollments and Assignments
-- Based on SmartNekam PRD Phase 3: video courses, assignments and learning progress.
-- Prerequisites: SQL 001A, 001B, 002, 003, 004 FIXED, 005, 006, 007 and 008.
-- Run this ENTIRE file in Supabase Dashboard > SQL Editor > New query.
-- Re-runnable during development; this migration does not drop existing user data.
-- Storage path conventions:
--   Course assets: <course_uuid>/<filename>
--   Assignment submissions: <assignment_uuid>/<student_auth_uuid>/<filename>

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Courses and structured lessons
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    level VARCHAR(30) NOT NULL,
    language VARCHAR(2) NOT NULL DEFAULT 'sw',
    access_type VARCHAR(16) NOT NULL DEFAULT 'free',
    price NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'TZS',
    thumbnail_url TEXT,
    estimated_minutes INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(24) NOT NULL DEFAULT 'draft',
    review_note TEXT,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT courses_title_not_blank CHECK (length(btrim(title)) > 0),
    CONSTRAINT courses_level_check CHECK (level IN ('O_LEVEL', 'A_LEVEL', 'UNIVERSITY', 'ALL')),
    CONSTRAINT courses_language_check CHECK (language IN ('sw', 'en')),
    CONSTRAINT courses_access_type_check CHECK (access_type IN ('free', 'premium')),
    CONSTRAINT courses_price_check CHECK (price >= 0 AND (access_type <> 'free' OR price = 0)),
    CONSTRAINT courses_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT courses_estimated_minutes_check CHECK (estimated_minutes >= 0),
    CONSTRAINT courses_status_check CHECK (status IN ('draft', 'pending_review', 'published', 'rejected', 'archived')),
    CONSTRAINT courses_id_creator_unique UNIQUE (id, creator_id)
);

CREATE INDEX IF NOT EXISTS courses_discovery_idx
    ON public.courses (status, level, subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS courses_creator_idx
    ON public.courses (creator_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS courses_title_search_idx
    ON public.courses USING gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '')));

DROP TRIGGER IF EXISTS courses_set_updated_at ON public.courses;
CREATE TRIGGER courses_set_updated_at
BEFORE UPDATE ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.course_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL,
    creator_id UUID NOT NULL,
    title VARCHAR(180) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT course_modules_title_not_blank CHECK (length(btrim(title)) > 0),
    CONSTRAINT course_modules_position_positive CHECK (position > 0),
    CONSTRAINT course_modules_course_fk FOREIGN KEY (course_id, creator_id)
        REFERENCES public.courses(id, creator_id) ON DELETE CASCADE,
    CONSTRAINT course_modules_course_position_unique UNIQUE (course_id, position),
    CONSTRAINT course_modules_id_course_creator_unique UNIQUE (id, course_id, creator_id)
);

CREATE INDEX IF NOT EXISTS course_modules_course_position_idx
    ON public.course_modules (course_id, position);
DROP TRIGGER IF EXISTS course_modules_set_updated_at ON public.course_modules;
CREATE TRIGGER course_modules_set_updated_at
BEFORE UPDATE ON public.course_modules
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.course_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL,
    module_id UUID NOT NULL,
    creator_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    lesson_type VARCHAR(24) NOT NULL DEFAULT 'text',
    content TEXT NOT NULL DEFAULT '',
    video_url TEXT,
    resource_path TEXT,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 1,
    is_preview BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(24) NOT NULL DEFAULT 'draft',
    review_note TEXT,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT course_lessons_title_not_blank CHECK (length(btrim(title)) > 0),
    CONSTRAINT course_lessons_type_check CHECK (lesson_type IN ('text', 'video', 'pdf', 'external_link')),
    CONSTRAINT course_lessons_duration_check CHECK (duration_seconds >= 0),
    CONSTRAINT course_lessons_position_check CHECK (position > 0),
    CONSTRAINT course_lessons_status_check CHECK (status IN ('draft', 'pending_review', 'published', 'rejected', 'archived')),
    CONSTRAINT course_lessons_video_url_check CHECK (video_url IS NULL OR video_url ~* '^https?://'),
    CONSTRAINT course_lessons_module_owner_fk FOREIGN KEY (module_id, course_id, creator_id)
        REFERENCES public.course_modules(id, course_id, creator_id) ON DELETE CASCADE,
    CONSTRAINT course_lessons_module_position_unique UNIQUE (module_id, position),
    CONSTRAINT course_lessons_id_course_unique UNIQUE (id, course_id)
);

CREATE INDEX IF NOT EXISTS course_lessons_course_module_idx
    ON public.course_lessons (course_id, module_id, position);
CREATE INDEX IF NOT EXISTS course_lessons_resource_path_idx
    ON public.course_lessons (resource_path) WHERE resource_path IS NOT NULL;
DROP TRIGGER IF EXISTS course_lessons_set_updated_at ON public.course_lessons;
CREATE TRIGGER course_lessons_set_updated_at
BEFORE UPDATE ON public.course_lessons
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Enrollment and lesson progress
-- Clients cannot directly mark a course complete; progress writes go through RPC.
-- Premium course enrollment is intentionally left for the secure payment module.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.course_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    student_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    CONSTRAINT course_enrollments_status_check CHECK (status IN ('active', 'completed', 'cancelled')),
    CONSTRAINT course_enrollments_course_student_unique UNIQUE (course_id, student_id),
    CONSTRAINT course_enrollments_id_course_student_unique UNIQUE (id, course_id, student_id)
);

CREATE INDEX IF NOT EXISTS course_enrollments_student_idx
    ON public.course_enrollments (student_id, enrolled_at DESC);
CREATE INDEX IF NOT EXISTS course_enrollments_course_idx
    ON public.course_enrollments (course_id, status);

CREATE TABLE IF NOT EXISTS public.course_lesson_progress (
    student_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL,
    lesson_id UUID NOT NULL,
    watched_seconds INTEGER NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ,
    last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (student_id, lesson_id),
    CONSTRAINT course_lesson_progress_watched_check CHECK (watched_seconds >= 0),
    CONSTRAINT course_lesson_progress_lesson_fk FOREIGN KEY (lesson_id, course_id)
        REFERENCES public.course_lessons(id, course_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS course_lesson_progress_course_student_idx
    ON public.course_lesson_progress (course_id, student_id);
DROP TRIGGER IF EXISTS course_lesson_progress_set_updated_at ON public.course_lesson_progress;
CREATE TRIGGER course_lesson_progress_set_updated_at
BEFORE UPDATE ON public.course_lesson_progress
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.enroll_in_course(p_course_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_enrollment_id UUID;
    v_access_type TEXT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT c.access_type INTO v_access_type
      FROM public.courses AS c
     WHERE c.id = p_course_id AND c.status = 'published';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Published course not found.';
    END IF;
    IF v_access_type <> 'free' THEN
        RAISE EXCEPTION 'This is a premium course. Complete the payment flow before enrolling.';
    END IF;

    INSERT INTO public.course_enrollments (course_id, student_id, status)
    VALUES (p_course_id, v_uid, 'active')
    ON CONFLICT (course_id, student_id) DO UPDATE
       SET status = 'active', cancelled_at = NULL
     WHERE public.course_enrollments.status = 'cancelled'
    RETURNING id INTO v_enrollment_id;

    IF v_enrollment_id IS NULL THEN
        SELECT e.id INTO v_enrollment_id
          FROM public.course_enrollments AS e
         WHERE e.course_id = p_course_id AND e.student_id = v_uid;
    END IF;

    RETURN v_enrollment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_course_lesson_progress(
    p_lesson_id UUID,
    p_watched_seconds INTEGER DEFAULT 0,
    p_completed BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_course_id UUID;
    v_duration INTEGER;
    v_enrollment_status TEXT;
    v_completed_at TIMESTAMPTZ;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;
    IF p_watched_seconds IS NULL OR p_watched_seconds < 0 THEN
        RAISE EXCEPTION 'Watched seconds must be zero or greater.';
    END IF;

    SELECT l.course_id, l.duration_seconds
      INTO v_course_id, v_duration
      FROM public.course_lessons AS l
      JOIN public.courses AS c ON c.id = l.course_id
     WHERE l.id = p_lesson_id
       AND l.status = 'published'
       AND c.status = 'published';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Published lesson not found.';
    END IF;

    SELECT e.status INTO v_enrollment_status
      FROM public.course_enrollments AS e
     WHERE e.course_id = v_course_id AND e.student_id = v_uid;
    IF v_enrollment_status IS DISTINCT FROM 'active' THEN
        RAISE EXCEPTION 'An active course enrollment is required.';
    END IF;

    IF v_duration > 0 AND p_watched_seconds > v_duration THEN
        p_watched_seconds := v_duration;
    END IF;
    IF p_completed THEN
        v_completed_at := pg_catalog.now();
    END IF;

    INSERT INTO public.course_lesson_progress
        (student_id, course_id, lesson_id, watched_seconds, completed_at, last_viewed_at)
    VALUES
        (v_uid, v_course_id, p_lesson_id, p_watched_seconds, v_completed_at, pg_catalog.now())
    ON CONFLICT (student_id, lesson_id) DO UPDATE
       SET watched_seconds = GREATEST(public.course_lesson_progress.watched_seconds, EXCLUDED.watched_seconds),
           completed_at = COALESCE(public.course_lesson_progress.completed_at, EXCLUDED.completed_at),
           last_viewed_at = pg_catalog.now();

    RETURN pg_catalog.jsonb_build_object(
        'success', TRUE,
        'lesson_id', p_lesson_id,
        'course_id', v_course_id,
        'watched_seconds', p_watched_seconds,
        'completed', p_completed
    );
END;
$function$;

-- -----------------------------------------------------------------------------
-- 3. Assignments and protected submissions/grading
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.course_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL,
    creator_id UUID NOT NULL,
    module_id UUID,
    title VARCHAR(200) NOT NULL,
    instructions TEXT NOT NULL DEFAULT '',
    attachment_path TEXT,
    due_at TIMESTAMPTZ,
    max_score NUMERIC(8,2) NOT NULL DEFAULT 100,
    allow_late_submissions BOOLEAN NOT NULL DEFAULT FALSE,
    allow_resubmission BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(24) NOT NULL DEFAULT 'draft',
    review_note TEXT,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT course_assignments_title_not_blank CHECK (length(btrim(title)) > 0),
    CONSTRAINT course_assignments_max_score_check CHECK (max_score > 0 AND max_score <= 100),
    CONSTRAINT course_assignments_status_check CHECK (status IN ('draft', 'pending_review', 'published', 'rejected', 'archived')),
    CONSTRAINT course_assignments_course_creator_fk FOREIGN KEY (course_id, creator_id)
        REFERENCES public.courses(id, creator_id) ON DELETE CASCADE,
    CONSTRAINT course_assignments_module_fk FOREIGN KEY (module_id, course_id, creator_id)
        REFERENCES public.course_modules(id, course_id, creator_id) ON DELETE CASCADE,
    CONSTRAINT course_assignments_id_course_creator_unique UNIQUE (id, course_id, creator_id)
);

CREATE INDEX IF NOT EXISTS course_assignments_course_due_idx
    ON public.course_assignments (course_id, status, due_at);
DROP TRIGGER IF EXISTS course_assignments_set_updated_at ON public.course_assignments;
CREATE TRIGGER course_assignments_set_updated_at
BEFORE UPDATE ON public.course_assignments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.course_assignment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES public.course_assignments(id) ON DELETE CASCADE,
    course_id UUID NOT NULL,
    creator_id UUID NOT NULL,
    student_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
    response_text TEXT NOT NULL DEFAULT '',
    file_path TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status VARCHAR(20) NOT NULL DEFAULT 'submitted',
    score NUMERIC(8,2),
    feedback TEXT,
    graded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    graded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT course_assignment_submissions_status_check CHECK (status IN ('submitted', 'late', 'graded', 'returned')),
    CONSTRAINT course_assignment_submissions_score_check CHECK (score IS NULL OR score >= 0),
    CONSTRAINT course_assignment_submissions_course_creator_fk FOREIGN KEY (assignment_id, course_id, creator_id)
        REFERENCES public.course_assignments(id, course_id, creator_id) ON DELETE CASCADE,
    CONSTRAINT course_assignment_submissions_score_max_check CHECK (score IS NULL OR score <= 100),
    CONSTRAINT course_assignment_submissions_one_per_student UNIQUE (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS course_assignment_submissions_student_idx
    ON public.course_assignment_submissions (student_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS course_assignment_submissions_assignment_idx
    ON public.course_assignment_submissions (assignment_id, status, submitted_at DESC);
DROP TRIGGER IF EXISTS course_assignment_submissions_set_updated_at ON public.course_assignment_submissions;
CREATE TRIGGER course_assignment_submissions_set_updated_at
BEFORE UPDATE ON public.course_assignment_submissions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.submit_course_for_review(p_course_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_status TEXT;
    v_module_count INTEGER;
    v_lesson_count INTEGER;
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;

    SELECT c.status INTO v_status FROM public.courses AS c
     WHERE c.id = p_course_id AND c.creator_id = v_uid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Course not found or not owned by you.'; END IF;
    IF v_status NOT IN ('draft', 'rejected') THEN
        RAISE EXCEPTION 'Only draft or rejected courses can be submitted.';
    END IF;

    SELECT count(*)::INTEGER INTO v_module_count FROM public.course_modules AS m WHERE m.course_id = p_course_id;
    SELECT count(*)::INTEGER INTO v_lesson_count FROM public.course_lessons AS l WHERE l.course_id = p_course_id;
    IF v_module_count < 1 OR v_lesson_count < 1 THEN
        RAISE EXCEPTION 'Add at least one module and one lesson before submitting the course.';
    END IF;

    UPDATE public.courses
       SET status = 'pending_review', review_note = NULL, reviewed_by = NULL, reviewed_at = NULL
     WHERE id = p_course_id;
    RETURN pg_catalog.jsonb_build_object('success', TRUE, 'course_id', p_course_id, 'status', 'pending_review');
END;
$function$;

CREATE OR REPLACE FUNCTION public.review_course(p_course_id UUID, p_decision TEXT, p_note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_new_status TEXT;
BEGIN
    IF v_uid IS NULL OR NOT public.is_smartnekam_moderator() THEN
        RAISE EXCEPTION 'Moderator permission required.';
    END IF;
    IF p_decision NOT IN ('approve', 'reject') THEN RAISE EXCEPTION 'Decision must be approve or reject.'; END IF;
    IF p_note IS NOT NULL AND length(p_note) > 3000 THEN RAISE EXCEPTION 'Review note is too long.'; END IF;

    v_new_status := CASE WHEN p_decision = 'approve' THEN 'published' ELSE 'rejected' END;
    UPDATE public.courses
       SET status = v_new_status,
           review_note = NULLIF(pg_catalog.btrim(COALESCE(p_note, '')), ''),
           reviewed_by = v_uid,
           reviewed_at = pg_catalog.now(),
           published_at = CASE WHEN v_new_status = 'published' THEN pg_catalog.now() ELSE NULL END
     WHERE id = p_course_id AND status = 'pending_review';
    IF NOT FOUND THEN RAISE EXCEPTION 'Pending course not found.'; END IF;

    RETURN pg_catalog.jsonb_build_object('success', TRUE, 'course_id', p_course_id, 'status', v_new_status);
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_course_lesson_for_review(p_lesson_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_status TEXT;
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
    SELECT l.status INTO v_status FROM public.course_lessons AS l
     WHERE l.id = p_lesson_id AND l.creator_id = v_uid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Lesson not found or not owned by you.'; END IF;
    IF v_status NOT IN ('draft', 'rejected') THEN RAISE EXCEPTION 'Only draft or rejected lessons can be submitted.'; END IF;

    UPDATE public.course_lessons
       SET status = 'pending_review', review_note = NULL, reviewed_by = NULL, reviewed_at = NULL
     WHERE id = p_lesson_id;
    RETURN pg_catalog.jsonb_build_object('success', TRUE, 'lesson_id', p_lesson_id, 'status', 'pending_review');
END;
$function$;

CREATE OR REPLACE FUNCTION public.review_course_lesson(p_lesson_id UUID, p_decision TEXT, p_note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_new_status TEXT;
BEGIN
    IF v_uid IS NULL OR NOT public.is_smartnekam_moderator() THEN RAISE EXCEPTION 'Moderator permission required.'; END IF;
    IF p_decision NOT IN ('approve', 'reject') THEN RAISE EXCEPTION 'Decision must be approve or reject.'; END IF;
    IF p_note IS NOT NULL AND length(p_note) > 3000 THEN RAISE EXCEPTION 'Review note is too long.'; END IF;

    v_new_status := CASE WHEN p_decision = 'approve' THEN 'published' ELSE 'rejected' END;
    UPDATE public.course_lessons
       SET status = v_new_status,
           review_note = NULLIF(pg_catalog.btrim(COALESCE(p_note, '')), ''),
           reviewed_by = v_uid,
           reviewed_at = pg_catalog.now()
     WHERE id = p_lesson_id AND status = 'pending_review';
    IF NOT FOUND THEN RAISE EXCEPTION 'Pending lesson not found.'; END IF;

    RETURN pg_catalog.jsonb_build_object('success', TRUE, 'lesson_id', p_lesson_id, 'status', v_new_status);
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_course_assignment_for_review(p_assignment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_status TEXT;
    v_course_status TEXT;
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
    SELECT a.status, c.status INTO v_status, v_course_status
      FROM public.course_assignments AS a JOIN public.courses AS c ON c.id = a.course_id
     WHERE a.id = p_assignment_id AND a.creator_id = v_uid FOR UPDATE OF a;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found or not owned by you.'; END IF;
    IF v_course_status <> 'published' THEN RAISE EXCEPTION 'Publish the course before submitting its assignment.'; END IF;
    IF v_status NOT IN ('draft', 'rejected') THEN RAISE EXCEPTION 'Only draft or rejected assignments can be submitted.'; END IF;

    UPDATE public.course_assignments
       SET status = 'pending_review', review_note = NULL, reviewed_by = NULL, reviewed_at = NULL
     WHERE id = p_assignment_id;
    RETURN pg_catalog.jsonb_build_object('success', TRUE, 'assignment_id', p_assignment_id, 'status', 'pending_review');
END;
$function$;

CREATE OR REPLACE FUNCTION public.review_course_assignment(p_assignment_id UUID, p_decision TEXT, p_note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_new_status TEXT;
BEGIN
    IF v_uid IS NULL OR NOT public.is_smartnekam_moderator() THEN RAISE EXCEPTION 'Moderator permission required.'; END IF;
    IF p_decision NOT IN ('approve', 'reject') THEN RAISE EXCEPTION 'Decision must be approve or reject.'; END IF;
    IF p_note IS NOT NULL AND length(p_note) > 3000 THEN RAISE EXCEPTION 'Review note is too long.'; END IF;

    v_new_status := CASE WHEN p_decision = 'approve' THEN 'published' ELSE 'rejected' END;
    UPDATE public.course_assignments
       SET status = v_new_status,
           review_note = NULLIF(pg_catalog.btrim(COALESCE(p_note, '')), ''),
           reviewed_by = v_uid,
           reviewed_at = pg_catalog.now()
     WHERE id = p_assignment_id AND status = 'pending_review';
    IF NOT FOUND THEN RAISE EXCEPTION 'Pending assignment not found.'; END IF;

    RETURN pg_catalog.jsonb_build_object('success', TRUE, 'assignment_id', p_assignment_id, 'status', v_new_status);
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_course_assignment(
    p_assignment_id UUID,
    p_response_text TEXT DEFAULT '',
    p_file_path TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_course_id UUID;
    v_due_at TIMESTAMPTZ;
    v_allow_late BOOLEAN;
    v_allow_resubmission BOOLEAN;
    v_submission_status TEXT;
    v_submission_id UUID;
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
    IF length(COALESCE(p_response_text, '')) > 20000 THEN RAISE EXCEPTION 'Response text is too long.'; END IF;

    SELECT a.course_id, a.due_at, a.allow_late_submissions, a.allow_resubmission
      INTO v_course_id, v_due_at, v_allow_late, v_allow_resubmission
      FROM public.course_assignments AS a
      JOIN public.courses AS c ON c.id = a.course_id
     WHERE a.id = p_assignment_id AND a.status = 'published' AND c.status = 'published';
    IF NOT FOUND THEN RAISE EXCEPTION 'Published assignment not found.'; END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.course_enrollments AS e
         WHERE e.course_id = v_course_id AND e.student_id = v_uid AND e.status = 'active'
    ) THEN RAISE EXCEPTION 'An active course enrollment is required.'; END IF;

    IF v_due_at IS NOT NULL AND v_due_at < pg_catalog.now() AND NOT v_allow_late THEN
        RAISE EXCEPTION 'The assignment deadline has passed.';
    END IF;
    IF p_file_path IS NOT NULL AND (
        pg_catalog.split_part(p_file_path, '/', 1) <> p_assignment_id::TEXT OR
        pg_catalog.split_part(p_file_path, '/', 2) <> v_uid::TEXT OR
        pg_catalog.length(p_file_path) > 1000
    ) THEN RAISE EXCEPTION 'File path must follow <assignment_id>/<your_user_id>/<filename>.'; END IF;

    SELECT s.status INTO v_submission_status
      FROM public.course_assignment_submissions AS s
     WHERE s.assignment_id = p_assignment_id AND s.student_id = v_uid;
    IF v_submission_status IS NOT NULL AND NOT v_allow_resubmission THEN
        RAISE EXCEPTION 'This assignment does not allow resubmission.';
    END IF;

    INSERT INTO public.course_assignment_submissions
        (assignment_id, course_id, creator_id, student_id, response_text, file_path, submitted_at, status, score, feedback, graded_by, graded_at)
    VALUES (
        p_assignment_id, v_course_id,
        (SELECT a.creator_id FROM public.course_assignments AS a WHERE a.id = p_assignment_id),
        v_uid, COALESCE(p_response_text, ''), p_file_path, pg_catalog.now(),
        CASE WHEN v_due_at IS NOT NULL AND v_due_at < pg_catalog.now() THEN 'late' ELSE 'submitted' END,
        NULL, NULL, NULL, NULL
    )
    ON CONFLICT (assignment_id, student_id) DO UPDATE
       SET response_text = EXCLUDED.response_text,
           file_path = EXCLUDED.file_path,
           submitted_at = EXCLUDED.submitted_at,
           status = EXCLUDED.status,
           score = NULL,
           feedback = NULL,
           graded_by = NULL,
           graded_at = NULL,
           updated_at = pg_catalog.now()
     WHERE v_allow_resubmission = TRUE
    RETURNING id INTO v_submission_id;

    IF v_submission_id IS NULL THEN RAISE EXCEPTION 'Submission already exists and cannot be resubmitted.'; END IF;
    RETURN v_submission_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.grade_course_assignment(
    p_submission_id UUID,
    p_score NUMERIC,
    p_feedback TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_creator_id UUID;
    v_max_score NUMERIC;
    v_course_id UUID;
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
    SELECT a.creator_id, a.max_score, a.course_id
      INTO v_creator_id, v_max_score, v_course_id
      FROM public.course_assignment_submissions AS s
      JOIN public.course_assignments AS a ON a.id = s.assignment_id
     WHERE s.id = p_submission_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found.'; END IF;
    IF v_creator_id <> v_uid AND NOT public.is_smartnekam_moderator() THEN
        RAISE EXCEPTION 'Only the course teacher or a moderator can grade this submission.';
    END IF;
    IF p_score IS NULL OR p_score < 0 OR p_score > v_max_score THEN
        RAISE EXCEPTION 'Score must be between 0 and the assignment maximum.';
    END IF;
    IF p_feedback IS NOT NULL AND length(p_feedback) > 10000 THEN RAISE EXCEPTION 'Feedback is too long.'; END IF;

    UPDATE public.course_assignment_submissions
       SET score = p_score,
           feedback = NULLIF(pg_catalog.btrim(COALESCE(p_feedback, '')), ''),
           status = 'graded',
           graded_by = v_uid,
           graded_at = pg_catalog.now()
     WHERE id = p_submission_id;

    RETURN pg_catalog.jsonb_build_object('success', TRUE, 'submission_id', p_submission_id, 'score', p_score);
END;
$function$;

-- -----------------------------------------------------------------------------
-- 4. Row Level Security
-- -----------------------------------------------------------------------------
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_assignment_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS courses_select_published_or_owner ON public.courses;
CREATE POLICY courses_select_published_or_owner ON public.courses
FOR SELECT TO anon, authenticated
USING (status = 'published' OR creator_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS courses_select_moderator ON public.courses;
CREATE POLICY courses_select_moderator ON public.courses
FOR SELECT TO authenticated USING (public.is_smartnekam_moderator());
DROP POLICY IF EXISTS courses_insert_eligible_creator ON public.courses;
CREATE POLICY courses_insert_eligible_creator ON public.courses
FOR INSERT TO authenticated
WITH CHECK (
    creator_id = (SELECT auth.uid())
    AND status = 'draft'
    AND EXISTS (
        SELECT 1 FROM public.profiles AS p
         WHERE p.id = (SELECT auth.uid())
           AND p.role IN ('teacher', 'mentor', 'school_admin', 'super_admin')
           AND p.status = 'active'
    )
);
DROP POLICY IF EXISTS courses_update_owner_draft ON public.courses;
CREATE POLICY courses_update_owner_draft ON public.courses
FOR UPDATE TO authenticated
USING (creator_id = (SELECT auth.uid()) AND status IN ('draft', 'rejected'))
WITH CHECK (creator_id = (SELECT auth.uid()) AND status IN ('draft', 'rejected'));
DROP POLICY IF EXISTS courses_delete_owner_draft ON public.courses;
CREATE POLICY courses_delete_owner_draft ON public.courses
FOR DELETE TO authenticated USING (creator_id = (SELECT auth.uid()) AND status IN ('draft', 'rejected'));

DROP POLICY IF EXISTS course_modules_select_visible ON public.course_modules;
CREATE POLICY course_modules_select_visible ON public.course_modules
FOR SELECT TO anon, authenticated
USING (
    EXISTS (SELECT 1 FROM public.courses AS c WHERE c.id = course_id AND c.status = 'published')
    OR creator_id = (SELECT auth.uid())
);
DROP POLICY IF EXISTS course_modules_select_moderator ON public.course_modules;
CREATE POLICY course_modules_select_moderator ON public.course_modules
FOR SELECT TO authenticated USING (public.is_smartnekam_moderator());
DROP POLICY IF EXISTS course_modules_insert_owner ON public.course_modules;
CREATE POLICY course_modules_insert_owner ON public.course_modules
FOR INSERT TO authenticated
WITH CHECK (
    creator_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.courses AS c WHERE c.id = course_id AND c.creator_id = (SELECT auth.uid()) AND c.status <> 'archived')
);
DROP POLICY IF EXISTS course_modules_update_owner ON public.course_modules;
CREATE POLICY course_modules_update_owner ON public.course_modules
FOR UPDATE TO authenticated
USING (creator_id = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.courses AS c WHERE c.id = course_id AND c.creator_id = (SELECT auth.uid()) AND c.status <> 'archived'))
WITH CHECK (creator_id = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.courses AS c WHERE c.id = course_id AND c.creator_id = (SELECT auth.uid()) AND c.status <> 'archived'));
DROP POLICY IF EXISTS course_modules_delete_owner ON public.course_modules;
CREATE POLICY course_modules_delete_owner ON public.course_modules
FOR DELETE TO authenticated USING (creator_id = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.courses AS c WHERE c.id = course_id AND c.creator_id = (SELECT auth.uid()) AND c.status <> 'published'));

DROP POLICY IF EXISTS course_lessons_select_preview ON public.course_lessons;
CREATE POLICY course_lessons_select_preview ON public.course_lessons
FOR SELECT TO anon, authenticated
USING (
    status = 'published' AND is_preview = TRUE
    AND EXISTS (SELECT 1 FROM public.courses AS c WHERE c.id = course_id AND c.status = 'published')
);
DROP POLICY IF EXISTS course_lessons_select_enrolled ON public.course_lessons;
CREATE POLICY course_lessons_select_enrolled ON public.course_lessons
FOR SELECT TO authenticated
USING (
    status = 'published'
    AND EXISTS (SELECT 1 FROM public.course_enrollments AS e WHERE e.course_id = course_id AND e.student_id = (SELECT auth.uid()) AND e.status = 'active')
);
DROP POLICY IF EXISTS course_lessons_select_owner ON public.course_lessons;
CREATE POLICY course_lessons_select_owner ON public.course_lessons
FOR SELECT TO authenticated USING (creator_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS course_lessons_select_moderator ON public.course_lessons;
CREATE POLICY course_lessons_select_moderator ON public.course_lessons
FOR SELECT TO authenticated USING (public.is_smartnekam_moderator());
DROP POLICY IF EXISTS course_lessons_insert_owner ON public.course_lessons;
CREATE POLICY course_lessons_insert_owner ON public.course_lessons
FOR INSERT TO authenticated WITH CHECK (
    creator_id = (SELECT auth.uid()) AND status = 'draft'
    AND EXISTS (SELECT 1 FROM public.courses AS c WHERE c.id = course_id AND c.creator_id = (SELECT auth.uid()) AND c.status <> 'archived')
);
DROP POLICY IF EXISTS course_lessons_update_draft_owner ON public.course_lessons;
CREATE POLICY course_lessons_update_draft_owner ON public.course_lessons
FOR UPDATE TO authenticated USING (creator_id = (SELECT auth.uid()) AND status IN ('draft', 'rejected'))
WITH CHECK (creator_id = (SELECT auth.uid()) AND status IN ('draft', 'rejected'));
DROP POLICY IF EXISTS course_lessons_delete_draft_owner ON public.course_lessons;
CREATE POLICY course_lessons_delete_draft_owner ON public.course_lessons
FOR DELETE TO authenticated USING (creator_id = (SELECT auth.uid()) AND status IN ('draft', 'rejected'));

DROP POLICY IF EXISTS course_enrollments_select_own_or_teacher ON public.course_enrollments;
CREATE POLICY course_enrollments_select_own_or_teacher ON public.course_enrollments
FOR SELECT TO authenticated USING (
    student_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.courses AS c WHERE c.id = course_id AND c.creator_id = (SELECT auth.uid()))
    OR public.is_smartnekam_moderator()
);

DROP POLICY IF EXISTS course_lesson_progress_select_own_or_teacher ON public.course_lesson_progress;
CREATE POLICY course_lesson_progress_select_own_or_teacher ON public.course_lesson_progress
FOR SELECT TO authenticated USING (
    student_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.courses AS c WHERE c.id = course_id AND c.creator_id = (SELECT auth.uid()))
    OR public.is_smartnekam_moderator()
);

DROP POLICY IF EXISTS course_assignments_select_enrolled_or_owner ON public.course_assignments;
CREATE POLICY course_assignments_select_enrolled_or_owner ON public.course_assignments
FOR SELECT TO authenticated USING (
    (status = 'published' AND EXISTS (
        SELECT 1 FROM public.course_enrollments AS e WHERE e.course_id = course_id AND e.student_id = (SELECT auth.uid()) AND e.status = 'active'
    ))
    OR creator_id = (SELECT auth.uid())
    OR public.is_smartnekam_moderator()
);
DROP POLICY IF EXISTS course_assignments_insert_owner_draft ON public.course_assignments;
CREATE POLICY course_assignments_insert_owner_draft ON public.course_assignments
FOR INSERT TO authenticated WITH CHECK (
    creator_id = (SELECT auth.uid()) AND status = 'draft'
    AND EXISTS (SELECT 1 FROM public.courses AS c WHERE c.id = course_id AND c.creator_id = (SELECT auth.uid()) AND c.status <> 'archived')
);
DROP POLICY IF EXISTS course_assignments_update_owner_draft ON public.course_assignments;
CREATE POLICY course_assignments_update_owner_draft ON public.course_assignments
FOR UPDATE TO authenticated USING (creator_id = (SELECT auth.uid()) AND status IN ('draft', 'rejected'))
WITH CHECK (creator_id = (SELECT auth.uid()) AND status IN ('draft', 'rejected'));
DROP POLICY IF EXISTS course_assignments_delete_owner_draft ON public.course_assignments;
CREATE POLICY course_assignments_delete_owner_draft ON public.course_assignments
FOR DELETE TO authenticated USING (creator_id = (SELECT auth.uid()) AND status IN ('draft', 'rejected'));

DROP POLICY IF EXISTS course_assignment_submissions_select_student_or_teacher ON public.course_assignment_submissions;
CREATE POLICY course_assignment_submissions_select_student_or_teacher ON public.course_assignment_submissions
FOR SELECT TO authenticated USING (
    student_id = (SELECT auth.uid())
    OR creator_id = (SELECT auth.uid())
    OR public.is_smartnekam_moderator()
);

-- -----------------------------------------------------------------------------
-- 5. Private Storage buckets and path-based policies
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('smartnekam-course-assets', 'smartnekam-course-assets', FALSE, 52428800,
     ARRAY['application/pdf', 'image/jpeg', 'image/png', 'video/mp4', 'video/webm', 'text/plain',
           'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
           'application/vnd.openxmlformats-officedocument.presentationml.presentation']),
    ('smartnekam-assignment-submissions', 'smartnekam-assignment-submissions', FALSE, 26214400,
     ARRAY['application/pdf', 'image/jpeg', 'image/png', 'text/plain', 'application/msword',
           'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
           'application/vnd.openxmlformats-officedocument.presentationml.presentation'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS smartnekam_course_assets_select_allowed ON storage.objects;
CREATE POLICY smartnekam_course_assets_select_allowed ON storage.objects
FOR SELECT TO authenticated USING (
    bucket_id = 'smartnekam-course-assets'
    AND (
        EXISTS (
            SELECT 1 FROM public.courses AS c
             WHERE c.id::text = split_part(name, '/', 1)
               AND c.creator_id = (SELECT auth.uid())
        )
        OR EXISTS (
            SELECT 1
              FROM public.course_lessons AS l
              JOIN public.courses AS c ON c.id = l.course_id
             WHERE l.resource_path = name
               AND l.status = 'published' AND c.status = 'published'
               AND (
                    l.is_preview = TRUE
                    OR EXISTS (SELECT 1 FROM public.course_enrollments AS e WHERE e.course_id = c.id AND e.student_id = (SELECT auth.uid()) AND e.status = 'active')
               )
        )
        OR public.is_smartnekam_moderator()
    )
);
DROP POLICY IF EXISTS smartnekam_course_assets_insert_owner ON storage.objects;
CREATE POLICY smartnekam_course_assets_insert_owner ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'smartnekam-course-assets'
    AND EXISTS (
        SELECT 1 FROM public.courses AS c
         WHERE c.id::text = split_part(name, '/', 1)
           AND c.creator_id = (SELECT auth.uid())
           AND c.status <> 'archived'
    )
);
DROP POLICY IF EXISTS smartnekam_course_assets_update_owner ON storage.objects;
CREATE POLICY smartnekam_course_assets_update_owner ON storage.objects
FOR UPDATE TO authenticated USING (
    bucket_id = 'smartnekam-course-assets'
    AND EXISTS (SELECT 1 FROM public.courses AS c WHERE c.id::text = split_part(name, '/', 1) AND c.creator_id = (SELECT auth.uid()))
) WITH CHECK (
    bucket_id = 'smartnekam-course-assets'
    AND EXISTS (SELECT 1 FROM public.courses AS c WHERE c.id::text = split_part(name, '/', 1) AND c.creator_id = (SELECT auth.uid()))
);
DROP POLICY IF EXISTS smartnekam_course_assets_delete_owner ON storage.objects;
CREATE POLICY smartnekam_course_assets_delete_owner ON storage.objects
FOR DELETE TO authenticated USING (
    bucket_id = 'smartnekam-course-assets'
    AND EXISTS (SELECT 1 FROM public.courses AS c WHERE c.id::text = split_part(name, '/', 1) AND c.creator_id = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS smartnekam_assignment_submissions_select_allowed ON storage.objects;
CREATE POLICY smartnekam_assignment_submissions_select_allowed ON storage.objects
FOR SELECT TO authenticated USING (
    bucket_id = 'smartnekam-assignment-submissions'
    AND (
        split_part(name, '/', 2) = (SELECT auth.uid())::text
        OR EXISTS (
            SELECT 1 FROM public.course_assignments AS a
            JOIN public.courses AS c ON c.id = a.course_id
            WHERE a.id::text = split_part(name, '/', 1) AND c.creator_id = (SELECT auth.uid())
        )
        OR public.is_smartnekam_moderator()
    )
);
DROP POLICY IF EXISTS smartnekam_assignment_submissions_insert_enrolled ON storage.objects;
CREATE POLICY smartnekam_assignment_submissions_insert_enrolled ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'smartnekam-assignment-submissions'
    AND split_part(name, '/', 2) = (SELECT auth.uid())::text
    AND EXISTS (
        SELECT 1
          FROM public.course_assignments AS a
          JOIN public.course_enrollments AS e ON e.course_id = a.course_id
         WHERE a.id::text = split_part(name, '/', 1)
           AND a.status = 'published'
           AND e.student_id = (SELECT auth.uid()) AND e.status = 'active'
           AND (a.due_at IS NULL OR a.due_at >= pg_catalog.now() OR a.allow_late_submissions = TRUE)
    )
);
DROP POLICY IF EXISTS smartnekam_assignment_submissions_update_owner ON storage.objects;
CREATE POLICY smartnekam_assignment_submissions_update_owner ON storage.objects
FOR UPDATE TO authenticated USING (
    bucket_id = 'smartnekam-assignment-submissions'
    AND split_part(name, '/', 2) = (SELECT auth.uid())::text
) WITH CHECK (
    bucket_id = 'smartnekam-assignment-submissions'
    AND split_part(name, '/', 2) = (SELECT auth.uid())::text
);
DROP POLICY IF EXISTS smartnekam_assignment_submissions_delete_owner ON storage.objects;
CREATE POLICY smartnekam_assignment_submissions_delete_owner ON storage.objects
FOR DELETE TO authenticated USING (
    bucket_id = 'smartnekam-assignment-submissions'
    AND (
        split_part(name, '/', 2) = (SELECT auth.uid())::text
        OR EXISTS (
            SELECT 1 FROM public.course_assignments AS a
            JOIN public.courses AS c ON c.id = a.course_id
            WHERE a.id::text = split_part(name, '/', 1) AND c.creator_id = (SELECT auth.uid())
        )
    )
);

-- -----------------------------------------------------------------------------
-- 6. Least-privilege grants and RPC execution
-- -----------------------------------------------------------------------------
REVOKE ALL PRIVILEGES ON TABLE public.courses, public.course_modules, public.course_lessons,
    public.course_enrollments, public.course_lesson_progress,
    public.course_assignments, public.course_assignment_submissions
FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON TABLE public.courses TO anon, authenticated;
GRANT INSERT (creator_id, subject_id, title, description, level, language, access_type, price, currency, thumbnail_url, estimated_minutes)
    ON TABLE public.courses TO authenticated;
GRANT UPDATE (subject_id, title, description, level, language, access_type, price, currency, thumbnail_url, estimated_minutes)
    ON TABLE public.courses TO authenticated;
GRANT DELETE ON TABLE public.courses TO authenticated;

GRANT SELECT ON TABLE public.course_modules TO anon, authenticated;
GRANT INSERT (course_id, creator_id, title, description, position) ON TABLE public.course_modules TO authenticated;
GRANT UPDATE (title, description, position) ON TABLE public.course_modules TO authenticated;
GRANT DELETE ON TABLE public.course_modules TO authenticated;

GRANT SELECT ON TABLE public.course_lessons TO anon, authenticated;
GRANT INSERT (course_id, module_id, creator_id, title, description, lesson_type, content, video_url, resource_path, duration_seconds, position, is_preview)
    ON TABLE public.course_lessons TO authenticated;
GRANT UPDATE (title, description, lesson_type, content, video_url, resource_path, duration_seconds, position, is_preview)
    ON TABLE public.course_lessons TO authenticated;
GRANT DELETE ON TABLE public.course_lessons TO authenticated;

GRANT SELECT ON TABLE public.course_enrollments TO authenticated;
GRANT SELECT ON TABLE public.course_lesson_progress TO authenticated;
GRANT SELECT ON TABLE public.course_assignments TO authenticated;
GRANT INSERT (course_id, creator_id, module_id, title, instructions, attachment_path, due_at, max_score, allow_late_submissions, allow_resubmission)
    ON TABLE public.course_assignments TO authenticated;
GRANT UPDATE (module_id, title, instructions, attachment_path, due_at, max_score, allow_late_submissions, allow_resubmission)
    ON TABLE public.course_assignments TO authenticated;
GRANT DELETE ON TABLE public.course_assignments TO authenticated;
GRANT SELECT ON TABLE public.course_assignment_submissions TO authenticated;

REVOKE ALL PRIVILEGES ON FUNCTION public.enroll_in_course(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.record_course_lesson_progress(UUID, INTEGER, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.submit_course_for_review(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.review_course(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.submit_course_lesson_for_review(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.review_course_lesson(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.submit_course_assignment_for_review(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.review_course_assignment(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.submit_course_assignment(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.grade_course_assignment(UUID, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enroll_in_course(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_course_lesson_progress(UUID, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_course_for_review(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_course(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_course_lesson_for_review(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_course_lesson(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_course_assignment_for_review(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_course_assignment(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_course_assignment(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grade_course_assignment(UUID, NUMERIC, TEXT) TO authenticated;

COMMIT;

-- Expected result: Success. No rows returned.
-- Important: this migration creates the database foundation. Video delivery, scheduled reminders,
-- and paid course enrollment require frontend/provider integration in later stages.

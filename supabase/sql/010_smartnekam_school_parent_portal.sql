-- SmartNekam | SQL 010: School Dashboard and Parent Portal
-- Prerequisites: SQL 001A-001B and SQL 002-009 must have completed successfully.
-- Run this ENTIRE file in Supabase Dashboard > SQL Editor > New query.
-- This migration is re-runnable during development and does not delete existing data.

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Small integrity safeguard: a user must not grant themselves staff roles.
-- Role assignment remains an admin-only operation (SQL 007).
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 1. School classes and class membership
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
    class_name VARCHAR(120) NOT NULL,
    level VARCHAR(30) NOT NULL,
    form_or_year VARCHAR(30),
    stream VARCHAR(50),
    academic_year VARCHAR(20) NOT NULL,
    class_teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    capacity INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT school_classes_name_not_blank CHECK (length(btrim(class_name)) > 0),
    CONSTRAINT school_classes_year_not_blank CHECK (length(btrim(academic_year)) > 0),
    CONSTRAINT school_classes_level_check CHECK (level IN ('O_LEVEL', 'A_LEVEL', 'UNIVERSITY')),
    CONSTRAINT school_classes_capacity_check CHECK (capacity IS NULL OR capacity > 0),
    CONSTRAINT school_classes_status_check CHECK (status IN ('active', 'archived')),
    CONSTRAINT school_classes_school_name_year_unique UNIQUE (school_id, class_name, academic_year)
);

CREATE INDEX IF NOT EXISTS school_classes_school_year_idx
    ON public.school_classes (school_id, academic_year, status);
CREATE INDEX IF NOT EXISTS school_classes_teacher_idx
    ON public.school_classes (class_teacher_id) WHERE class_teacher_id IS NOT NULL;

DROP TRIGGER IF EXISTS school_classes_set_updated_at ON public.school_classes;
CREATE TRIGGER school_classes_set_updated_at
BEFORE UPDATE ON public.school_classes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.class_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.school_classes(id) ON DELETE CASCADE,
    student_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    enrollment_status VARCHAR(20) NOT NULL DEFAULT 'active',
    enrolled_by UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE RESTRICT,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT class_memberships_status_check CHECK (enrollment_status IN ('active', 'completed', 'withdrawn')),
    CONSTRAINT class_memberships_class_student_unique UNIQUE (class_id, student_profile_id)
);

CREATE INDEX IF NOT EXISTS class_memberships_student_status_idx
    ON public.class_memberships (student_profile_id, enrollment_status);
CREATE INDEX IF NOT EXISTS class_memberships_class_status_idx
    ON public.class_memberships (class_id, enrollment_status);

DROP TRIGGER IF EXISTS class_memberships_set_updated_at ON public.class_memberships;
CREATE TRIGGER class_memberships_set_updated_at
BEFORE UPDATE ON public.class_memberships
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Parent-to-student links. A parent receives academic visibility only after
-- the student approves the relationship. Links can be revoked by either party.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parent_student_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    relationship_type VARCHAR(40),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT parent_student_links_not_self CHECK (parent_profile_id <> student_profile_id),
    CONSTRAINT parent_student_links_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'revoked')),
    CONSTRAINT parent_student_links_pair_unique UNIQUE (parent_profile_id, student_profile_id)
);

CREATE INDEX IF NOT EXISTS parent_student_links_parent_status_idx
    ON public.parent_student_links (parent_profile_id, status);
CREATE INDEX IF NOT EXISTS parent_student_links_student_status_idx
    ON public.parent_student_links (student_profile_id, status);

-- -----------------------------------------------------------------------------
-- 3. School announcements
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.school_classes(id) ON DELETE CASCADE,
    created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE RESTRICT,
    title VARCHAR(180) NOT NULL,
    body TEXT NOT NULL,
    audience VARCHAR(20) NOT NULL DEFAULT 'school',
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    publish_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT school_announcements_title_not_blank CHECK (length(btrim(title)) > 0),
    CONSTRAINT school_announcements_body_not_blank CHECK (length(btrim(body)) > 0),
    CONSTRAINT school_announcements_audience_check CHECK (audience IN ('school', 'class', 'students', 'parents', 'teachers', 'all')),
    CONSTRAINT school_announcements_status_check CHECK (status IN ('draft', 'published', 'archived')),
    CONSTRAINT school_announcements_class_audience_check CHECK (class_id IS NULL OR audience = 'class')
);

CREATE INDEX IF NOT EXISTS school_announcements_school_publish_idx
    ON public.school_announcements (school_id, status, publish_at DESC);
CREATE INDEX IF NOT EXISTS school_announcements_class_publish_idx
    ON public.school_announcements (class_id, status, publish_at DESC)
    WHERE class_id IS NOT NULL;

DROP TRIGGER IF EXISTS school_announcements_set_updated_at ON public.school_announcements;
CREATE TRIGGER school_announcements_set_updated_at
BEFORE UPDATE ON public.school_announcements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Attendance records
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.school_classes(id) ON DELETE CASCADE,
    student_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    attendance_status VARCHAR(20) NOT NULL,
    note TEXT,
    marked_by UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE RESTRICT,
    marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT attendance_records_status_check CHECK (attendance_status IN ('present', 'absent', 'late', 'excused')),
    CONSTRAINT attendance_records_class_student_date_unique UNIQUE (class_id, student_profile_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS attendance_records_student_date_idx
    ON public.attendance_records (student_profile_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS attendance_records_class_date_idx
    ON public.attendance_records (class_id, attendance_date DESC);

DROP TRIGGER IF EXISTS attendance_records_set_updated_at ON public.attendance_records;
CREATE TRIGGER attendance_records_set_updated_at
BEFORE UPDATE ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. Student progress reports and per-subject results
-- Parent can read only reports that school staff explicitly published to parents.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_progress_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
    class_id UUID REFERENCES public.school_classes(id) ON DELETE SET NULL,
    student_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    academic_year VARCHAR(20) NOT NULL,
    term_name VARCHAR(60) NOT NULL,
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    overall_grade VARCHAR(20),
    average_score NUMERIC(5,2),
    teacher_comment TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    published_to_parent BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT student_progress_reports_status_check CHECK (status IN ('draft', 'published')),
    CONSTRAINT student_progress_reports_average_check CHECK (average_score IS NULL OR (average_score >= 0 AND average_score <= 100)),
    CONSTRAINT student_progress_reports_year_not_blank CHECK (length(btrim(academic_year)) > 0),
    CONSTRAINT student_progress_reports_term_not_blank CHECK (length(btrim(term_name)) > 0),
    CONSTRAINT student_progress_reports_student_term_unique UNIQUE (student_profile_id, academic_year, term_name)
);

CREATE INDEX IF NOT EXISTS student_progress_reports_student_date_idx
    ON public.student_progress_reports (student_profile_id, report_date DESC);
CREATE INDEX IF NOT EXISTS student_progress_reports_school_term_idx
    ON public.student_progress_reports (school_id, academic_year, term_name);

DROP TRIGGER IF EXISTS student_progress_reports_set_updated_at ON public.student_progress_reports;
CREATE TRIGGER student_progress_reports_set_updated_at
BEFORE UPDATE ON public.student_progress_reports
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.student_report_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.student_progress_reports(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    subject_name VARCHAR(120) NOT NULL,
    marks NUMERIC(5,2),
    grade VARCHAR(20),
    teacher_comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT student_report_subjects_name_not_blank CHECK (length(btrim(subject_name)) > 0),
    CONSTRAINT student_report_subjects_marks_check CHECK (marks IS NULL OR (marks >= 0 AND marks <= 100)),
    CONSTRAINT student_report_subjects_report_name_unique UNIQUE (report_id, subject_name)
);

CREATE INDEX IF NOT EXISTS student_report_subjects_report_idx
    ON public.student_report_subjects (report_id);

DROP TRIGGER IF EXISTS student_report_subjects_set_updated_at ON public.student_report_subjects;
CREATE TRIGGER student_report_subjects_set_updated_at
BEFORE UPDATE ON public.student_report_subjects
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. Security-definer helpers used in RLS policies. search_path is empty and all
-- relations are schema-qualified to reduce search-path/function hijacking risk.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_smartnekam_school_staff(p_school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = (SELECT auth.uid())
          AND p.status = 'active'
          AND (
              p.role = 'super_admin'
              OR (p.role IN ('school_admin', 'teacher') AND p.school_id = p_school_id)
          )
    );
$function$;

CREATE OR REPLACE FUNCTION public.is_smartnekam_parent_of_student(p_student_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.parent_student_links AS l
        JOIN public.profiles AS p ON p.id = l.parent_profile_id
        WHERE l.parent_profile_id = (SELECT auth.uid())
          AND l.student_profile_id = p_student_profile_id
          AND l.status = 'approved'
          AND p.role = 'parent'
          AND p.status = 'active'
    );
$function$;

CREATE OR REPLACE FUNCTION public.is_smartnekam_teacher_in_school(
    p_teacher_profile_id UUID,
    p_school_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles AS p
        WHERE public.is_smartnekam_school_staff(p_school_id)
          AND p.id = p_teacher_profile_id
          AND p.role = 'teacher'
          AND p.status = 'active'
          AND p.school_id = p_school_id
    );
$function$;

CREATE OR REPLACE FUNCTION public.is_smartnekam_active_student_in_school(
    p_student_profile_id UUID,
    p_school_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles AS p
        WHERE public.is_smartnekam_school_staff(p_school_id)
          AND p.id = p_student_profile_id
          AND p.role = 'student'
          AND p.status = 'active'
          AND p.school_id = p_school_id
    );
$function$;

CREATE OR REPLACE FUNCTION public.is_smartnekam_parent_of_school(p_school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.parent_student_links AS l
        JOIN public.profiles AS parent_profile ON parent_profile.id = l.parent_profile_id
        JOIN public.profiles AS student ON student.id = l.student_profile_id
        WHERE l.parent_profile_id = (SELECT auth.uid())
          AND l.status = 'approved'
          AND parent_profile.role = 'parent'
          AND parent_profile.status = 'active'
          AND student.role = 'student'
          AND student.status = 'active'
          AND student.school_id = p_school_id
    );
$function$;

CREATE OR REPLACE FUNCTION public.is_smartnekam_class_member(p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.class_memberships AS cm
        WHERE cm.class_id = p_class_id
          AND cm.student_profile_id = (SELECT auth.uid())
          AND cm.enrollment_status = 'active'
    );
$function$;

CREATE OR REPLACE FUNCTION public.is_smartnekam_parent_of_class_member(p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.class_memberships AS cm
        JOIN public.parent_student_links AS l
          ON l.student_profile_id = cm.student_profile_id
         AND l.status = 'approved'
        JOIN public.profiles AS parent_profile
          ON parent_profile.id = l.parent_profile_id
        WHERE cm.class_id = p_class_id
          AND cm.enrollment_status = 'active'
          AND l.parent_profile_id = (SELECT auth.uid())
          AND parent_profile.role = 'parent'
          AND parent_profile.status = 'active'
    );
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.is_smartnekam_school_staff(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.is_smartnekam_parent_of_student(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.is_smartnekam_teacher_in_school(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.is_smartnekam_active_student_in_school(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.is_smartnekam_parent_of_school(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.is_smartnekam_class_member(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.is_smartnekam_parent_of_class_member(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_smartnekam_school_staff(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_smartnekam_parent_of_student(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_smartnekam_teacher_in_school(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_smartnekam_active_student_in_school(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_smartnekam_parent_of_school(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_smartnekam_class_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_smartnekam_parent_of_class_member(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 7. Parent relationship RPCs. No direct client UPDATE is granted on link rows.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_parent_student_link(
    p_student_profile_id UUID,
    p_relationship_type TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_parent_id UUID := (SELECT auth.uid());
    v_parent_role TEXT;
    v_student_role TEXT;
    v_id UUID;
BEGIN
    IF v_parent_id IS NULL THEN
        RAISE EXCEPTION 'Authentication is required.';
    END IF;

    SELECT p.role INTO v_parent_role
    FROM public.profiles AS p
    WHERE p.id = v_parent_id AND p.status = 'active';

    IF v_parent_role IS DISTINCT FROM 'parent' THEN
        RAISE EXCEPTION 'Only an active parent account can request a parent-student link.';
    END IF;

    SELECT p.role INTO v_student_role
    FROM public.profiles AS p
    WHERE p.id = p_student_profile_id AND p.status = 'active';

    IF v_student_role IS DISTINCT FROM 'student' THEN
        RAISE EXCEPTION 'The selected profile is not an active student account.';
    END IF;

    IF p_relationship_type IS NOT NULL AND length(btrim(p_relationship_type)) > 40 THEN
        RAISE EXCEPTION 'Relationship type must be 40 characters or fewer.';
    END IF;

    INSERT INTO public.parent_student_links AS existing (
        parent_profile_id, student_profile_id, relationship_type, status
    ) VALUES (
        v_parent_id, p_student_profile_id, NULLIF(btrim(p_relationship_type), ''), 'pending'
    )
    ON CONFLICT (parent_profile_id, student_profile_id)
    DO UPDATE SET
        relationship_type = EXCLUDED.relationship_type,
        status = 'pending',
        requested_at = pg_catalog.now(),
        reviewed_at = NULL,
        reviewed_by = NULL
    WHERE existing.status IN ('rejected', 'revoked')
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
        SELECT l.id INTO v_id
        FROM public.parent_student_links AS l
        WHERE l.parent_profile_id = v_parent_id
          AND l.student_profile_id = p_student_profile_id;
    END IF;

    RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.respond_to_parent_student_link(
    p_link_id UUID,
    p_decision TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_student_id UUID := (SELECT auth.uid());
    v_role TEXT;
BEGIN
    IF p_decision IS NULL OR p_decision NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Decision must be approved or rejected.';
    END IF;

    SELECT p.role INTO v_role
    FROM public.profiles AS p
    WHERE p.id = v_student_id AND p.status = 'active';

    IF v_role IS DISTINCT FROM 'student' THEN
        RAISE EXCEPTION 'Only an active student account can respond to this request.';
    END IF;

    UPDATE public.parent_student_links AS l
       SET status = p_decision,
           reviewed_at = pg_catalog.now(),
           reviewed_by = v_student_id
     WHERE l.id = p_link_id
       AND l.student_profile_id = v_student_id
       AND l.status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pending parent-student request was not found for this student.';
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_parent_student_link(p_link_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_user_id UUID := (SELECT auth.uid());
BEGIN
    UPDATE public.parent_student_links AS l
       SET status = 'revoked',
           reviewed_at = pg_catalog.now(),
           reviewed_by = v_user_id
     WHERE l.id = p_link_id
       AND v_user_id IN (l.parent_profile_id, l.student_profile_id)
       AND l.status IN ('pending', 'approved');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active parent-student link was not found for this account.';
    END IF;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.request_parent_student_link(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.respond_to_parent_student_link(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.revoke_parent_student_link(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_parent_student_link(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_parent_student_link(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_parent_student_link(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 8. RLS policies
-- -----------------------------------------------------------------------------
ALTER TABLE public.school_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_progress_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_report_subjects ENABLE ROW LEVEL SECURITY;

-- School classes
DROP POLICY IF EXISTS school_classes_select_authorized ON public.school_classes;
CREATE POLICY school_classes_select_authorized ON public.school_classes
FOR SELECT TO authenticated
USING (
    public.is_smartnekam_school_staff(school_id)
    OR public.is_smartnekam_class_member(id)
    OR public.is_smartnekam_parent_of_class_member(id)
);

DROP POLICY IF EXISTS school_classes_insert_school_staff ON public.school_classes;
CREATE POLICY school_classes_insert_school_staff ON public.school_classes
FOR INSERT TO authenticated
WITH CHECK (
    public.is_smartnekam_school_staff(school_id)
    AND created_by = (SELECT auth.uid())
    AND (
        class_teacher_id IS NULL
        OR public.is_smartnekam_teacher_in_school(class_teacher_id, school_classes.school_id)
    )
);

DROP POLICY IF EXISTS school_classes_update_school_staff ON public.school_classes;
CREATE POLICY school_classes_update_school_staff ON public.school_classes
FOR UPDATE TO authenticated
USING (public.is_smartnekam_school_staff(school_id))
WITH CHECK (
    public.is_smartnekam_school_staff(school_id)
    AND (
        class_teacher_id IS NULL
        OR public.is_smartnekam_teacher_in_school(class_teacher_id, school_classes.school_id)
    )
);

-- Membership rows: students and approved parents can view only their relationship.
DROP POLICY IF EXISTS class_memberships_select_authorized ON public.class_memberships;
CREATE POLICY class_memberships_select_authorized ON public.class_memberships
FOR SELECT TO authenticated
USING (
    student_profile_id = (SELECT auth.uid())
    OR public.is_smartnekam_school_staff((
        SELECT c.school_id FROM public.school_classes AS c WHERE c.id = class_id
    ))
    OR public.is_smartnekam_parent_of_student(student_profile_id)
);

DROP POLICY IF EXISTS class_memberships_insert_school_staff ON public.class_memberships;
CREATE POLICY class_memberships_insert_school_staff ON public.class_memberships
FOR INSERT TO authenticated
WITH CHECK (
    enrolled_by = (SELECT auth.uid())
    AND public.is_smartnekam_school_staff((
        SELECT c.school_id FROM public.school_classes AS c WHERE c.id = class_id
    ))
    AND public.is_smartnekam_active_student_in_school(
        student_profile_id,
        (SELECT c.school_id FROM public.school_classes AS c WHERE c.id = class_memberships.class_id)
    )
);

DROP POLICY IF EXISTS class_memberships_update_school_staff ON public.class_memberships;
CREATE POLICY class_memberships_update_school_staff ON public.class_memberships
FOR UPDATE TO authenticated
USING (
    public.is_smartnekam_school_staff((
        SELECT c.school_id FROM public.school_classes AS c WHERE c.id = class_id
    ))
)
WITH CHECK (
    public.is_smartnekam_school_staff((
        SELECT c.school_id FROM public.school_classes AS c WHERE c.id = class_id
    ))
);

-- Parent-student links are visible only to either party; status changes use RPCs.
DROP POLICY IF EXISTS parent_student_links_select_participants ON public.parent_student_links;
CREATE POLICY parent_student_links_select_participants ON public.parent_student_links
FOR SELECT TO authenticated
USING (
    parent_profile_id = (SELECT auth.uid())
    OR student_profile_id = (SELECT auth.uid())
);

-- Announcements: staff can manage their school's records; students/parents see
-- only published announcements targeted to their school/class and audience.
DROP POLICY IF EXISTS school_announcements_select_targeted ON public.school_announcements;
CREATE POLICY school_announcements_select_targeted ON public.school_announcements
FOR SELECT TO authenticated
USING (
    public.is_smartnekam_school_staff(school_id)
    OR (
        status = 'published'
        AND publish_at <= pg_catalog.now()
        AND (
            (
                class_id IS NULL
                AND audience IN ('school', 'students', 'all')
                AND EXISTS (
                    SELECT 1 FROM public.profiles AS s
                    WHERE s.id = (SELECT auth.uid())
                      AND s.status = 'active'
                      AND s.role = 'student'
                      AND s.school_id = school_announcements.school_id
                )
            )
            OR (
                class_id IS NOT NULL
                AND audience = 'class'
                AND (
                    public.is_smartnekam_class_member(class_id)
                    OR public.is_smartnekam_parent_of_class_member(class_id)
                )
            )
            OR (
                audience IN ('parents', 'all', 'school')
                AND public.is_smartnekam_parent_of_school(school_announcements.school_id)
            )
            OR (
                audience IN ('teachers', 'all', 'school')
                AND EXISTS (
                    SELECT 1 FROM public.profiles AS staff
                    WHERE staff.id = (SELECT auth.uid())
                      AND staff.role = 'teacher'
                      AND staff.status = 'active'
                      AND staff.school_id = school_announcements.school_id
                )
            )
        )
    )
);

DROP POLICY IF EXISTS school_announcements_insert_school_staff ON public.school_announcements;
CREATE POLICY school_announcements_insert_school_staff ON public.school_announcements
FOR INSERT TO authenticated
WITH CHECK (
    public.is_smartnekam_school_staff(school_id)
    AND created_by = (SELECT auth.uid())
    AND (
        class_id IS NULL
        OR EXISTS (
            SELECT 1 FROM public.school_classes AS c
            WHERE c.id = class_id AND c.school_id = school_announcements.school_id
        )
    )
);

DROP POLICY IF EXISTS school_announcements_update_school_staff ON public.school_announcements;
CREATE POLICY school_announcements_update_school_staff ON public.school_announcements
FOR UPDATE TO authenticated
USING (public.is_smartnekam_school_staff(school_id))
WITH CHECK (
    public.is_smartnekam_school_staff(school_id)
    AND (
        class_id IS NULL
        OR EXISTS (
            SELECT 1 FROM public.school_classes AS c
            WHERE c.id = class_id AND c.school_id = school_announcements.school_id
        )
    )
);

-- Attendance: students see their own; an approved parent sees the linked child;
-- only school staff can create/update attendance for class members in that school.
DROP POLICY IF EXISTS attendance_records_select_authorized ON public.attendance_records;
CREATE POLICY attendance_records_select_authorized ON public.attendance_records
FOR SELECT TO authenticated
USING (
    student_profile_id = (SELECT auth.uid())
    OR public.is_smartnekam_parent_of_student(student_profile_id)
    OR public.is_smartnekam_school_staff((
        SELECT c.school_id FROM public.school_classes AS c WHERE c.id = class_id
    ))
);

DROP POLICY IF EXISTS attendance_records_insert_school_staff ON public.attendance_records;
CREATE POLICY attendance_records_insert_school_staff ON public.attendance_records
FOR INSERT TO authenticated
WITH CHECK (
    marked_by = (SELECT auth.uid())
    AND public.is_smartnekam_school_staff((
        SELECT c.school_id FROM public.school_classes AS c WHERE c.id = class_id
    ))
    AND EXISTS (
        SELECT 1 FROM public.class_memberships AS cm
        WHERE cm.class_id = attendance_records.class_id
          AND cm.student_profile_id = attendance_records.student_profile_id
          AND cm.enrollment_status = 'active'
    )
);

DROP POLICY IF EXISTS attendance_records_update_school_staff ON public.attendance_records;
CREATE POLICY attendance_records_update_school_staff ON public.attendance_records
FOR UPDATE TO authenticated
USING (public.is_smartnekam_school_staff((
    SELECT c.school_id FROM public.school_classes AS c WHERE c.id = class_id
)))
WITH CHECK (
    public.is_smartnekam_school_staff((
        SELECT c.school_id FROM public.school_classes AS c WHERE c.id = class_id
    ))
    AND EXISTS (
        SELECT 1 FROM public.class_memberships AS cm
        WHERE cm.class_id = attendance_records.class_id
          AND cm.student_profile_id = attendance_records.student_profile_id
          AND cm.enrollment_status = 'active'
    )
);

-- Progress reports
DROP POLICY IF EXISTS student_progress_reports_select_authorized ON public.student_progress_reports;
CREATE POLICY student_progress_reports_select_authorized ON public.student_progress_reports
FOR SELECT TO authenticated
USING (
    public.is_smartnekam_school_staff(school_id)
    OR (
        student_profile_id = (SELECT auth.uid())
        AND status = 'published'
    )
    OR (
        status = 'published'
        AND published_to_parent = TRUE
        AND public.is_smartnekam_parent_of_student(student_profile_id)
    )
);

DROP POLICY IF EXISTS student_progress_reports_insert_school_staff ON public.student_progress_reports;
CREATE POLICY student_progress_reports_insert_school_staff ON public.student_progress_reports
FOR INSERT TO authenticated
WITH CHECK (
    created_by = (SELECT auth.uid())
    AND public.is_smartnekam_school_staff(school_id)
    AND public.is_smartnekam_active_student_in_school(
        student_profile_id, student_progress_reports.school_id
    )
    AND (
        class_id IS NULL
        OR EXISTS (
            SELECT 1 FROM public.school_classes AS c
            JOIN public.class_memberships AS cm ON cm.class_id = c.id
            WHERE c.id = student_progress_reports.class_id
              AND c.school_id = student_progress_reports.school_id
              AND cm.student_profile_id = student_progress_reports.student_profile_id
              AND cm.enrollment_status = 'active'
        )
    )
);

DROP POLICY IF EXISTS student_progress_reports_update_school_staff ON public.student_progress_reports;
CREATE POLICY student_progress_reports_update_school_staff ON public.student_progress_reports
FOR UPDATE TO authenticated
USING (public.is_smartnekam_school_staff(school_id))
WITH CHECK (
    public.is_smartnekam_school_staff(school_id)
    AND public.is_smartnekam_active_student_in_school(
        student_profile_id, student_progress_reports.school_id
    )
    AND (
        class_id IS NULL
        OR EXISTS (
            SELECT 1 FROM public.school_classes AS c
            JOIN public.class_memberships AS cm ON cm.class_id = c.id
            WHERE c.id = student_progress_reports.class_id
              AND c.school_id = student_progress_reports.school_id
              AND cm.student_profile_id = student_progress_reports.student_profile_id
              AND cm.enrollment_status = 'active'
        )
    )
);

-- Subject rows inherit the report's publication and access rules.
DROP POLICY IF EXISTS student_report_subjects_select_authorized ON public.student_report_subjects;
CREATE POLICY student_report_subjects_select_authorized ON public.student_report_subjects
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.student_progress_reports AS r
        WHERE r.id = report_id
          AND (
              public.is_smartnekam_school_staff(r.school_id)
              OR (r.student_profile_id = (SELECT auth.uid()) AND r.status = 'published')
              OR (
                  r.status = 'published'
                  AND r.published_to_parent = TRUE
                  AND public.is_smartnekam_parent_of_student(r.student_profile_id)
              )
          )
    )
);

DROP POLICY IF EXISTS student_report_subjects_insert_school_staff ON public.student_report_subjects;
CREATE POLICY student_report_subjects_insert_school_staff ON public.student_report_subjects
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.student_progress_reports AS r
        WHERE r.id = report_id
          AND r.status = 'draft'
          AND public.is_smartnekam_school_staff(r.school_id)
    )
);

DROP POLICY IF EXISTS student_report_subjects_update_school_staff ON public.student_report_subjects;
CREATE POLICY student_report_subjects_update_school_staff ON public.student_report_subjects
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.student_progress_reports AS r
        WHERE r.id = report_id
          AND r.status = 'draft'
          AND public.is_smartnekam_school_staff(r.school_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.student_progress_reports AS r
        WHERE r.id = report_id
          AND r.status = 'draft'
          AND public.is_smartnekam_school_staff(r.school_id)
    )
);

DROP POLICY IF EXISTS student_report_subjects_delete_school_staff ON public.student_report_subjects;
CREATE POLICY student_report_subjects_delete_school_staff ON public.student_report_subjects
FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.student_progress_reports AS r
        WHERE r.id = report_id
          AND r.status = 'draft'
          AND public.is_smartnekam_school_staff(r.school_id)
    )
);

-- -----------------------------------------------------------------------------
-- 9. Parent dashboard summary RPC.
-- Returns limited summary fields only, not private application notes, checklists,
-- documents, quiz answers or messages. Parent must have an approved link.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_parent_dashboard_summary(p_student_profile_id UUID)
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    school_name TEXT,
    xp INTEGER,
    streak INTEGER,
    latest_report_date DATE,
    latest_overall_grade TEXT,
    attendance_present_or_late_30d INTEGER,
    attendance_days_recorded_30d INTEGER,
    active_application_count INTEGER,
    next_application_deadline DATE,
    submitted_quizzes_30d INTEGER,
    average_quiz_percent_30d NUMERIC,
    completed_course_lessons INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_parent_id UUID := (SELECT auth.uid());
    v_role TEXT;
BEGIN
    IF v_parent_id IS NULL THEN
        RAISE EXCEPTION 'Authentication is required.';
    END IF;

    SELECT p.role INTO v_role
    FROM public.profiles AS p
    WHERE p.id = v_parent_id AND p.status = 'active';

    IF v_role IS DISTINCT FROM 'parent' OR NOT EXISTS (
        SELECT 1 FROM public.parent_student_links AS l
        WHERE l.parent_profile_id = v_parent_id
          AND l.student_profile_id = p_student_profile_id
          AND l.status = 'approved'
    ) THEN
        RAISE EXCEPTION 'An approved parent-student link is required to view this dashboard.';
    END IF;

    RETURN QUERY
    SELECT
        student.id,
        student.full_name::TEXT,
        school.name::TEXT,
        student.xp,
        student.streak,
        latest_report.report_date,
        latest_report.overall_grade::TEXT,
        COALESCE(attendance.present_or_late, 0)::INTEGER,
        COALESCE(attendance.days_recorded, 0)::INTEGER,
        COALESCE(applications.active_count, 0)::INTEGER,
        applications.next_deadline,
        COALESCE(quizzes.submitted_count, 0)::INTEGER,
        quizzes.average_percent,
        COALESCE(lessons.completed_count, 0)::INTEGER
    FROM public.profiles AS student
    LEFT JOIN public.schools AS school ON school.id = student.school_id
    LEFT JOIN LATERAL (
        SELECT r.report_date, r.overall_grade
        FROM public.student_progress_reports AS r
        WHERE r.student_profile_id = student.id
          AND r.status = 'published'
          AND r.published_to_parent = TRUE
        ORDER BY r.report_date DESC, r.created_at DESC
        LIMIT 1
    ) AS latest_report ON TRUE
    LEFT JOIN LATERAL (
        SELECT
            COUNT(*) FILTER (WHERE a.attendance_status IN ('present', 'late'))::INTEGER AS present_or_late,
            COUNT(*)::INTEGER AS days_recorded
        FROM public.attendance_records AS a
        WHERE a.student_profile_id = student.id
          AND a.attendance_date >= (CURRENT_DATE - 29)
          AND a.attendance_date <= CURRENT_DATE
    ) AS attendance ON TRUE
    LEFT JOIN LATERAL (
        SELECT
            COUNT(*) FILTER (WHERE a.status IN ('not_started', 'preparing', 'submitted', 'interview'))::INTEGER AS active_count,
            MIN(a.deadline) FILTER (WHERE a.deadline >= CURRENT_DATE) AS next_deadline
        FROM public.applications AS a
        WHERE a.user_id = student.id
    ) AS applications ON TRUE
    LEFT JOIN LATERAL (
        SELECT
            COUNT(*)::INTEGER AS submitted_count,
            ROUND(AVG((qa.score::NUMERIC / NULLIF(qa.total_marks, 0)) * 100), 1)::NUMERIC AS average_percent
        FROM public.quiz_attempts AS qa
        WHERE qa.user_id = student.id
          AND qa.status = 'submitted'
          AND qa.completed_at >= (pg_catalog.now() - INTERVAL '30 days')
    ) AS quizzes ON TRUE
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::INTEGER AS completed_count
        FROM public.course_lesson_progress AS clp
        WHERE clp.student_id = student.id
          AND clp.completed_at IS NOT NULL
    ) AS lessons ON TRUE
    WHERE student.id = p_student_profile_id
      AND student.role = 'student'
      AND student.status = 'active';
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.get_parent_dashboard_summary(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_parent_dashboard_summary(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 10. Least-privilege table grants. RLS remains the row-level authorization layer.
-- -----------------------------------------------------------------------------
REVOKE ALL PRIVILEGES ON TABLE public.school_classes FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.class_memberships FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.parent_student_links FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.school_announcements FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.attendance_records FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.student_progress_reports FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.student_report_subjects FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT ON TABLE public.school_classes TO authenticated;
GRANT UPDATE (class_name, level, form_or_year, stream, academic_year, class_teacher_id, capacity, status)
    ON TABLE public.school_classes TO authenticated;
GRANT SELECT, INSERT ON TABLE public.class_memberships TO authenticated;
GRANT UPDATE (enrollment_status) ON TABLE public.class_memberships TO authenticated;
GRANT SELECT ON TABLE public.parent_student_links TO authenticated;
GRANT SELECT, INSERT ON TABLE public.school_announcements TO authenticated;
GRANT UPDATE (class_id, title, body, audience, status, publish_at)
    ON TABLE public.school_announcements TO authenticated;
GRANT SELECT, INSERT ON TABLE public.attendance_records TO authenticated;
GRANT UPDATE (attendance_date, attendance_status, note)
    ON TABLE public.attendance_records TO authenticated;
GRANT SELECT, INSERT ON TABLE public.student_progress_reports TO authenticated;
GRANT UPDATE (class_id, academic_year, term_name, report_date, overall_grade, average_score, teacher_comment, status, published_to_parent)
    ON TABLE public.student_progress_reports TO authenticated;
GRANT SELECT, INSERT ON TABLE public.student_report_subjects TO authenticated;
GRANT UPDATE (subject_id, subject_name, marks, grade, teacher_comment)
    ON TABLE public.student_report_subjects TO authenticated;
GRANT DELETE ON TABLE public.student_report_subjects TO authenticated;

-- The parent summary RPC intentionally grants no direct access to underlying
-- applications, quiz-attempts or course progress rows on a parent's behalf.

COMMIT;

-- Expected result: Success. No rows returned.
-- Verify afterwards with the query provided alongside this migration.

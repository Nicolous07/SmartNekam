-- SmartNekam | SQL 005: Opportunities, University Programmes, Saved Items and Application Tracker
-- Depends on SQL 001A + 001B (profiles, universities, set_updated_at).
-- Safe to re-run during development: no existing tables or rows are dropped.
-- Private application files use the Storage path: <auth.uid()>/<application_id>/<filename>.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Authorization helper for opportunity/university catalog moderation
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_smartnekam_opportunity_admin()
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
          AND p.role IN ('moderator', 'super_admin')
          AND p.status = 'active'
    );
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.is_smartnekam_opportunity_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_smartnekam_opportunity_admin() TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Opportunities: scholarships, competitions, internships, jobs and funding
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(30) NOT NULL,
    title VARCHAR(200) NOT NULL,
    sponsor VARCHAR(180),
    description TEXT,
    level VARCHAR(30),
    field VARCHAR(120),
    funding_type VARCHAR(50),
    amount TEXT,
    country VARCHAR(100) NOT NULL DEFAULT 'Tanzania',
    location VARCHAR(160),
    deadline DATE,
    eligibility TEXT,
    documents TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    source_url TEXT,
    application_url TEXT,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(24) NOT NULL DEFAULT 'pending_review',
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT opportunities_type_check CHECK (
        type IN ('scholarship', 'competition', 'internship', 'job', 'graduate_programme', 'volunteering', 'loan', 'university')
    ),
    CONSTRAINT opportunities_level_check CHECK (
        level IS NULL OR level IN ('O_LEVEL', 'A_LEVEL', 'UNIVERSITY', 'ALL')
    ),
    CONSTRAINT opportunities_status_check CHECK (
        status IN ('draft', 'pending_review', 'active', 'closed', 'rejected')
    ),
    CONSTRAINT opportunities_title_not_blank CHECK (length(btrim(title)) > 0),
    CONSTRAINT opportunities_source_url_check CHECK (source_url IS NULL OR source_url ~* '^https?://'),
    CONSTRAINT opportunities_application_url_check CHECK (application_url IS NULL OR application_url ~* '^https?://')
);

CREATE INDEX IF NOT EXISTS opportunities_type_status_deadline_idx
    ON public.opportunities (type, status, deadline);
CREATE INDEX IF NOT EXISTS opportunities_level_status_idx
    ON public.opportunities (level, status);
CREATE INDEX IF NOT EXISTS opportunities_created_by_idx
    ON public.opportunities (created_by);
CREATE INDEX IF NOT EXISTS opportunities_verified_status_idx
    ON public.opportunities (verified, status);
CREATE INDEX IF NOT EXISTS opportunities_title_search_idx
    ON public.opportunities USING gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(sponsor, '') || ' ' || coalesce(description, '')));

DROP TRIGGER IF EXISTS opportunities_set_updated_at ON public.opportunities;
CREATE TRIGGER opportunities_set_updated_at
BEFORE UPDATE ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. University programmes and saved programme list
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.university_programmes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
    programme_name VARCHAR(200) NOT NULL,
    award VARCHAR(120),
    field_of_study VARCHAR(120),
    entry_requirements TEXT,
    duration VARCHAR(80),
    tuition_fee NUMERIC(12,2),
    currency CHAR(3) NOT NULL DEFAULT 'TZS',
    application_fee NUMERIC(12,2),
    application_url TEXT,
    application_opens_on DATE,
    application_deadline DATE,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT university_programmes_status_check CHECK (status IN ('draft', 'active', 'inactive')),
    CONSTRAINT university_programmes_fee_check CHECK (tuition_fee IS NULL OR tuition_fee >= 0),
    CONSTRAINT university_programmes_application_fee_check CHECK (application_fee IS NULL OR application_fee >= 0),
    CONSTRAINT university_programmes_deadline_check CHECK (
        application_opens_on IS NULL OR application_deadline IS NULL OR application_deadline >= application_opens_on
    ),
    CONSTRAINT university_programmes_url_check CHECK (application_url IS NULL OR application_url ~* '^https?://'),
    CONSTRAINT university_programmes_name_not_blank CHECK (length(btrim(programme_name)) > 0)
);

CREATE INDEX IF NOT EXISTS university_programmes_university_status_idx
    ON public.university_programmes (university_id, status);
CREATE INDEX IF NOT EXISTS university_programmes_field_idx
    ON public.university_programmes (field_of_study);

DROP TRIGGER IF EXISTS university_programmes_set_updated_at ON public.university_programmes;
CREATE TRIGGER university_programmes_set_updated_at
BEFORE UPDATE ON public.university_programmes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.saved_university_programmes (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    programme_id UUID NOT NULL REFERENCES public.university_programmes(id) ON DELETE CASCADE,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, programme_id)
);

CREATE INDEX IF NOT EXISTS saved_university_programmes_programme_idx
    ON public.saved_university_programmes (programme_id);

-- -----------------------------------------------------------------------------
-- 4. Saved opportunities and deadline reminders
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_opportunities (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, opportunity_id)
);

CREATE INDEX IF NOT EXISTS saved_opportunities_opportunity_idx
    ON public.saved_opportunities (opportunity_id);

CREATE TABLE IF NOT EXISTS public.opportunity_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
    remind_at TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    channel VARCHAR(20) NOT NULL DEFAULT 'in_app',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT opportunity_reminders_channel_check CHECK (channel IN ('in_app', 'push', 'email', 'sms')),
    CONSTRAINT opportunity_reminders_future_or_unsent_check CHECK (sent_at IS NULL OR sent_at >= created_at),
    UNIQUE (user_id, opportunity_id, remind_at, channel)
);

CREATE INDEX IF NOT EXISTS opportunity_reminders_due_idx
    ON public.opportunity_reminders (remind_at)
    WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS opportunity_reminders_user_idx
    ON public.opportunity_reminders (user_id, remind_at);

-- -----------------------------------------------------------------------------
-- 5. Application tracker: either an opportunity and/or a university programme
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE RESTRICT,
    university_programme_id UUID REFERENCES public.university_programmes(id) ON DELETE RESTRICT,
    status VARCHAR(24) NOT NULL DEFAULT 'not_started',
    deadline DATE,
    checklist JSONB NOT NULL DEFAULT '[]'::JSONB,
    notes TEXT,
    submitted_at TIMESTAMPTZ,
    decision_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT applications_status_check CHECK (
        status IN ('not_started', 'preparing', 'submitted', 'interview', 'accepted', 'rejected')
    ),
    CONSTRAINT applications_checklist_array_check CHECK (jsonb_typeof(checklist) = 'array'),
    CONSTRAINT applications_target_check CHECK (opportunity_id IS NOT NULL OR university_programme_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS applications_user_opportunity_unique_idx
    ON public.applications (user_id, opportunity_id)
    WHERE opportunity_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS applications_user_programme_unique_idx
    ON public.applications (user_id, university_programme_id)
    WHERE university_programme_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS applications_user_status_deadline_idx
    ON public.applications (user_id, status, deadline);

DROP TRIGGER IF EXISTS applications_set_updated_at ON public.applications;
CREATE TRIGGER applications_set_updated_at
BEFORE UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Private document metadata. Actual files are held in a private Supabase Storage bucket.
CREATE TABLE IF NOT EXISTS public.application_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL UNIQUE,
    original_filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(120),
    file_size_bytes BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT application_documents_size_check CHECK (file_size_bytes IS NULL OR file_size_bytes BETWEEN 0 AND 10485760),
    CONSTRAINT application_documents_filename_not_blank CHECK (length(btrim(original_filename)) > 0)
);

CREATE INDEX IF NOT EXISTS application_documents_application_idx
    ON public.application_documents (application_id);

-- -----------------------------------------------------------------------------
-- 6. Enable RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.university_programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_university_programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;

-- Opportunities: public can browse active records. Unverified active opportunities remain
-- visible so the UI can display the PRD-required unverified warning.
DROP POLICY IF EXISTS opportunities_select_active_own_or_admin ON public.opportunities;
CREATE POLICY opportunities_select_active_own_or_admin
ON public.opportunities FOR SELECT TO anon, authenticated
USING (
    status = 'active'
    OR created_by = (SELECT auth.uid())
    OR public.is_smartnekam_opportunity_admin()
);

DROP POLICY IF EXISTS opportunities_insert_pending_or_admin ON public.opportunities;
CREATE POLICY opportunities_insert_pending_or_admin
ON public.opportunities FOR INSERT TO authenticated
WITH CHECK (
    (
        created_by = (SELECT auth.uid())
        AND status IN ('draft', 'pending_review')
        AND verified = FALSE
        AND reviewed_by IS NULL
        AND reviewed_at IS NULL
    )
    OR public.is_smartnekam_opportunity_admin()
);

DROP POLICY IF EXISTS opportunities_update_own_unreviewed_or_admin ON public.opportunities;
CREATE POLICY opportunities_update_own_unreviewed_or_admin
ON public.opportunities FOR UPDATE TO authenticated
USING (
    (created_by = (SELECT auth.uid()) AND status IN ('draft', 'pending_review', 'rejected') AND verified = FALSE)
    OR public.is_smartnekam_opportunity_admin()
)
WITH CHECK (
    (
        created_by = (SELECT auth.uid())
        AND status IN ('draft', 'pending_review', 'rejected')
        AND verified = FALSE
        AND reviewed_by IS NULL
        AND reviewed_at IS NULL
    )
    OR public.is_smartnekam_opportunity_admin()
);

DROP POLICY IF EXISTS opportunities_delete_own_unreviewed_or_admin ON public.opportunities;
CREATE POLICY opportunities_delete_own_unreviewed_or_admin
ON public.opportunities FOR DELETE TO authenticated
USING (
    (created_by = (SELECT auth.uid()) AND status IN ('draft', 'pending_review', 'rejected') AND verified = FALSE)
    OR public.is_smartnekam_opportunity_admin()
);

-- Only moderators/super admins can create or change the public university programme directory.
DROP POLICY IF EXISTS university_programmes_select_active_or_admin ON public.university_programmes;
CREATE POLICY university_programmes_select_active_or_admin
ON public.university_programmes FOR SELECT TO anon, authenticated
USING (status = 'active' OR public.is_smartnekam_opportunity_admin());

DROP POLICY IF EXISTS university_programmes_insert_admin ON public.university_programmes;
CREATE POLICY university_programmes_insert_admin
ON public.university_programmes FOR INSERT TO authenticated
WITH CHECK (public.is_smartnekam_opportunity_admin());

DROP POLICY IF EXISTS university_programmes_update_admin ON public.university_programmes;
CREATE POLICY university_programmes_update_admin
ON public.university_programmes FOR UPDATE TO authenticated
USING (public.is_smartnekam_opportunity_admin())
WITH CHECK (public.is_smartnekam_opportunity_admin());

DROP POLICY IF EXISTS university_programmes_delete_admin ON public.university_programmes;
CREATE POLICY university_programmes_delete_admin
ON public.university_programmes FOR DELETE TO authenticated
USING (public.is_smartnekam_opportunity_admin());

-- Saved programmes and opportunities belong to the signed-in user.
DROP POLICY IF EXISTS saved_university_programmes_select_own ON public.saved_university_programmes;
CREATE POLICY saved_university_programmes_select_own
ON public.saved_university_programmes FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS saved_university_programmes_insert_own ON public.saved_university_programmes;
CREATE POLICY saved_university_programmes_insert_own
ON public.saved_university_programmes FOR INSERT TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.university_programmes AS up
        WHERE up.id = programme_id AND up.status = 'active'
    )
);

DROP POLICY IF EXISTS saved_university_programmes_delete_own ON public.saved_university_programmes;
CREATE POLICY saved_university_programmes_delete_own
ON public.saved_university_programmes FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS saved_opportunities_select_own ON public.saved_opportunities;
CREATE POLICY saved_opportunities_select_own
ON public.saved_opportunities FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS saved_opportunities_insert_own ON public.saved_opportunities;
CREATE POLICY saved_opportunities_insert_own
ON public.saved_opportunities FOR INSERT TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.opportunities AS o
        WHERE o.id = opportunity_id AND o.status = 'active'
    )
);

DROP POLICY IF EXISTS saved_opportunities_delete_own ON public.saved_opportunities;
CREATE POLICY saved_opportunities_delete_own
ON public.saved_opportunities FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

-- Reminder schedules are private. Sending reminders later requires a scheduled worker/Edge Function.
DROP POLICY IF EXISTS opportunity_reminders_select_own ON public.opportunity_reminders;
CREATE POLICY opportunity_reminders_select_own
ON public.opportunity_reminders FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS opportunity_reminders_insert_own ON public.opportunity_reminders;
CREATE POLICY opportunity_reminders_insert_own
ON public.opportunity_reminders FOR INSERT TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.opportunities AS o
        WHERE o.id = opportunity_id AND o.status = 'active'
    )
);

DROP POLICY IF EXISTS opportunity_reminders_update_own ON public.opportunity_reminders;
CREATE POLICY opportunity_reminders_update_own
ON public.opportunity_reminders FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS opportunity_reminders_delete_own ON public.opportunity_reminders;
CREATE POLICY opportunity_reminders_delete_own
ON public.opportunity_reminders FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

-- Applications and linked document metadata remain private to their owner.
DROP POLICY IF EXISTS applications_select_own ON public.applications;
CREATE POLICY applications_select_own
ON public.applications FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS applications_insert_own ON public.applications;
CREATE POLICY applications_insert_own
ON public.applications FOR INSERT TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (opportunity_id IS NULL OR EXISTS (
        SELECT 1 FROM public.opportunities AS o
        WHERE o.id = opportunity_id AND o.status = 'active'
    ))
    AND (university_programme_id IS NULL OR EXISTS (
        SELECT 1 FROM public.university_programmes AS up
        WHERE up.id = university_programme_id AND up.status = 'active'
    ))
);

DROP POLICY IF EXISTS applications_update_own ON public.applications;
CREATE POLICY applications_update_own
ON public.applications FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS applications_delete_own ON public.applications;
CREATE POLICY applications_delete_own
ON public.applications FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS application_documents_select_own ON public.application_documents;
CREATE POLICY application_documents_select_own
ON public.application_documents FOR SELECT TO authenticated
USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.applications AS a
        WHERE a.id = application_id AND a.user_id = (SELECT auth.uid())
    )
);

DROP POLICY IF EXISTS application_documents_insert_own ON public.application_documents;
CREATE POLICY application_documents_insert_own
ON public.application_documents FOR INSERT TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.applications AS a
        WHERE a.id = application_id AND a.user_id = (SELECT auth.uid())
    )
    AND split_part(storage_path, '/', 1) = (SELECT auth.uid())::TEXT
);

DROP POLICY IF EXISTS application_documents_delete_own ON public.application_documents;
CREATE POLICY application_documents_delete_own
ON public.application_documents FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

-- -----------------------------------------------------------------------------
-- 7. Private Storage bucket for application documents (10 MiB per file)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'smartnekam-application-documents',
    'smartnekam-application-documents',
    FALSE,
    10485760,
    ARRAY[
        'application/pdf',
        'image/jpeg',
        'image/png',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]::TEXT[]
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS smartnekam_application_docs_select_own ON storage.objects;
CREATE POLICY smartnekam_application_docs_select_own
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'smartnekam-application-documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
);

DROP POLICY IF EXISTS smartnekam_application_docs_insert_own ON storage.objects;
CREATE POLICY smartnekam_application_docs_insert_own
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'smartnekam-application-documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
);

DROP POLICY IF EXISTS smartnekam_application_docs_update_own ON storage.objects;
CREATE POLICY smartnekam_application_docs_update_own
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'smartnekam-application-documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
)
WITH CHECK (
    bucket_id = 'smartnekam-application-documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
);

DROP POLICY IF EXISTS smartnekam_application_docs_delete_own ON storage.objects;
CREATE POLICY smartnekam_application_docs_delete_own
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'smartnekam-application-documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
);

-- -----------------------------------------------------------------------------
-- 8. Least-privilege table grants; RLS policies above enforce row-level ownership
-- -----------------------------------------------------------------------------
REVOKE ALL PRIVILEGES ON TABLE public.opportunities FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.university_programmes FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.saved_university_programmes FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.saved_opportunities FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.opportunity_reminders FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.applications FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.application_documents FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.opportunities TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.opportunities TO authenticated;

GRANT SELECT ON TABLE public.university_programmes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.university_programmes TO authenticated;

GRANT SELECT, INSERT, DELETE ON TABLE public.saved_university_programmes TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.saved_opportunities TO authenticated;
GRANT SELECT, INSERT ON TABLE public.opportunity_reminders TO authenticated;
GRANT UPDATE (remind_at, channel) ON TABLE public.opportunity_reminders TO authenticated;
GRANT DELETE ON TABLE public.opportunity_reminders TO authenticated;
GRANT SELECT ON TABLE public.applications TO authenticated;
GRANT INSERT (user_id, opportunity_id, university_programme_id, status, deadline, checklist, notes)
    ON TABLE public.applications TO authenticated;
GRANT UPDATE (status, deadline, checklist, notes, submitted_at, decision_at)
    ON TABLE public.applications TO authenticated;
GRANT DELETE ON TABLE public.applications TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.application_documents TO authenticated;

COMMIT;

-- Expected result: Success. No rows returned.
-- Note: opportunity reminder delivery requires a scheduled Edge Function/worker in a later step.

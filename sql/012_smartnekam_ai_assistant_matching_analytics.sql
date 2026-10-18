-- SmartNekam | SQL 012: AI Study Assistant, Scholarship Matching, Personal Statements & Analytics
-- Depends on SQL 001A/001B and SQL 005 (opportunities/university_programmes).
-- This migration stores AI work and matching results; it does NOT call an AI provider.
-- AI provider keys must stay in Supabase Edge Function secrets, never in this SQL or frontend.
-- Safe to re-run during development: it does not drop existing tables or rows.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Authorization helper for restricted AI/analytics administration
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_smartnekam_ai_admin()
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

REVOKE ALL PRIVILEGES ON FUNCTION public.is_smartnekam_ai_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_smartnekam_ai_admin() TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. AI Study Assistant sessions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_study_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_type VARCHAR(32) NOT NULL,
    title VARCHAR(180) NOT NULL DEFAULT 'AI Study Session',
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    source_note_id UUID REFERENCES public.notes(id) ON DELETE SET NULL,
    source_past_paper_id UUID REFERENCES public.past_papers(id) ON DELETE SET NULL,
    language_code VARCHAR(5) NOT NULL DEFAULT 'en',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ai_study_sessions_type_check CHECK (
        session_type IN ('explain_topic', 'summarize_notes', 'generate_quiz', 'answer_doubt', 'scholarship_match', 'personal_statement')
    ),
    CONSTRAINT ai_study_sessions_language_check CHECK (language_code IN ('en', 'sw')),
    CONSTRAINT ai_study_sessions_status_check CHECK (status IN ('active', 'completed', 'failed', 'archived')),
    CONSTRAINT ai_study_sessions_context_object_check CHECK (jsonb_typeof(context) = 'object'),
    CONSTRAINT ai_study_sessions_title_not_blank CHECK (length(btrim(title)) > 0),
    CONSTRAINT ai_study_sessions_id_user_unique UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS ai_study_sessions_user_updated_idx
    ON public.ai_study_sessions (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS ai_study_sessions_type_created_idx
    ON public.ai_study_sessions (session_type, created_at DESC);

DROP TRIGGER IF EXISTS ai_study_sessions_set_updated_at ON public.ai_study_sessions;
CREATE TRIGGER ai_study_sessions_set_updated_at
BEFORE UPDATE ON public.ai_study_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Messages are written by a trusted Edge Function so clients cannot fabricate assistant output.
CREATE TABLE IF NOT EXISTS public.ai_study_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_role VARCHAR(12) NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(24) NOT NULL DEFAULT 'text',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    input_tokens INTEGER,
    output_tokens INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ai_study_messages_session_owner_fk
        FOREIGN KEY (session_id, user_id)
        REFERENCES public.ai_study_sessions(id, user_id) ON DELETE CASCADE,
    CONSTRAINT ai_study_messages_sender_check CHECK (sender_role IN ('user', 'assistant')),
    CONSTRAINT ai_study_messages_content_type_check CHECK (content_type IN ('text', 'summary', 'quiz_json', 'explanation', 'error')),
    CONSTRAINT ai_study_messages_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object'),
    CONSTRAINT ai_study_messages_input_tokens_check CHECK (input_tokens IS NULL OR input_tokens >= 0),
    CONSTRAINT ai_study_messages_output_tokens_check CHECK (output_tokens IS NULL OR output_tokens >= 0),
    CONSTRAINT ai_study_messages_content_not_blank CHECK (length(btrim(content)) > 0)
);

CREATE INDEX IF NOT EXISTS ai_study_messages_session_created_idx
    ON public.ai_study_messages (session_id, created_at);
CREATE INDEX IF NOT EXISTS ai_study_messages_user_created_idx
    ON public.ai_study_messages (user_id, created_at DESC);

-- Server-side usage log. Frontend users cannot create usage records themselves.
CREATE TABLE IF NOT EXISTS public.ai_usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    session_id UUID REFERENCES public.ai_study_sessions(id) ON DELETE SET NULL,
    purpose VARCHAR(40) NOT NULL,
    provider VARCHAR(60),
    model VARCHAR(100),
    request_id VARCHAR(160),
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd NUMERIC(12,6),
    duration_ms INTEGER,
    status VARCHAR(16) NOT NULL DEFAULT 'success',
    error_code VARCHAR(80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ai_usage_events_purpose_check CHECK (
        purpose IN ('study_assistant', 'scholarship_matching', 'personal_statement', 'quiz_generation', 'summarization')
    ),
    CONSTRAINT ai_usage_events_status_check CHECK (status IN ('success', 'failed', 'blocked')),
    CONSTRAINT ai_usage_events_input_tokens_check CHECK (input_tokens >= 0),
    CONSTRAINT ai_usage_events_output_tokens_check CHECK (output_tokens >= 0),
    CONSTRAINT ai_usage_events_cost_check CHECK (estimated_cost_usd IS NULL OR estimated_cost_usd >= 0),
    CONSTRAINT ai_usage_events_duration_check CHECK (duration_ms IS NULL OR duration_ms >= 0)
);

CREATE INDEX IF NOT EXISTS ai_usage_events_user_created_idx
    ON public.ai_usage_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_events_purpose_created_idx
    ON public.ai_usage_events (purpose, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ai_usage_events_request_id_unique_idx
    ON public.ai_usage_events (request_id) WHERE request_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. Scholarship matching runs and private match explanations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scholarship_match_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    result_count INTEGER NOT NULL DEFAULT 0,
    error_code VARCHAR(80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT scholarship_match_runs_filters_object_check CHECK (jsonb_typeof(filters) = 'object'),
    CONSTRAINT scholarship_match_runs_status_check CHECK (status IN ('pending', 'completed', 'failed')),
    CONSTRAINT scholarship_match_runs_result_count_check CHECK (result_count >= 0),
    CONSTRAINT scholarship_match_runs_id_user_unique UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS scholarship_match_runs_user_created_idx
    ON public.scholarship_match_runs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.scholarship_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
    match_score SMALLINT NOT NULL,
    reasons TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    explanation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT scholarship_matches_run_owner_fk
        FOREIGN KEY (run_id, user_id)
        REFERENCES public.scholarship_match_runs(id, user_id) ON DELETE CASCADE,
    CONSTRAINT scholarship_matches_score_check CHECK (match_score BETWEEN 0 AND 100),
    CONSTRAINT scholarship_matches_unique_per_run UNIQUE (run_id, opportunity_id)
);

CREATE INDEX IF NOT EXISTS scholarship_matches_user_score_idx
    ON public.scholarship_matches (user_id, match_score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS scholarship_matches_opportunity_idx
    ON public.scholarship_matches (opportunity_id);

-- -----------------------------------------------------------------------------
-- 4. Personal Statement Builder drafts and revision history
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.personal_statement_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title VARCHAR(180) NOT NULL DEFAULT 'Personal Statement Draft',
    target_programme_id UUID REFERENCES public.university_programmes(id) ON DELETE SET NULL,
    target_opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
    prompt TEXT,
    current_text TEXT NOT NULL DEFAULT '',
    language_code VARCHAR(5) NOT NULL DEFAULT 'en',
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT personal_statement_drafts_language_check CHECK (language_code IN ('en', 'sw')),
    CONSTRAINT personal_statement_drafts_status_check CHECK (status IN ('draft', 'in_review', 'finalized', 'archived')),
    CONSTRAINT personal_statement_drafts_title_not_blank CHECK (length(btrim(title)) > 0),
    CONSTRAINT personal_statement_drafts_id_user_unique UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS personal_statement_drafts_user_updated_idx
    ON public.personal_statement_drafts (user_id, updated_at DESC);

DROP TRIGGER IF EXISTS personal_statement_drafts_set_updated_at ON public.personal_statement_drafts;
CREATE TRIGGER personal_statement_drafts_set_updated_at
BEFORE UPDATE ON public.personal_statement_drafts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.personal_statement_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    revision_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    revision_note VARCHAR(240),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT personal_statement_revisions_draft_owner_fk
        FOREIGN KEY (draft_id, user_id)
        REFERENCES public.personal_statement_drafts(id, user_id) ON DELETE CASCADE,
    CONSTRAINT personal_statement_revisions_number_check CHECK (revision_number >= 1),
    CONSTRAINT personal_statement_revisions_unique_number UNIQUE (draft_id, revision_number)
);

CREATE INDEX IF NOT EXISTS personal_statement_revisions_user_created_idx
    ON public.personal_statement_revisions (user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 5. Admin analytics snapshots (populated by a trusted scheduled/server process)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_analytics_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_date DATE NOT NULL,
    metric_key VARCHAR(100) NOT NULL,
    metric_value NUMERIC(18,4) NOT NULL DEFAULT 0,
    dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT platform_analytics_metric_key_not_blank CHECK (length(btrim(metric_key)) > 0),
    CONSTRAINT platform_analytics_dimensions_object_check CHECK (jsonb_typeof(dimensions) = 'object'),
    CONSTRAINT platform_analytics_metric_unique UNIQUE (metric_date, metric_key, dimensions)
);

CREATE INDEX IF NOT EXISTS platform_analytics_snapshots_date_idx
    ON public.platform_analytics_snapshots (metric_date DESC, metric_key);

-- -----------------------------------------------------------------------------
-- 6. Row Level Security
-- -----------------------------------------------------------------------------
ALTER TABLE public.ai_study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_study_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholarship_match_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholarship_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_statement_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_statement_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_analytics_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_study_sessions_select_own ON public.ai_study_sessions;
CREATE POLICY ai_study_sessions_select_own ON public.ai_study_sessions
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS ai_study_sessions_insert_own ON public.ai_study_sessions;
CREATE POLICY ai_study_sessions_insert_own ON public.ai_study_sessions
FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS ai_study_sessions_update_own ON public.ai_study_sessions;
CREATE POLICY ai_study_sessions_update_own ON public.ai_study_sessions
FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS ai_study_sessions_delete_own ON public.ai_study_sessions;
CREATE POLICY ai_study_sessions_delete_own ON public.ai_study_sessions
FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS ai_study_messages_select_own ON public.ai_study_messages;
CREATE POLICY ai_study_messages_select_own ON public.ai_study_messages
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
-- Deliberately no INSERT/UPDATE/DELETE policy for clients: trusted Edge Functions write conversation messages.

DROP POLICY IF EXISTS ai_usage_events_select_own ON public.ai_usage_events;
CREATE POLICY ai_usage_events_select_own ON public.ai_usage_events
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
-- Deliberately no client write policy for AI usage/billing events.

DROP POLICY IF EXISTS scholarship_match_runs_select_own ON public.scholarship_match_runs;
CREATE POLICY scholarship_match_runs_select_own ON public.scholarship_match_runs
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
-- Trusted server/Edge Function creates match runs and controls status/result counts.

DROP POLICY IF EXISTS scholarship_matches_select_own ON public.scholarship_matches;
CREATE POLICY scholarship_matches_select_own ON public.scholarship_matches
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
-- Trusted server/Edge Function writes match results; users can only read their own results.

DROP POLICY IF EXISTS personal_statement_drafts_select_own ON public.personal_statement_drafts;
CREATE POLICY personal_statement_drafts_select_own ON public.personal_statement_drafts
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS personal_statement_drafts_insert_own ON public.personal_statement_drafts;
CREATE POLICY personal_statement_drafts_insert_own ON public.personal_statement_drafts
FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS personal_statement_drafts_update_own ON public.personal_statement_drafts;
CREATE POLICY personal_statement_drafts_update_own ON public.personal_statement_drafts
FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS personal_statement_drafts_delete_own ON public.personal_statement_drafts;
CREATE POLICY personal_statement_drafts_delete_own ON public.personal_statement_drafts
FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS personal_statement_revisions_select_own ON public.personal_statement_revisions;
CREATE POLICY personal_statement_revisions_select_own ON public.personal_statement_revisions
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS personal_statement_revisions_insert_own ON public.personal_statement_revisions;
CREATE POLICY personal_statement_revisions_insert_own ON public.personal_statement_revisions
FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
-- Revision history is immutable for clients; deleting its parent draft removes its revisions.

DROP POLICY IF EXISTS platform_analytics_snapshots_admin_read ON public.platform_analytics_snapshots;
CREATE POLICY platform_analytics_snapshots_admin_read ON public.platform_analytics_snapshots
FOR SELECT TO authenticated USING (public.is_smartnekam_ai_admin());
-- Only trusted server/service role should write platform-wide analytics snapshots.

-- -----------------------------------------------------------------------------
-- 7. Least-privilege API grants
-- -----------------------------------------------------------------------------
REVOKE ALL PRIVILEGES ON TABLE
    public.ai_study_sessions,
    public.ai_study_messages,
    public.ai_usage_events,
    public.scholarship_match_runs,
    public.scholarship_matches,
    public.personal_statement_drafts,
    public.personal_statement_revisions,
    public.platform_analytics_snapshots
FROM PUBLIC, anon, authenticated;

GRANT SELECT, DELETE ON TABLE public.ai_study_sessions TO authenticated;
GRANT INSERT (user_id, session_type, title, subject_id, source_note_id, source_past_paper_id, language_code, context)
    ON TABLE public.ai_study_sessions TO authenticated;
GRANT UPDATE (title, subject_id, source_note_id, source_past_paper_id, language_code, context)
    ON TABLE public.ai_study_sessions TO authenticated;
GRANT SELECT ON TABLE public.ai_study_messages TO authenticated;
GRANT SELECT ON TABLE public.ai_usage_events TO authenticated;
GRANT SELECT ON TABLE public.scholarship_match_runs TO authenticated;
GRANT SELECT ON TABLE public.scholarship_matches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.personal_statement_drafts TO authenticated;
GRANT SELECT, INSERT ON TABLE public.personal_statement_revisions TO authenticated;
GRANT SELECT ON TABLE public.platform_analytics_snapshots TO authenticated;

COMMIT;

-- Expected: Success. No rows returned.
-- Notes:
-- 1) Configure actual AI provider calls in Supabase Edge Functions; never expose provider secrets in the browser.
-- 2) Edge Functions/service role must create AI messages, usage logs, match runs/results, and analytics snapshots.
-- 3) Matching results are recommendations only; users must verify eligibility and deadlines at official sources.

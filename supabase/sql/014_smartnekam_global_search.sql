-- SmartNekam | SQL 014: Global Search
-- Implements PRD search across approved learning resources, public groups, Q&A,
-- published courses, active opportunities, and active university programmes.
-- Prerequisites: migrations 001A through 013 completed successfully.
-- SECURITY INVOKER is intentional: the caller's table grants and RLS policies apply.
-- This migration does not delete existing data.

BEGIN;

-- 1. Full-text indexes for searchable content.
-- PostgreSQL marks array_to_string(anyarray, text) STABLE because it also
-- supports non-text array element types whose output can depend on settings.
-- Here tags is specifically TEXT[], so joining its text elements is deterministic.
-- Use a TEXT[]-specific immutable helper for this index expression.
CREATE OR REPLACE FUNCTION public.smartnekam_text_array_to_string(p_values TEXT[])
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $function$
    SELECT pg_catalog.array_to_string(p_values, ' ')
$function$;

CREATE INDEX IF NOT EXISTS notes_fulltext_search_idx
    ON public.notes USING GIN (
        to_tsvector('simple'::regconfig, coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(public.smartnekam_text_array_to_string(tags), ''))
    );

CREATE INDEX IF NOT EXISTS past_papers_fulltext_search_idx
    ON public.past_papers USING GIN (
        to_tsvector('simple'::regconfig, coalesce(title, '') || ' ' || coalesce(exam_type, '') || ' ' || coalesce(year::text, ''))
    );

CREATE INDEX IF NOT EXISTS study_groups_fulltext_search_idx
    ON public.study_groups USING GIN (
        to_tsvector('simple'::regconfig, coalesce(name, '') || ' ' || coalesce(description, ''))
    );

CREATE INDEX IF NOT EXISTS questions_fulltext_search_idx
    ON public.questions USING GIN (
        to_tsvector('simple'::regconfig, coalesce(title, '') || ' ' || coalesce(body, ''))
    );

CREATE INDEX IF NOT EXISTS universities_fulltext_search_idx
    ON public.universities USING GIN (
        to_tsvector('simple'::regconfig, coalesce(name, '') || ' ' || coalesce(region, '') || ' ' || coalesce(country, ''))
    );

CREATE INDEX IF NOT EXISTS university_programmes_fulltext_search_idx
    ON public.university_programmes USING GIN (
        to_tsvector('simple'::regconfig, coalesce(programme_name, '') || ' ' || coalesce(award, '') || ' ' || coalesce(field_of_study, '') || ' ' || coalesce(entry_requirements, '') || ' ' || coalesce(notes, ''))
    );

-- Opportunities and courses already have title/description full-text indexes
-- created by migrations 005 and 009.

-- 2. Unified, paginated search RPC.
-- p_type may be NULL (all searchable types) or one of:
-- notes, past_papers, study_groups, questions, courses, opportunities,
-- universities, university_programmes.
CREATE OR REPLACE FUNCTION public.search_smartnekam(
    p_query TEXT,
    p_limit INTEGER DEFAULT 30,
    p_type TEXT DEFAULT NULL
)
RETURNS TABLE (
    result_type TEXT,
    result_id UUID,
    title TEXT,
    summary TEXT,
    level TEXT,
    created_at TIMESTAMPTZ,
    relevance REAL,
    is_verified BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
    WITH input AS (
        SELECT pg_catalog.websearch_to_tsquery('simple', NULLIF(pg_catalog.btrim(p_query), '')) AS tsq
    ),
    results AS (
        SELECT
            'notes'::text AS result_type,
            n.id AS result_id,
            n.title::text AS title,
            pg_catalog.left(n.description, 240)::text AS summary,
            n.level::text AS level,
            n.created_at,
            pg_catalog.ts_rank_cd(
                pg_catalog.to_tsvector('simple'::regconfig, coalesce(n.title, '') || ' ' || coalesce(n.description, '') || ' ' || coalesce(public.smartnekam_text_array_to_string(n.tags), '')),
                i.tsq
            ) AS relevance,
            NULL::boolean AS is_verified
        FROM public.notes AS n CROSS JOIN input AS i
        WHERE pg_catalog.char_length(pg_catalog.btrim(coalesce(p_query, ''))) >= 2
          AND i.tsq IS NOT NULL
          AND (p_type IS NULL OR p_type = 'notes')
          AND n.status = 'approved'
          AND pg_catalog.to_tsvector('simple'::regconfig, coalesce(n.title, '') || ' ' || coalesce(n.description, '') || ' ' || coalesce(public.smartnekam_text_array_to_string(n.tags), '')) @@ i.tsq

        UNION ALL

        SELECT
            'past_papers'::text,
            p.id,
            p.title::text,
            (p.exam_type || ' · ' || p.year::text)::text,
            p.level::text,
            p.created_at,
            pg_catalog.ts_rank_cd(
                pg_catalog.to_tsvector('simple'::regconfig, coalesce(p.title, '') || ' ' || coalesce(p.exam_type, '') || ' ' || coalesce(p.year::text, '')),
                i.tsq
            ),
            NULL::boolean
        FROM public.past_papers AS p CROSS JOIN input AS i
        WHERE pg_catalog.char_length(pg_catalog.btrim(coalesce(p_query, ''))) >= 2
          AND i.tsq IS NOT NULL
          AND (p_type IS NULL OR p_type = 'past_papers')
          AND p.status = 'approved'
          AND pg_catalog.to_tsvector('simple'::regconfig, coalesce(p.title, '') || ' ' || coalesce(p.exam_type, '') || ' ' || coalesce(p.year::text, '')) @@ i.tsq

        UNION ALL

        SELECT
            'study_groups'::text,
            g.id,
            g.name::text,
            pg_catalog.left(g.description, 240)::text,
            g.level::text,
            g.created_at,
            pg_catalog.ts_rank_cd(
                pg_catalog.to_tsvector('simple'::regconfig, coalesce(g.name, '') || ' ' || coalesce(g.description, '')),
                i.tsq
            ),
            NULL::boolean
        FROM public.study_groups AS g CROSS JOIN input AS i
        WHERE pg_catalog.char_length(pg_catalog.btrim(coalesce(p_query, ''))) >= 2
          AND i.tsq IS NOT NULL
          AND (p_type IS NULL OR p_type = 'study_groups')
          AND g.status = 'active'
          AND g.privacy = 'public'
          AND pg_catalog.to_tsvector('simple'::regconfig, coalesce(g.name, '') || ' ' || coalesce(g.description, '')) @@ i.tsq

        UNION ALL

        SELECT
            'questions'::text,
            q.id,
            coalesce(NULLIF(q.title, ''), pg_catalog.left(q.body, 120))::text,
            pg_catalog.left(q.body, 240)::text,
            s.level::text,
            q.created_at,
            pg_catalog.ts_rank_cd(
                pg_catalog.to_tsvector('simple'::regconfig, coalesce(q.title, '') || ' ' || coalesce(q.body, '')),
                i.tsq
            ),
            NULL::boolean
        FROM public.questions AS q
        JOIN public.subjects AS s ON s.id = q.subject_id
        CROSS JOIN input AS i
        WHERE pg_catalog.char_length(pg_catalog.btrim(coalesce(p_query, ''))) >= 2
          AND i.tsq IS NOT NULL
          AND (p_type IS NULL OR p_type = 'questions')
          AND q.status IN ('open', 'resolved')
          AND pg_catalog.to_tsvector('simple'::regconfig, coalesce(q.title, '') || ' ' || coalesce(q.body, '')) @@ i.tsq

        UNION ALL

        SELECT
            'courses'::text,
            c.id,
            c.title::text,
            pg_catalog.left(c.description, 240)::text,
            c.level::text,
            c.created_at,
            pg_catalog.ts_rank_cd(
                pg_catalog.to_tsvector('simple'::regconfig, coalesce(c.title, '') || ' ' || coalesce(c.description, '')),
                i.tsq
            ),
            NULL::boolean
        FROM public.courses AS c CROSS JOIN input AS i
        WHERE pg_catalog.char_length(pg_catalog.btrim(coalesce(p_query, ''))) >= 2
          AND i.tsq IS NOT NULL
          AND (p_type IS NULL OR p_type = 'courses')
          AND c.status = 'published'
          AND pg_catalog.to_tsvector('simple'::regconfig, coalesce(c.title, '') || ' ' || coalesce(c.description, '')) @@ i.tsq

        UNION ALL

        SELECT
            'opportunities'::text,
            o.id,
            o.title::text,
            pg_catalog.left(coalesce(o.description, '') || CASE WHEN o.sponsor IS NOT NULL THEN ' · ' || o.sponsor ELSE '' END, 240)::text,
            o.level::text,
            o.created_at,
            pg_catalog.ts_rank_cd(
                pg_catalog.to_tsvector('simple'::regconfig, coalesce(o.title, '') || ' ' || coalesce(o.sponsor, '') || ' ' || coalesce(o.description, '')),
                i.tsq
            ),
            o.verified
        FROM public.opportunities AS o CROSS JOIN input AS i
        WHERE pg_catalog.char_length(pg_catalog.btrim(coalesce(p_query, ''))) >= 2
          AND i.tsq IS NOT NULL
          AND (p_type IS NULL OR p_type = 'opportunities')
          AND o.status = 'active'
          AND pg_catalog.to_tsvector('simple'::regconfig, coalesce(o.title, '') || ' ' || coalesce(o.sponsor, '') || ' ' || coalesce(o.description, '')) @@ i.tsq

        UNION ALL

        SELECT
            'universities'::text,
            u.id,
            u.name::text,
            (coalesce(u.region, '') || CASE WHEN u.country IS NOT NULL THEN ' · ' || u.country ELSE '' END)::text,
            NULL::text,
            u.created_at,
            pg_catalog.ts_rank_cd(
                pg_catalog.to_tsvector('simple'::regconfig, coalesce(u.name, '') || ' ' || coalesce(u.region, '') || ' ' || coalesce(u.country, '')),
                i.tsq
            ),
            NULL::boolean
        FROM public.universities AS u CROSS JOIN input AS i
        WHERE pg_catalog.char_length(pg_catalog.btrim(coalesce(p_query, ''))) >= 2
          AND i.tsq IS NOT NULL
          AND (p_type IS NULL OR p_type = 'universities')
          AND pg_catalog.to_tsvector('simple'::regconfig, coalesce(u.name, '') || ' ' || coalesce(u.region, '') || ' ' || coalesce(u.country, '')) @@ i.tsq

        UNION ALL

        SELECT
            'university_programmes'::text,
            up.id,
            up.programme_name::text,
            pg_catalog.left(coalesce(up.field_of_study, '') || CASE WHEN up.award IS NOT NULL THEN ' · ' || up.award ELSE '' END || CASE WHEN up.entry_requirements IS NOT NULL THEN ' · ' || up.entry_requirements ELSE '' END, 240)::text,
            NULL::text,
            up.created_at,
            pg_catalog.ts_rank_cd(
                pg_catalog.to_tsvector('simple'::regconfig, coalesce(up.programme_name, '') || ' ' || coalesce(up.award, '') || ' ' || coalesce(up.field_of_study, '') || ' ' || coalesce(up.entry_requirements, '') || ' ' || coalesce(up.notes, '')),
                i.tsq
            ),
            NULL::boolean
        FROM public.university_programmes AS up CROSS JOIN input AS i
        WHERE pg_catalog.char_length(pg_catalog.btrim(coalesce(p_query, ''))) >= 2
          AND i.tsq IS NOT NULL
          AND (p_type IS NULL OR p_type = 'university_programmes')
          AND up.status = 'active'
          AND pg_catalog.to_tsvector('simple'::regconfig, coalesce(up.programme_name, '') || ' ' || coalesce(up.award, '') || ' ' || coalesce(up.field_of_study, '') || ' ' || coalesce(up.entry_requirements, '') || ' ' || coalesce(up.notes, '')) @@ i.tsq
    )
    SELECT
        r.result_type,
        r.result_id,
        r.title,
        r.summary,
        r.level,
        r.created_at,
        r.relevance,
        r.is_verified
    FROM results AS r
    ORDER BY r.relevance DESC, r.created_at DESC
    LIMIT LEAST(GREATEST(coalesce(p_limit, 30), 1), 50);
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.search_smartnekam(TEXT, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_smartnekam(TEXT, INTEGER, TEXT) TO anon, authenticated;

COMMIT;

-- Expected: Success. No rows returned.
-- RPC example: select * from public.search_smartnekam('biology past paper', 20, null);
-- A caller may pass p_type='notes', 'past_papers', 'study_groups', 'questions',
-- 'courses', 'opportunities', 'universities', or 'university_programmes'.

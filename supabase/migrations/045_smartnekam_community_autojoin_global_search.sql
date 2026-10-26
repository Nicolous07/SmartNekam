-- SmartNekam 045: repair official school-community membership and expand global search.
-- Safe/additive: preserves existing profiles, posts, learning content, and memberships
-- except memberships that do not match a profile's actual institution.
-- Prerequisites: SmartNekam SQL 001A-024 and SQL 014 global search.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Ensure institution registry has the recovery/search fields used below.
-- ---------------------------------------------------------------------------
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS education_levels text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE public.universities
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS institution_type text NOT NULL DEFAULT 'UNIVERSITY';
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS institution_name varchar(180);

CREATE OR REPLACE FUNCTION public.smartnekam_normalize_institution_name(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $function$
  SELECT pg_catalog.btrim(
    pg_catalog.regexp_replace(
      pg_catalog.lower(COALESCE(p_value, '')),
      '[^[:alnum:]]+',
      ' ',
      'g'
    )
  );
$function$;
REVOKE ALL ON FUNCTION public.smartnekam_normalize_institution_name(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.smartnekam_normalize_institution_name(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Keep the official-community tables available and create a community for
-- every institution in the registry, including institutions imported later.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.institution_communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
  university_id uuid UNIQUE REFERENCES public.universities(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT 'Jamii rasmi ya taasisi ya SmartNekam.',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT institution_community_one_institution
    CHECK ((school_id IS NOT NULL)::int + (university_id IS NOT NULL)::int = 1)
);

CREATE TABLE IF NOT EXISTS public.institution_community_members (
  community_id uuid NOT NULL REFERENCES public.institution_communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_role text NOT NULL DEFAULT 'member'
    CHECK (member_role IN ('member','visitor','ambassador','admin')),
  verified_student boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, user_id)
);

ALTER TABLE public.institution_communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_community_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Institution communities readable by signed in users" ON public.institution_communities;
DROP POLICY IF EXISTS institution_communities_authenticated_read ON public.institution_communities;
CREATE POLICY institution_communities_authenticated_read
  ON public.institution_communities FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Institution memberships visible to members" ON public.institution_community_members;
DROP POLICY IF EXISTS institution_memberships_read_own ON public.institution_community_members;
CREATE POLICY institution_memberships_read_own
  ON public.institution_community_members FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON TABLE public.institution_communities, public.institution_community_members FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.institution_communities, public.institution_community_members TO authenticated;

CREATE OR REPLACE FUNCTION public.smartnekam_sync_school_community()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.institution_communities (school_id, name)
  VALUES (NEW.id, NEW.name || ' Official Community')
  ON CONFLICT (school_id) DO UPDATE SET name = EXCLUDED.name;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.smartnekam_sync_university_community()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.institution_communities (university_id, name)
  VALUES (NEW.id, NEW.name || ' Official Community')
  ON CONFLICT (university_id) DO UPDATE SET name = EXCLUDED.name;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS schools_sync_official_community ON public.schools;
CREATE TRIGGER schools_sync_official_community
AFTER INSERT OR UPDATE OF name ON public.schools
FOR EACH ROW EXECUTE FUNCTION public.smartnekam_sync_school_community();

DROP TRIGGER IF EXISTS universities_sync_official_community ON public.universities;
CREATE TRIGGER universities_sync_official_community
AFTER INSERT OR UPDATE OF name ON public.universities
FOR EACH ROW EXECUTE FUNCTION public.smartnekam_sync_university_community();

INSERT INTO public.institution_communities (school_id, name)
SELECT s.id, s.name || ' Official Community' FROM public.schools s
ON CONFLICT (school_id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO public.institution_communities (university_id, name)
SELECT u.id, u.name || ' Official Community' FROM public.universities u
ON CONFLICT (university_id) DO UPDATE SET name = EXCLUDED.name;

-- ---------------------------------------------------------------------------
-- 3. Repair missing institution IDs for existing users.
-- Prefer the saved registry UUID from Auth metadata. Only use a name/alias if
-- there is exactly one match; ambiguous names are intentionally not guessed.
-- ---------------------------------------------------------------------------
UPDATE public.profiles p
SET institution_name = pg_catalog.left(
  NULLIF(pg_catalog.btrim(au.raw_user_meta_data ->> 'institution_name'), ''),
  180
)
FROM auth.users au
WHERE au.id = p.id
  AND NULLIF(pg_catalog.btrim(p.institution_name), '') IS NULL
  AND NULLIF(pg_catalog.btrim(au.raw_user_meta_data ->> 'institution_name'), '') IS NOT NULL;

UPDATE public.profiles p
SET school_id = s.id,
    institution_name = NULL
FROM auth.users au
JOIN public.schools s
  ON s.id::text = pg_catalog.btrim(COALESCE(au.raw_user_meta_data ->> 'school_id', ''))
WHERE au.id = p.id
  AND p.school_id IS NULL
  AND p.university_id IS NULL
  AND pg_catalog.upper(COALESCE(
    NULLIF(pg_catalog.btrim(p.level), ''),
    NULLIF(pg_catalog.btrim(au.raw_user_meta_data ->> 'level'), '')
  )) IN ('O_LEVEL','A_LEVEL');

UPDATE public.profiles p
SET university_id = u.id,
    institution_name = NULL
FROM auth.users au
JOIN public.universities u
  ON u.id::text = pg_catalog.btrim(COALESCE(au.raw_user_meta_data ->> 'university_id', ''))
WHERE au.id = p.id
  AND p.university_id IS NULL
  AND p.school_id IS NULL
  AND pg_catalog.upper(COALESCE(
    NULLIF(pg_catalog.btrim(p.level), ''),
    NULLIF(pg_catalog.btrim(au.raw_user_meta_data ->> 'level'), '')
  )) = 'UNIVERSITY';

WITH source_names AS (
  SELECT
    p.id AS profile_id,
    pg_catalog.upper(COALESCE(
      NULLIF(pg_catalog.btrim(p.level), ''),
      NULLIF(pg_catalog.btrim(au.raw_user_meta_data ->> 'level'), '')
    )) AS level_code,
    COALESCE(
      NULLIF(pg_catalog.btrim(p.institution_name), ''),
      NULLIF(pg_catalog.btrim(au.raw_user_meta_data ->> 'institution_name'), '')
    ) AS institution_label
  FROM public.profiles p
  JOIN auth.users au ON au.id = p.id
  WHERE p.school_id IS NULL
    AND p.university_id IS NULL
),
school_candidates AS (
  SELECT sn.profile_id, s.id AS institution_id,
         pg_catalog.count(*) OVER (PARTITION BY sn.profile_id) AS matches
  FROM source_names sn
  JOIN public.schools s ON (
    public.smartnekam_normalize_institution_name(sn.institution_label)
      = public.smartnekam_normalize_institution_name(s.name)
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.unnest(COALESCE(s.aliases, ARRAY[]::text[])) AS alias_name(value)
      WHERE public.smartnekam_normalize_institution_name(sn.institution_label)
        = public.smartnekam_normalize_institution_name(alias_name.value)
    )
  )
  WHERE sn.level_code IN ('O_LEVEL','A_LEVEL')
    AND NULLIF(public.smartnekam_normalize_institution_name(sn.institution_label), '') IS NOT NULL
),
unique_school_matches AS (
  SELECT profile_id, institution_id FROM school_candidates WHERE matches = 1
)
UPDATE public.profiles p
SET school_id = m.institution_id, institution_name = NULL
FROM unique_school_matches m
WHERE p.id = m.profile_id;

WITH source_names AS (
  SELECT
    p.id AS profile_id,
    pg_catalog.upper(COALESCE(
      NULLIF(pg_catalog.btrim(p.level), ''),
      NULLIF(pg_catalog.btrim(au.raw_user_meta_data ->> 'level'), '')
    )) AS level_code,
    COALESCE(
      NULLIF(pg_catalog.btrim(p.institution_name), ''),
      NULLIF(pg_catalog.btrim(au.raw_user_meta_data ->> 'institution_name'), '')
    ) AS institution_label
  FROM public.profiles p
  JOIN auth.users au ON au.id = p.id
  WHERE p.school_id IS NULL
    AND p.university_id IS NULL
),
university_candidates AS (
  SELECT sn.profile_id, u.id AS institution_id,
         pg_catalog.count(*) OVER (PARTITION BY sn.profile_id) AS matches
  FROM source_names sn
  JOIN public.universities u ON (
    public.smartnekam_normalize_institution_name(sn.institution_label)
      = public.smartnekam_normalize_institution_name(u.name)
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.unnest(COALESCE(u.aliases, ARRAY[]::text[])) AS alias_name(value)
      WHERE public.smartnekam_normalize_institution_name(sn.institution_label)
        = public.smartnekam_normalize_institution_name(alias_name.value)
    )
  )
  WHERE sn.level_code = 'UNIVERSITY'
    AND NULLIF(public.smartnekam_normalize_institution_name(sn.institution_label), '') IS NOT NULL
),
unique_university_matches AS (
  SELECT profile_id, institution_id FROM university_candidates WHERE matches = 1
)
UPDATE public.profiles p
SET university_id = m.institution_id, institution_name = NULL
FROM unique_university_matches m
WHERE p.id = m.profile_id;

-- ---------------------------------------------------------------------------
-- 4. Automatically sync a profile to its correct official community on signup
-- or if the school/university field is repaired/changed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.smartnekam_ensure_institution_community()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE'
     AND (OLD.school_id IS DISTINCT FROM NEW.school_id
          OR OLD.university_id IS DISTINCT FROM NEW.university_id) THEN
    DELETE FROM public.institution_community_members m
    USING public.institution_communities c
    WHERE m.community_id = c.id
      AND m.user_id = NEW.id
      AND (
        (c.school_id IS NOT NULL AND c.school_id IS DISTINCT FROM NEW.school_id)
        OR
        (c.university_id IS NOT NULL AND c.university_id IS DISTINCT FROM NEW.university_id)
      );
  END IF;

  IF NEW.school_id IS NOT NULL THEN
    INSERT INTO public.institution_communities (school_id, name)
    SELECT s.id, s.name || ' Official Community'
    FROM public.schools s WHERE s.id = NEW.school_id
    ON CONFLICT (school_id) DO UPDATE SET name = EXCLUDED.name;

    INSERT INTO public.institution_community_members
      (community_id, user_id, member_role, verified_student)
    SELECT c.id, NEW.id, 'member', true
    FROM public.institution_communities c
    WHERE c.school_id = NEW.school_id
    ON CONFLICT (community_id, user_id) DO UPDATE
      SET member_role = 'member', verified_student = true;
  ELSIF NEW.university_id IS NOT NULL THEN
    INSERT INTO public.institution_communities (university_id, name)
    SELECT u.id, u.name || ' Official Community'
    FROM public.universities u WHERE u.id = NEW.university_id
    ON CONFLICT (university_id) DO UPDATE SET name = EXCLUDED.name;

    INSERT INTO public.institution_community_members
      (community_id, user_id, member_role, verified_student)
    SELECT c.id, NEW.id, 'member', true
    FROM public.institution_communities c
    WHERE c.university_id = NEW.university_id
    ON CONFLICT (community_id, user_id) DO UPDATE
      SET member_role = 'member', verified_student = true;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS profiles_auto_join_institution_community ON public.profiles;
CREATE TRIGGER profiles_auto_join_institution_community
AFTER INSERT OR UPDATE OF school_id, university_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.smartnekam_ensure_institution_community();

-- Backfill membership for existing profiles whose IDs are already correct.
INSERT INTO public.institution_community_members
  (community_id, user_id, member_role, verified_student)
SELECT c.id, p.id, 'member', true
FROM public.profiles p
JOIN public.institution_communities c
  ON (c.school_id IS NOT NULL AND c.school_id = p.school_id)
  OR (c.university_id IS NOT NULL AND c.university_id = p.university_id)
WHERE p.status = 'active'
ON CONFLICT (community_id, user_id) DO UPDATE
  SET member_role = 'member', verified_student = true;

-- Official communities are strictly institution-scoped. Remove stale memberships
-- created by earlier versions where a user had a different school/university ID.
DELETE FROM public.institution_community_members m
USING public.institution_communities c, public.profiles p
WHERE m.community_id = c.id
  AND m.user_id = p.id
  AND (
    (c.school_id IS NOT NULL AND p.school_id IS DISTINCT FROM c.school_id)
    OR
    (c.university_id IS NOT NULL AND p.university_id IS DISTINCT FROM c.university_id)
  );

-- ---------------------------------------------------------------------------
-- 5. Make the join button repair the signed-in user's missing ID from trusted
-- signup metadata or a unique registry name, then enforce exact institution ID.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_smartnekam_institution_community(p_community_id uuid)
RETURNS TABLE (
  result_community_id uuid,
  result_member_role text,
  result_verified_student boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_school_id uuid;
  v_university_id uuid;
  v_profile_level text;
  v_institution_name text;
  v_meta jsonb;
  v_community_school_id uuid;
  v_community_university_id uuid;
  v_matches bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Ingia kwenye SmartNekam kwanza.' USING ERRCODE = '42501';
  END IF;

  SELECT p.school_id, p.university_id, p.level, p.institution_name
    INTO v_school_id, v_university_id, v_profile_level, v_institution_name
  FROM public.profiles p
  WHERE p.id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile haijapatikana. Kamilisha profile yako kwanza.' USING ERRCODE = 'P0002';
  END IF;

  SELECT au.raw_user_meta_data INTO v_meta
  FROM auth.users au WHERE au.id = v_user_id;
  v_profile_level := pg_catalog.upper(COALESCE(
    NULLIF(pg_catalog.btrim(v_profile_level), ''),
    NULLIF(pg_catalog.btrim(v_meta ->> 'level'), '')
  ));
  v_institution_name := COALESCE(
    NULLIF(pg_catalog.btrim(v_institution_name), ''),
    NULLIF(pg_catalog.btrim(v_meta ->> 'institution_name'), '')
  );

  -- Trust exact registry IDs stored at signup when the profile ID is missing.
  IF v_school_id IS NULL AND v_university_id IS NULL
     AND v_profile_level IN ('O_LEVEL','A_LEVEL')
     AND NULLIF(pg_catalog.btrim(v_meta ->> 'school_id'), '') IS NOT NULL THEN
    SELECT s.id INTO v_school_id
    FROM public.schools s
    WHERE s.id::text = pg_catalog.btrim(v_meta ->> 'school_id');
  ELSIF v_school_id IS NULL AND v_university_id IS NULL
     AND v_profile_level = 'UNIVERSITY'
     AND NULLIF(pg_catalog.btrim(v_meta ->> 'university_id'), '') IS NOT NULL THEN
    SELECT u.id INTO v_university_id
    FROM public.universities u
    WHERE u.id::text = pg_catalog.btrim(v_meta ->> 'university_id');
  END IF;

  -- If the stored name is all that remains, accept it only when uniquely mapped.
  IF v_school_id IS NULL AND v_university_id IS NULL
     AND v_profile_level IN ('O_LEVEL','A_LEVEL')
     AND NULLIF(public.smartnekam_normalize_institution_name(v_institution_name), '') IS NOT NULL THEN
    SELECT pg_catalog.count(*), (pg_catalog.array_agg(s.id ORDER BY s.id))[1]
      INTO v_matches, v_school_id
    FROM public.schools s
    WHERE public.smartnekam_normalize_institution_name(s.name)
            = public.smartnekam_normalize_institution_name(v_institution_name)
       OR EXISTS (
          SELECT 1 FROM pg_catalog.unnest(COALESCE(s.aliases, ARRAY[]::text[])) AS a(value)
          WHERE public.smartnekam_normalize_institution_name(a.value)
              = public.smartnekam_normalize_institution_name(v_institution_name)
       );
    IF v_matches <> 1 THEN v_school_id := NULL; END IF;
  ELSIF v_school_id IS NULL AND v_university_id IS NULL
     AND v_profile_level = 'UNIVERSITY'
     AND NULLIF(public.smartnekam_normalize_institution_name(v_institution_name), '') IS NOT NULL THEN
    SELECT pg_catalog.count(*), (pg_catalog.array_agg(u.id ORDER BY u.id))[1]
      INTO v_matches, v_university_id
    FROM public.universities u
    WHERE public.smartnekam_normalize_institution_name(u.name)
            = public.smartnekam_normalize_institution_name(v_institution_name)
       OR EXISTS (
          SELECT 1 FROM pg_catalog.unnest(COALESCE(u.aliases, ARRAY[]::text[])) AS a(value)
          WHERE public.smartnekam_normalize_institution_name(a.value)
              = public.smartnekam_normalize_institution_name(v_institution_name)
       );
    IF v_matches <> 1 THEN v_university_id := NULL; END IF;
  END IF;

  IF v_school_id IS NOT NULL OR v_university_id IS NOT NULL THEN
    UPDATE public.profiles p
    SET school_id = v_school_id,
        university_id = v_university_id,
        institution_name = NULL
    WHERE p.id = v_user_id
      AND (p.school_id IS DISTINCT FROM v_school_id
           OR p.university_id IS DISTINCT FROM v_university_id
           OR p.institution_name IS NOT NULL);
  END IF;

  SELECT c.school_id, c.university_id
    INTO v_community_school_id, v_community_university_id
  FROM public.institution_communities c
  WHERE c.id = p_community_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Official Community haijapatikana. Tafadhali jaribu tena au wasiliana na usaidizi.' USING ERRCODE = 'P0002';
  END IF;

  SELECT p.school_id, p.university_id
    INTO v_school_id, v_university_id
  FROM public.profiles p WHERE p.id = v_user_id;

  IF v_community_school_id IS NOT NULL
     AND v_school_id IS DISTINCT FROM v_community_school_id THEN
    RAISE EXCEPTION 'Shule haijaunganishwa kwenye profile yako. Chagua shule kwenye sajili rasmi ya SmartNekam au wasiliana na usaidizi; majina yanayofanana pekee hayaruhusu kujiunga.' USING ERRCODE = '42501';
  END IF;
  IF v_community_university_id IS NOT NULL
     AND v_university_id IS DISTINCT FROM v_community_university_id THEN
    RAISE EXCEPTION 'Chuo hakijaunganishwa kwenye profile yako. Chagua chuo kwenye sajili rasmi ya SmartNekam au wasiliana na usaidizi; majina yanayofanana pekee hayaruhusu kujiunga.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.institution_community_members
    (community_id, user_id, member_role, verified_student)
  VALUES (p_community_id, v_user_id, 'member', true)
  ON CONFLICT (community_id, user_id) DO UPDATE
    SET member_role = 'member', verified_student = true;

  RETURN QUERY
  SELECT p_community_id, m.member_role, m.verified_student
  FROM public.institution_community_members m
  WHERE m.community_id = p_community_id AND m.user_id = v_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.smartnekam_sync_school_community() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.smartnekam_sync_university_community() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.smartnekam_ensure_institution_community() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.join_smartnekam_institution_community(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_smartnekam_institution_community(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Global search indexes are intentionally omitted in this migration.
-- PostgreSQL rejected at least one expression index in this deployment with
-- SQLSTATE 42P17 (non-IMMUTABLE function in index expression). The search RPC
-- below remains functional without these optional performance indexes. Once the
-- exact failing expression is identified against the target schema, safe indexes
-- can be added in a separate migration.
--
-- 7. One global search RPC. Existing search categories remain intact. Additional
-- results include public feed posts/replies, official institutions, visible
-- group posts, answers/comments, verified mentors and public events/live rooms.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_smartnekam_global(
  p_query text,
  p_limit integer DEFAULT 30,
  p_type text DEFAULT NULL
)
RETURNS TABLE (
  result_type text,
  result_id uuid,
  title text,
  summary text,
  level text,
  created_at timestamptz,
  relevance real,
  is_verified boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  WITH input AS (
    SELECT
      pg_catalog.btrim(COALESCE(p_query, '')) AS needle,
      pg_catalog.websearch_to_tsquery('simple'::regconfig,
        NULLIF(pg_catalog.btrim(COALESCE(p_query, '')), '')) AS tsq
  ),
  base_results AS (
    SELECT b.result_type, b.result_id, b.title, b.summary, b.level,
           b.created_at, b.relevance, b.is_verified
    FROM public.search_smartnekam(p_query, 50, p_type) b
  ),
  extra_results AS (
    -- Official school and university communities. Return institution ID so the
    -- existing institution detail page can be opened directly.
    SELECT
      'institution_communities'::text AS result_type,
      coalesce(s.id, u.id) AS result_id,
      coalesce(s.name, u.name, c.name)::text AS title,
      pg_catalog.left(
        pg_catalog.concat_ws(' · ',
          c.description,
          NULLIF(s.region, ''),
          NULLIF(u.region, ''),
          NULLIF(s.country, ''),
          NULLIF(u.country, '')
        ), 240
      )::text AS summary,
      CASE WHEN s.id IS NOT NULL THEN 'SCHOOL' ELSE 'UNIVERSITY' END::text AS level,
      c.created_at,
      pg_catalog.ts_rank_cd(
        pg_catalog.to_tsvector('simple'::regconfig,
          COALESCE(c.name, '') || ' ' ||
          COALESCE(s.name, '') || ' ' ||
          COALESCE(u.name, '') || ' ' ||
          COALESCE(s.region, '') || ' ' ||
          COALESCE(u.region, '') || ' ' ||
          COALESCE(s.country, '') || ' ' ||
          COALESCE(u.country, '') || ' ' ||
          COALESCE(pg_catalog.array_to_string(s.aliases, ' '), '') || ' ' ||
          COALESCE(pg_catalog.array_to_string(u.aliases, ' '), '') || ' ' ||
          COALESCE(c.description, '')
        ), i.tsq
      )::real AS relevance,
      NULL::boolean AS is_verified
    FROM public.institution_communities c
    LEFT JOIN public.schools s ON s.id = c.school_id
    LEFT JOIN public.universities u ON u.id = c.university_id
    CROSS JOIN input i
    WHERE pg_catalog.char_length(i.needle) >= 2 AND i.tsq IS NOT NULL
      AND (p_type IS NULL OR p_type = 'institution_communities')
      AND pg_catalog.to_tsvector('simple'::regconfig,
          COALESCE(c.name, '') || ' ' ||
          COALESCE(s.name, '') || ' ' ||
          COALESCE(u.name, '') || ' ' ||
          COALESCE(s.region, '') || ' ' ||
          COALESCE(u.region, '') || ' ' ||
          COALESCE(s.country, '') || ' ' ||
          COALESCE(u.country, '') || ' ' ||
          COALESCE(pg_catalog.array_to_string(s.aliases, ' '), '') || ' ' ||
          COALESCE(pg_catalog.array_to_string(u.aliases, ' '), '') || ' ' ||
          COALESCE(c.description, '')
        ) @@ i.tsq

    UNION ALL

    -- Published home-feed posts only; the feed view already masks anonymous authors.
    SELECT
      'posts'::text,
      p.id,
      coalesce(NULLIF(p.subject, ''), pg_catalog.left(p.content, 120))::text,
      pg_catalog.left(
        COALESCE(p.content, '') ||
        CASE WHEN NULLIF(p.subject, '') IS NOT NULL THEN ' · ' || p.subject ELSE '' END,
        240
      )::text,
      p.category::text,
      p.created_at,
      pg_catalog.ts_rank_cd(
        pg_catalog.to_tsvector('simple'::regconfig,
          COALESCE(p.subject, '') || ' ' ||
          COALESCE(p.category, '') || ' ' ||
          COALESCE(p.content, '')), i.tsq
      )::real,
      NULL::boolean
    FROM public.posts_feed p
    CROSS JOIN input i
    WHERE pg_catalog.char_length(i.needle) >= 2 AND i.tsq IS NOT NULL
      AND (p_type IS NULL OR p_type = 'posts')
      AND pg_catalog.to_tsvector('simple'::regconfig,
          COALESCE(p.subject, '') || ' ' ||
          COALESCE(p.category, '') || ' ' ||
          COALESCE(p.content, '')) @@ i.tsq

    UNION ALL

    -- Public post comments point back to the parent post, never to a private message.
    SELECT
      'posts'::text,
      p.id,
      coalesce(NULLIF(p.subject, ''), pg_catalog.left(p.content, 120))::text,
      pg_catalog.left(c.content, 240)::text,
      p.category::text,
      c.created_at,
      pg_catalog.ts_rank_cd(
        pg_catalog.to_tsvector('simple'::regconfig,
          COALESCE(p.subject, '') || ' ' ||
          COALESCE(p.content, '') || ' ' ||
          COALESCE(c.content, '')), i.tsq
      )::real,
      NULL::boolean
    FROM public.post_comments_feed c
    JOIN public.posts_feed p ON p.id = c.post_id
    CROSS JOIN input i
    WHERE pg_catalog.char_length(i.needle) >= 2 AND i.tsq IS NOT NULL
      AND (p_type IS NULL OR p_type = 'posts')
      AND pg_catalog.to_tsvector('simple'::regconfig,
          COALESCE(p.subject, '') || ' ' ||
          COALESCE(p.content, '') || ' ' ||
          COALESCE(c.content, '')) @@ i.tsq

    UNION ALL

    -- Answers are shown as Q&A results and route to their parent question.
    SELECT
      'questions'::text,
      q.id,
      coalesce(NULLIF(q.title, ''), pg_catalog.left(q.body, 120))::text,
      pg_catalog.left(a.body, 240)::text,
      s.level::text,
      a.created_at,
      pg_catalog.ts_rank_cd(
        pg_catalog.to_tsvector('simple'::regconfig,
          COALESCE(q.title, '') || ' ' ||
          COALESCE(q.body, '') || ' ' ||
          COALESCE(a.body, '') || ' ' ||
          COALESCE(s.name, '')), i.tsq
      )::real,
      NULL::boolean
    FROM public.answers a
    JOIN public.questions q ON q.id = a.question_id
    JOIN public.subjects s ON s.id = q.subject_id
    CROSS JOIN input i
    WHERE pg_catalog.char_length(i.needle) >= 2 AND i.tsq IS NOT NULL
      AND (p_type IS NULL OR p_type = 'questions')
      AND q.status IN ('open','resolved')
      AND pg_catalog.to_tsvector('simple'::regconfig,
          COALESCE(q.title, '') || ' ' ||
          COALESCE(q.body, '') || ' ' ||
          COALESCE(a.body, '') || ' ' ||
          COALESCE(s.name, '')) @@ i.tsq

    UNION ALL

    SELECT
      'questions'::text,
      q.id,
      coalesce(NULLIF(q.title, ''), pg_catalog.left(q.body, 120))::text,
      pg_catalog.left(c.body, 240)::text,
      s.level::text,
      c.created_at,
      pg_catalog.ts_rank_cd(
        pg_catalog.to_tsvector('simple'::regconfig,
          COALESCE(q.title, '') || ' ' ||
          COALESCE(q.body, '') || ' ' ||
          COALESCE(c.body, '') || ' ' ||
          COALESCE(s.name, '')), i.tsq
      )::real,
      NULL::boolean
    FROM public.question_comments c
    JOIN public.questions q ON q.id = c.question_id
    JOIN public.subjects s ON s.id = q.subject_id
    CROSS JOIN input i
    WHERE pg_catalog.char_length(i.needle) >= 2 AND i.tsq IS NOT NULL
      AND (p_type IS NULL OR p_type = 'questions')
      AND q.status IN ('open','resolved')
      AND pg_catalog.to_tsvector('simple'::regconfig,
          COALESCE(q.title, '') || ' ' ||
          COALESCE(q.body, '') || ' ' ||
          COALESCE(c.body, '') || ' ' ||
          COALESCE(s.name, '')) @@ i.tsq

    UNION ALL

    -- Search text inside group posts. RLS on both tables controls whether the
    -- caller can see a group's posts (private groups remain private).
    SELECT
      'study_groups'::text,
      g.id,
      g.name::text,
      pg_catalog.left(p.body, 240)::text,
      g.level::text,
      p.created_at,
      pg_catalog.ts_rank_cd(
        pg_catalog.to_tsvector('simple'::regconfig,
          COALESCE(g.name, '') || ' ' ||
          COALESCE(g.description, '') || ' ' ||
          COALESCE(p.body, '')), i.tsq
      )::real,
      NULL::boolean
    FROM public.group_posts p
    JOIN public.study_groups g ON g.id = p.group_id
    CROSS JOIN input i
    WHERE pg_catalog.char_length(i.needle) >= 2 AND i.tsq IS NOT NULL
      AND (p_type IS NULL OR p_type = 'study_groups')
      AND g.status = 'active'
      AND pg_catalog.to_tsvector('simple'::regconfig,
          COALESCE(g.name, '') || ' ' ||
          COALESCE(g.description, '') || ' ' ||
          COALESCE(p.body, '')) @@ i.tsq

    UNION ALL

    -- Only vetted, active mentors are indexed in global discovery.
    SELECT
      'mentors'::text,
      m.id,
      coalesce(NULLIF(m.display_name, ''), m.headline, 'Mentor')::text,
      pg_catalog.left(
        pg_catalog.concat_ws(' · ', NULLIF(m.headline, ''), NULLIF(m.bio, ''),
          NULLIF(pg_catalog.array_to_string(m.subjects, ', '), '')), 240
      )::text,
      NULL::text,
      m.created_at,
      pg_catalog.ts_rank_cd(
        pg_catalog.to_tsvector('simple'::regconfig,
          COALESCE(m.display_name, '') || ' ' ||
          COALESCE(m.headline, '') || ' ' ||
          COALESCE(m.bio, '') || ' ' ||
          COALESCE(pg_catalog.array_to_string(m.subjects, ' '), '')), i.tsq
      )::real,
      m.verified
    FROM public.mentors m
    CROSS JOIN input i
    WHERE pg_catalog.char_length(i.needle) >= 2 AND i.tsq IS NOT NULL
      AND (p_type IS NULL OR p_type = 'mentors')
      AND m.verified = true AND m.status = 'active'
      AND pg_catalog.to_tsvector('simple'::regconfig,
          COALESCE(m.display_name, '') || ' ' ||
          COALESCE(m.headline, '') || ' ' ||
          COALESCE(m.bio, '') || ' ' ||
          COALESCE(pg_catalog.array_to_string(m.subjects, ' '), '')) @@ i.tsq

    UNION ALL

    SELECT
      'community_events'::text,
      e.id,
      e.title::text,
      pg_catalog.left(pg_catalog.concat_ws(' · ', e.description, e.venue, e.event_type), 240)::text,
      NULL::text,
      e.created_at,
      pg_catalog.ts_rank_cd(
        pg_catalog.to_tsvector('simple'::regconfig,
          COALESCE(e.title, '') || ' ' ||
          COALESCE(e.description, '') || ' ' ||
          COALESCE(e.venue, '') || ' ' ||
          COALESCE(e.event_type, '')), i.tsq
      )::real,
      NULL::boolean
    FROM public.community_events e
    CROSS JOIN input i
    WHERE pg_catalog.char_length(i.needle) >= 2 AND i.tsq IS NOT NULL
      AND (p_type IS NULL OR p_type = 'community_events')
      AND e.status = 'active'
      AND pg_catalog.to_tsvector('simple'::regconfig,
          COALESCE(e.title, '') || ' ' ||
          COALESCE(e.description, '') || ' ' ||
          COALESCE(e.venue, '') || ' ' ||
          COALESCE(e.event_type, '')) @@ i.tsq

    UNION ALL

    SELECT
      'live_sessions'::text,
      l.id,
      l.title::text,
      pg_catalog.left(l.description, 240)::text,
      NULL::text,
      l.scheduled_start,
      pg_catalog.ts_rank_cd(
        pg_catalog.to_tsvector('simple'::regconfig,
          COALESCE(l.title, '') || ' ' ||
          COALESCE(l.description, '')), i.tsq
      )::real,
      NULL::boolean
    FROM public.live_sessions l
    CROSS JOIN input i
    WHERE pg_catalog.char_length(i.needle) >= 2 AND i.tsq IS NOT NULL
      AND (p_type IS NULL OR p_type = 'live_sessions')
      AND l.status IN ('scheduled','live')
      AND l.access_type = 'public'
      AND pg_catalog.to_tsvector('simple'::regconfig,
          COALESCE(l.title, '') || ' ' ||
          COALESCE(l.description, '')) @@ i.tsq

    UNION ALL

    -- Search lesson text only where the current caller's RLS policy lets them
    -- read the lesson (published preview, active enrolment, owner or moderator).
    SELECT
      'course_lessons'::text,
      l.course_id,
      coalesce(NULLIF(c.title, ''), l.title)::text,
      pg_catalog.left(pg_catalog.concat_ws(' · ', l.title, l.description, l.content), 240)::text,
      c.level::text,
      l.created_at,
      pg_catalog.ts_rank_cd(
        pg_catalog.to_tsvector('simple'::regconfig,
          COALESCE(c.title, '') || ' ' ||
          COALESCE(l.title, '') || ' ' ||
          COALESCE(l.description, '') || ' ' ||
          COALESCE(l.content, '') || ' ' ||
          COALESCE(l.lesson_type, '')), i.tsq
      )::real,
      NULL::boolean
    FROM public.course_lessons l
    JOIN public.courses c ON c.id = l.course_id
    CROSS JOIN input i
    WHERE pg_catalog.char_length(i.needle) >= 2 AND i.tsq IS NOT NULL
      AND (p_type IS NULL OR p_type = 'course_lessons')
      AND l.status = 'published'
      AND c.status = 'published'
      AND pg_catalog.to_tsvector('simple'::regconfig,
          COALESCE(c.title, '') || ' ' ||
          COALESCE(l.title, '') || ' ' ||
          COALESCE(l.description, '') || ' ' ||
          COALESCE(l.content, '') || ' ' ||
          COALESCE(l.lesson_type, '')) @@ i.tsq

    UNION ALL

    SELECT
      'courses'::text,
      m.course_id,
      c.title::text,
      pg_catalog.left(pg_catalog.concat_ws(' · ', m.title, m.description), 240)::text,
      c.level::text,
      m.created_at,
      pg_catalog.ts_rank_cd(
        pg_catalog.to_tsvector('simple'::regconfig,
          COALESCE(c.title, '') || ' ' ||
          COALESCE(m.title, '') || ' ' ||
          COALESCE(m.description, '')), i.tsq
      )::real,
      NULL::boolean
    FROM public.course_modules m
    JOIN public.courses c ON c.id = m.course_id
    CROSS JOIN input i
    WHERE pg_catalog.char_length(i.needle) >= 2 AND i.tsq IS NOT NULL
      AND (p_type IS NULL OR p_type = 'courses')
      AND c.status = 'published'
      AND pg_catalog.to_tsvector('simple'::regconfig,
          COALESCE(c.title, '') || ' ' ||
          COALESCE(m.title, '') || ' ' ||
          COALESCE(m.description, '')) @@ i.tsq

    UNION ALL

    SELECT
      'study_channels'::text,
      ch.id,
      ch.title::text,
      pg_catalog.left(pg_catalog.concat_ws(' · ', ch.description, ch.level), 240)::text,
      ch.level::text,
      ch.created_at,
      pg_catalog.ts_rank_cd(
        pg_catalog.to_tsvector('simple'::regconfig,
          COALESCE(ch.slug, '') || ' ' ||
          COALESCE(ch.title, '') || ' ' ||
          COALESCE(ch.description, '') || ' ' ||
          COALESCE(ch.level, '')), i.tsq
      )::real,
      NULL::boolean
    FROM public.study_channels ch
    CROSS JOIN input i
    WHERE pg_catalog.char_length(i.needle) >= 2 AND i.tsq IS NOT NULL
      AND (p_type IS NULL OR p_type = 'study_channels')
      AND pg_catalog.to_tsvector('simple'::regconfig,
          COALESCE(ch.slug, '') || ' ' ||
          COALESCE(ch.title, '') || ' ' ||
          COALESCE(ch.description, '') || ' ' ||
          COALESCE(ch.level, '')) @@ i.tsq
  ),
  combined AS (
    SELECT * FROM base_results
    UNION ALL
    SELECT * FROM extra_results
  ),
  deduplicated AS (
    SELECT c.*,
      pg_catalog.row_number() OVER (
        PARTITION BY c.result_type, c.result_id
        ORDER BY c.relevance DESC NULLS LAST, c.created_at DESC NULLS LAST
      ) AS result_rank
    FROM combined c
  )
  SELECT d.result_type, d.result_id, d.title, d.summary, d.level, d.created_at,
         d.relevance, d.is_verified
  FROM deduplicated d
  WHERE d.result_rank = 1
  ORDER BY d.relevance DESC NULLS LAST, d.created_at DESC NULLS LAST
  LIMIT LEAST(GREATEST(coalesce(p_limit, 30), 1), 50);
$function$;

REVOKE ALL ON FUNCTION public.search_smartnekam_global(text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_smartnekam_global(text, integer, text) TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';

-- Smoke test after applying:
-- SELECT * FROM public.search_smartnekam_global('mathematics', 20, NULL);
-- SELECT * FROM public.search_smartnekam_global('name of your school', 20, 'institution_communities');

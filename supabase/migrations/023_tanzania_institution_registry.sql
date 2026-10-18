-- SmartNekam SQL 023: official Tanzania institution registry metadata and search support.
-- Run after migrations 001A-022. This is additive; it preserves existing schools/universities.
BEGIN;

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS source_code text,
  ADD COLUMN IF NOT EXISTS source_name text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS education_levels text[] NOT NULL DEFAULT ARRAY[]::text[];

ALTER TABLE public.universities
  ADD COLUMN IF NOT EXISTS source_code text,
  ADD COLUMN IF NOT EXISTS source_name text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS institution_type text NOT NULL DEFAULT 'UNIVERSITY',
  ADD COLUMN IF NOT EXISTS registration_status text;

-- source_code is NULL for legacy/manual entries; official imported rows use stable prefixed codes.
CREATE UNIQUE INDEX IF NOT EXISTS schools_source_code_unique_idx ON public.schools(source_code);
CREATE UNIQUE INDEX IF NOT EXISTS universities_source_code_unique_idx ON public.universities(source_code);
CREATE INDEX IF NOT EXISTS schools_country_region_name_idx ON public.schools(country, region, lower(name));
CREATE INDEX IF NOT EXISTS universities_country_region_name_idx ON public.universities(country, region, lower(name));
CREATE INDEX IF NOT EXISTS schools_type_idx ON public.schools(school_type);
CREATE INDEX IF NOT EXISTS universities_type_idx ON public.universities(institution_type);

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
-- The app only needs users to read their own institution-membership row here;
-- avoid a same-table recursive RLS policy when checking if the current user joined.
DROP POLICY IF EXISTS "Institution memberships visible to members" ON public.institution_community_members;
DROP POLICY IF EXISTS institution_memberships_read_own ON public.institution_community_members;
CREATE POLICY institution_memberships_read_own ON public.institution_community_members
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS schools_public_read ON public.schools;
CREATE POLICY schools_public_read ON public.schools FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS universities_public_read ON public.universities;
CREATE POLICY universities_public_read ON public.universities FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public.schools, public.universities TO anon, authenticated;

-- One search endpoint for searchable, paginated picker/directory UIs.
CREATE OR REPLACE FUNCTION public.search_smartnekam_institutions(
  p_kind text DEFAULT 'school',
  p_query text DEFAULT '',
  p_limit integer DEFAULT 30,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  name text,
  region text,
  country text,
  institution_type text,
  source_code text,
  source_name text,
  last_verified_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_limit integer := greatest(1, least(coalesce(p_limit, 30), 100));
  v_offset integer := greatest(0, least(coalesce(p_offset, 0), 1000000));
  v_query text := btrim(coalesce(p_query, ''));
BEGIN
  IF lower(coalesce(p_kind, 'school')) IN ('school','secondary','high','schools') THEN
    RETURN QUERY
      SELECT s.id, s.name::text, s.region::text, s.country::text,
             coalesce(s.school_type, 'SECONDARY')::text, s.source_code, s.source_name, s.last_verified_at
      FROM public.schools s
      WHERE v_query = '' OR s.name ILIKE ('%' || v_query || '%')
         OR coalesce(s.source_code, '') ILIKE ('%' || v_query || '%')
         OR array_to_string(s.aliases, ' ') ILIKE ('%' || v_query || '%')
      ORDER BY s.name
      LIMIT v_limit OFFSET v_offset;
  ELSIF lower(coalesce(p_kind, '')) IN ('tertiary','college','university','universities','college_university') THEN
    RETURN QUERY
      SELECT u.id, u.name::text, u.region::text, u.country::text,
             coalesce(u.institution_type, 'UNIVERSITY')::text, u.source_code, u.source_name, u.last_verified_at
      FROM public.universities u
      WHERE v_query = '' OR u.name ILIKE ('%' || v_query || '%')
         OR coalesce(u.source_code, '') ILIKE ('%' || v_query || '%')
         OR array_to_string(u.aliases, ' ') ILIKE ('%' || v_query || '%')
      ORDER BY u.name
      LIMIT v_limit OFFSET v_offset;
  ELSE
    RAISE EXCEPTION 'Unknown institution kind: %. Use school or tertiary.', p_kind USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.search_smartnekam_institutions(text,text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_smartnekam_institutions(text,text,integer,integer) TO anon, authenticated;

-- Every school/college registry row gets an Official Institution Community.
-- This is needed because most imported institutions are added after SQL 022.
CREATE OR REPLACE FUNCTION public.smartnekam_sync_school_community()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.institution_communities (school_id, name)
  VALUES (NEW.id, NEW.name || ' Official Community')
  ON CONFLICT (school_id) DO UPDATE SET name = EXCLUDED.name;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.smartnekam_sync_university_community()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.institution_communities (university_id, name)
  VALUES (NEW.id, NEW.name || ' Official Community')
  ON CONFLICT (university_id) DO UPDATE SET name = EXCLUDED.name;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS schools_sync_official_community ON public.schools;
CREATE TRIGGER schools_sync_official_community
AFTER INSERT OR UPDATE OF name ON public.schools
FOR EACH ROW EXECUTE FUNCTION public.smartnekam_sync_school_community();

DROP TRIGGER IF EXISTS universities_sync_official_community ON public.universities;
CREATE TRIGGER universities_sync_official_community
AFTER INSERT OR UPDATE OF name ON public.universities
FOR EACH ROW EXECUTE FUNCTION public.smartnekam_sync_university_community();

-- Backfill every institution that was already in Supabase before this migration.
INSERT INTO public.institution_communities (school_id, name)
SELECT s.id, s.name || ' Official Community' FROM public.schools s
ON CONFLICT (school_id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO public.institution_communities (university_id, name)
SELECT u.id, u.name || ' Official Community' FROM public.universities u
ON CONFLICT (university_id) DO UPDATE SET name = EXCLUDED.name;

-- Let authenticated learners join a community as a visitor or as a student whose
-- profile institution matches. The function owns the controlled insert; clients
-- do not receive direct INSERT rights on the membership table.
CREATE OR REPLACE FUNCTION public.join_smartnekam_institution_community(p_community_id uuid)
RETURNS TABLE (result_community_id uuid, result_member_role text, result_verified_student boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_school_id uuid;
  v_university_id uuid;
  v_profile_school_id uuid;
  v_profile_university_id uuid;
  v_role text;
  v_verified boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in is required to join an institution community.' USING ERRCODE = '42501';
  END IF;

  SELECT c.school_id, c.university_id
    INTO v_school_id, v_university_id
  FROM public.institution_communities c
  WHERE c.id = p_community_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Institution community was not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT p.school_id, p.university_id
    INTO v_profile_school_id, v_profile_university_id
  FROM public.profiles p
  WHERE p.id = v_user_id;

  v_verified := (v_school_id IS NOT NULL AND v_school_id = v_profile_school_id)
             OR (v_university_id IS NOT NULL AND v_university_id = v_profile_university_id);
  v_role := CASE WHEN v_verified THEN 'member' ELSE 'visitor' END;

  INSERT INTO public.institution_community_members (community_id, user_id, member_role, verified_student)
  VALUES (p_community_id, v_user_id, v_role, coalesce(v_verified, false))
  ON CONFLICT (community_id, user_id) DO NOTHING;

  RETURN QUERY
  SELECT p_community_id, m.member_role, m.verified_student
  FROM public.institution_community_members m
  WHERE m.community_id = p_community_id AND m.user_id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.smartnekam_sync_school_community() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.smartnekam_sync_university_community() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_smartnekam_institution_community(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_smartnekam_institution_community(uuid) TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';

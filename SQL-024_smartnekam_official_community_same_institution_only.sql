-- SmartNekam SQL 024: Official school/college communities are for matching students only.
-- Run after SQL 022 and 023. General Q&A and Study Groups remain open to all signed-in learners.
BEGIN;

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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Ingia kwenye SmartNekam kwanza.' USING ERRCODE = '42501';
  END IF;

  SELECT c.school_id, c.university_id
    INTO v_school_id, v_university_id
  FROM public.institution_communities AS c
  WHERE c.id = p_community_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Official Community haijapatikana.' USING ERRCODE = 'P0002';
  END IF;

  SELECT p.school_id, p.university_id
    INTO v_profile_school_id, v_profile_university_id
  FROM public.profiles AS p
  WHERE p.id = v_user_id;

  IF v_school_id IS NOT NULL AND v_profile_school_id IS DISTINCT FROM v_school_id THEN
    RAISE EXCEPTION 'Official Community hii ni ya wanafunzi wa shule hii pekee. Rekebisha shule kwenye profile yako ikiwa taarifa si sahihi.' USING ERRCODE = '42501';
  END IF;
  IF v_university_id IS NOT NULL AND v_profile_university_id IS DISTINCT FROM v_university_id THEN
    RAISE EXCEPTION 'Official Community hii ni ya wanafunzi wa chuo hiki pekee. Rekebisha chuo kwenye profile yako ikiwa taarifa si sahihi.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.institution_community_members (community_id, user_id, member_role, verified_student)
  VALUES (p_community_id, v_user_id, 'member', true)
  ON CONFLICT (community_id, user_id) DO UPDATE
    SET member_role = 'member', verified_student = true;

  RETURN QUERY
  SELECT p_community_id, m.member_role, m.verified_student
  FROM public.institution_community_members AS m
  WHERE m.community_id = p_community_id AND m.user_id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.join_smartnekam_institution_community(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_smartnekam_institution_community(uuid) TO authenticated;

-- Remove old visitor/wrong-institution memberships created by the earlier permissive RPC.
DELETE FROM public.institution_community_members AS m
USING public.institution_communities AS c, public.profiles AS p
WHERE m.community_id = c.id
  AND m.user_id = p.id
  AND (
    (c.school_id IS NOT NULL AND p.school_id IS DISTINCT FROM c.school_id)
    OR (c.university_id IS NOT NULL AND p.university_id IS DISTINCT FROM c.university_id)
  );

-- Keep general study channels visible to all signed-in learners.
DROP POLICY IF EXISTS "Study channels readable by signed in users" ON public.study_channels;
CREATE POLICY "Study channels readable by signed in users"
  ON public.study_channels FOR SELECT TO authenticated USING (true);

COMMIT;
NOTIFY pgrst, 'reload schema';

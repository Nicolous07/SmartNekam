-- SmartNekam SQL 046: Admin Learn publishing and feed promotion controls.
-- Additive migration. Run after the existing SmartNekam migrations on Supabase.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Promoted/pinned feed posts. Sponsored placements require verified payment
-- reference and an end date; ordinary admin pins can remain until unpinned.
-- ---------------------------------------------------------------------------
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_sponsored boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promotion_label text,
  ADD COLUMN IF NOT EXISTS promoted_until timestamptz,
  ADD COLUMN IF NOT EXISTS promotion_payment_reference text,
  ADD COLUMN IF NOT EXISTS promotion_payment_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promoted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promotion_updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS posts_promotion_lookup_idx
  ON public.posts (is_pinned, is_sponsored, promoted_until);

-- Create a course, or add a module/lesson to an existing course.
-- Staff can prepare courses for review; publishing can only be explicitly
-- selected by an active moderator/super_admin. Course access stays governed by
-- the existing enrollment/payment workflow.
CREATE OR REPLACE FUNCTION public.admin_create_learning_content(
  p_existing_course_id uuid,
  p_title text,
  p_description text,
  p_level text,
  p_language text,
  p_access_type text,
  p_price numeric,
  p_currency text,
  p_thumbnail_url text,
  p_estimated_minutes integer,
  p_module_title text,
  p_module_description text,
  p_lesson_title text,
  p_lesson_description text,
  p_lesson_type text,
  p_lesson_content text,
  p_video_url text,
  p_duration_seconds integer,
  p_is_preview boolean,
  p_publish_now boolean
)
RETURNS TABLE (
  result_course_id uuid,
  result_course_status text,
  result_module_id uuid,
  result_lesson_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_account_status text;
  v_course_id uuid;
  v_course_status text;
  v_module_id uuid;
  v_lesson_id uuid;
  v_module_position integer;
  v_lesson_position integer;
  v_course_title text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Ingia kwenye SmartNekam kwanza.' USING ERRCODE = '42501';
  END IF;

  SELECT p.role, p.status
    INTO v_role, v_account_status
  FROM public.profiles p
  WHERE p.id = v_user_id;

  IF v_account_status IS DISTINCT FROM 'active'
     OR COALESCE(v_role, '') NOT IN ('moderator', 'super_admin') THEN
    RAISE EXCEPTION 'Ni moderator au super admin mwenye akaunti active pekee anayeruhusiwa kusimamia Learn.' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(pg_catalog.btrim(COALESCE(p_module_title, '')), '') IS NULL
     OR NULLIF(pg_catalog.btrim(COALESCE(p_lesson_title, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Jaza jina la module na jina la lesson.' USING ERRCODE = '22023';
  END IF;

  IF p_lesson_type IS NULL OR p_lesson_type NOT IN ('text', 'video') THEN
    RAISE EXCEPTION 'Lesson type haikubaliki.' USING ERRCODE = '22023';
  END IF;
  IF p_lesson_type = 'video'
     AND NULLIF(pg_catalog.btrim(COALESCE(p_video_url, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Weka kiungo cha video kwa lesson ya video.' USING ERRCODE = '22023';
  END IF;
  IF p_lesson_type = 'text'
     AND NULLIF(pg_catalog.btrim(COALESCE(p_lesson_content, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Weka maudhui ya lesson ya maandishi.' USING ERRCODE = '22023';
  END IF;

  IF p_existing_course_id IS NULL THEN
    v_course_title := NULLIF(pg_catalog.btrim(COALESCE(p_title, '')), '');
    IF v_course_title IS NULL THEN
      RAISE EXCEPTION 'Weka jina la kozi.' USING ERRCODE = '22023';
    END IF;
    IF p_level NOT IN ('O_LEVEL', 'A_LEVEL', 'UNIVERSITY', 'ALL') THEN
      RAISE EXCEPTION 'Chagua kiwango halali cha kozi.' USING ERRCODE = '22023';
    END IF;
    IF p_language NOT IN ('sw', 'en') THEN
      RAISE EXCEPTION 'Chagua lugha ya Kiswahili au English.' USING ERRCODE = '22023';
    END IF;
    IF p_access_type NOT IN ('free', 'premium') THEN
      RAISE EXCEPTION 'Chagua free au premium.' USING ERRCODE = '22023';
    END IF;
    IF p_access_type = 'premium' AND COALESCE(p_price, 0) <= 0 THEN
      RAISE EXCEPTION 'Kozi ya premium lazima iwe na bei kubwa kuliko sifuri.' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.courses (
      title, description, level, language, access_type, price, currency,
      thumbnail_url, estimated_minutes, creator_id, status, published_at
    )
    VALUES (
      v_course_title,
      COALESCE(NULLIF(pg_catalog.btrim(COALESCE(p_description, '')), ''), ''),
      p_level,
      p_language,
      p_access_type,
      CASE WHEN p_access_type = 'premium' THEN COALESCE(p_price, 0) ELSE 0 END,
      COALESCE(NULLIF(pg_catalog.upper(pg_catalog.btrim(COALESCE(p_currency, ''))), ''), 'TZS'),
      NULLIF(pg_catalog.btrim(COALESCE(p_thumbnail_url, '')), ''),
      GREATEST(COALESCE(p_estimated_minutes, 0), 0),
      v_user_id,
      CASE WHEN p_publish_now THEN 'published' ELSE 'pending_review' END,
      CASE WHEN p_publish_now THEN now() ELSE NULL END
    )
    RETURNING id, status::text INTO v_course_id, v_course_status;
  ELSE
    SELECT c.id, c.status::text, c.title
      INTO v_course_id, v_course_status, v_course_title
    FROM public.courses c
    WHERE c.id = p_existing_course_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Kozi uliyochagua haijapatikana.' USING ERRCODE = 'P0002';
    END IF;

    IF p_publish_now AND v_course_status IS DISTINCT FROM 'published' THEN
      UPDATE public.courses c
      SET status = 'published',
          published_at = COALESCE(c.published_at, now())
      WHERE c.id = v_course_id
      RETURNING c.status::text INTO v_course_status;
    END IF;
  END IF;

  SELECT COALESCE(pg_catalog.max(m.position), 0) + 1
    INTO v_module_position
  FROM public.course_modules m
  WHERE m.course_id = v_course_id;

  INSERT INTO public.course_modules (course_id, title, description, position)
  VALUES (
    v_course_id,
    pg_catalog.btrim(p_module_title),
    NULLIF(pg_catalog.btrim(COALESCE(p_module_description, '')), ''),
    v_module_position
  )
  RETURNING id INTO v_module_id;

  SELECT COALESCE(pg_catalog.max(l.position), 0) + 1
    INTO v_lesson_position
  FROM public.course_lessons l
  WHERE l.course_id = v_course_id
    AND l.module_id = v_module_id;

  INSERT INTO public.course_lessons (
    course_id, module_id, title, description, lesson_type, content,
    video_url, resource_path, duration_seconds, position, is_preview, status
  )
  VALUES (
    v_course_id,
    v_module_id,
    pg_catalog.btrim(p_lesson_title),
    NULLIF(pg_catalog.btrim(COALESCE(p_lesson_description, '')), ''),
    p_lesson_type,
    NULLIF(pg_catalog.btrim(COALESCE(p_lesson_content, '')), ''),
    NULLIF(pg_catalog.btrim(COALESCE(p_video_url, '')), ''),
    NULL,
    GREATEST(COALESCE(p_duration_seconds, 0), 0),
    v_lesson_position,
    COALESCE(p_is_preview, false),
    'published'
  )
  RETURNING id INTO v_lesson_id;

  RETURN QUERY SELECT v_course_id, v_course_status, v_module_id, v_lesson_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_create_learning_content(
  uuid, text, text, text, text, text, numeric, text, text, integer,
  text, text, text, text, text, text, text, integer, boolean, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_learning_content(
  uuid, text, text, text, text, text, numeric, text, text, integer,
  text, text, text, text, text, text, text, integer, boolean, boolean
) TO authenticated;

-- Return visible posts to the admin promotion manager; access is checked in SQL.
CREATE OR REPLACE FUNCTION public.admin_list_posts_for_promotion(p_limit integer DEFAULT 100)
RETURNS TABLE (
  post_id uuid,
  subject text,
  content text,
  category text,
  created_at timestamptz,
  author_name text,
  is_pinned boolean,
  is_sponsored boolean,
  promotion_label text,
  promoted_until timestamptz,
  promotion_payment_reference text,
  promotion_payment_confirmed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_account_status text;
BEGIN
  SELECT p.role, p.status INTO v_role, v_account_status
  FROM public.profiles p WHERE p.id = v_user_id;

  IF v_user_id IS NULL OR v_account_status IS DISTINCT FROM 'active'
     OR COALESCE(v_role, '') NOT IN ('moderator', 'super_admin') THEN
    RAISE EXCEPTION 'Huna ruhusa ya kusimamia posts.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.id,
         p.subject::text,
         p.content::text,
         p.category::text,
         p.created_at,
         pf.author_name::text,
         p.is_pinned,
         p.is_sponsored,
         p.promotion_label,
         p.promoted_until,
         p.promotion_payment_reference,
         p.promotion_payment_confirmed
  FROM public.posts p
  JOIN public.posts_feed pf ON pf.id = p.id
  ORDER BY p.is_pinned DESC, p.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 200));
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_list_posts_for_promotion(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_posts_for_promotion(integer) TO authenticated;

-- Admin-controlled pinning. Sponsored placements are restricted to super_admin
-- and require a manually verified payment reference plus a clear end date.
CREATE OR REPLACE FUNCTION public.admin_update_post_promotion(
  p_post_id uuid,
  p_is_pinned boolean,
  p_is_sponsored boolean,
  p_promotion_label text,
  p_promoted_until timestamptz,
  p_payment_reference text,
  p_payment_confirmed boolean
)
RETURNS TABLE (
  result_post_id uuid,
  result_is_pinned boolean,
  result_is_sponsored boolean,
  result_promoted_until timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_account_status text;
BEGIN
  SELECT p.role, p.status INTO v_role, v_account_status
  FROM public.profiles p WHERE p.id = v_user_id;

  IF v_user_id IS NULL OR v_account_status IS DISTINCT FROM 'active'
     OR COALESCE(v_role, '') NOT IN ('moderator', 'super_admin') THEN
    RAISE EXCEPTION 'Huna ruhusa ya kupin posts.' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(p_is_sponsored, false) AND COALESCE(v_role, '') <> 'super_admin' THEN
    RAISE EXCEPTION 'Ni Super Admin pekee anayeweza kuthibitisha na kuweka matangazo yaliyolipiwa.' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(p_is_sponsored, false) AND (
    NOT COALESCE(p_is_pinned, false)
    OR NOT COALESCE(p_payment_confirmed, false)
    OR NULLIF(pg_catalog.btrim(COALESCE(p_payment_reference, '')), '') IS NULL
    OR p_promoted_until IS NULL
    OR p_promoted_until <= now()
  ) THEN
    RAISE EXCEPTION 'Tangazo lililolipiwa linahitaji kupin, reference ya malipo iliyothibitishwa, na tarehe ya mwisho iliyo mbele.' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(p_is_pinned, false) AND p_promoted_until IS NOT NULL
     AND p_promoted_until <= now() THEN
    RAISE EXCEPTION 'Tarehe ya promotion lazima iwe ya baadaye.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.posts p
  SET is_pinned = COALESCE(p_is_pinned, false),
      is_sponsored = COALESCE(p_is_pinned, false) AND COALESCE(p_is_sponsored, false),
      promotion_label = CASE
        WHEN COALESCE(p_is_pinned, false)
        THEN NULLIF(pg_catalog.left(pg_catalog.btrim(COALESCE(p_promotion_label, '')), 120), '')
        ELSE NULL
      END,
      promoted_until = CASE WHEN COALESCE(p_is_pinned, false) THEN p_promoted_until ELSE NULL END,
      promotion_payment_reference = CASE
        WHEN COALESCE(p_is_pinned, false) AND COALESCE(p_is_sponsored, false)
        THEN pg_catalog.left(pg_catalog.btrim(COALESCE(p_payment_reference, '')), 180)
        ELSE NULL
      END,
      promotion_payment_confirmed = COALESCE(p_is_pinned, false)
        AND COALESCE(p_is_sponsored, false)
        AND COALESCE(p_payment_confirmed, false),
      promoted_by = CASE WHEN COALESCE(p_is_pinned, false) THEN v_user_id ELSE NULL END,
      promotion_updated_at = now()
  WHERE p.id = p_post_id
    AND EXISTS (SELECT 1 FROM public.posts_feed pf WHERE pf.id = p.id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post haijapatikana au haionekani kwenye feed.' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT p.id, p.is_pinned, p.is_sponsored, p.promoted_until
  FROM public.posts p WHERE p.id = p_post_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_update_post_promotion(
  uuid, boolean, boolean, text, timestamptz, text, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_post_promotion(
  uuid, boolean, boolean, text, timestamptz, text, boolean
) TO authenticated;

-- Public-feed clients receive only promotion metadata for live, visible posts.
CREATE OR REPLACE FUNCTION public.get_active_smartnekam_promotions()
RETURNS TABLE (
  post_id uuid,
  is_pinned boolean,
  is_sponsored boolean,
  promotion_label text,
  promoted_until timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p.id, p.is_pinned, p.is_sponsored, p.promotion_label, p.promoted_until
  FROM public.posts p
  WHERE p.is_pinned IS TRUE
    AND (p.promoted_until IS NULL OR p.promoted_until > now())
    AND EXISTS (SELECT 1 FROM public.posts_feed pf WHERE pf.id = p.id)
  ORDER BY p.is_sponsored DESC, p.promotion_updated_at DESC, p.created_at DESC
  LIMIT 100;
$function$;

REVOKE ALL ON FUNCTION public.get_active_smartnekam_promotions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_smartnekam_promotions() TO authenticated;

COMMIT;

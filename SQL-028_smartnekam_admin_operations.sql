-- SmartNekam | SQL-028: secured admin operations for the control panel
-- Prerequisite: migrations SQL 001A/001B through 027, especially SQL 003, 005, 006, 007, 010, 011 and 013.
-- Run the entire file in Supabase SQL Editor. Functions use auth.uid() and role checks;
-- do not expose service_role keys to the browser.

BEGIN;

-- Admin pages must read profile rows beyond auth.uid() for user lists and joins.
-- The policy remains gated by the database-side active moderator/super-admin helper.
DROP POLICY IF EXISTS profiles_select_staff ON public.profiles;
CREATE POLICY profiles_select_staff
  ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_smartnekam_moderator());

-- Moderator read policies for full review queues; public policies intentionally
-- restrict regular learners to approved/visible content.
DROP POLICY IF EXISTS notes_read_moderators ON public.notes;
CREATE POLICY notes_read_moderators
  ON public.notes FOR SELECT TO authenticated
  USING (public.is_smartnekam_moderator());

DROP POLICY IF EXISTS past_papers_read_moderators ON public.past_papers;
CREATE POLICY past_papers_read_moderators
  ON public.past_papers FOR SELECT TO authenticated
  USING (public.is_smartnekam_moderator());

DROP POLICY IF EXISTS study_groups_read_moderators ON public.study_groups;
CREATE POLICY study_groups_read_moderators
  ON public.study_groups FOR SELECT TO authenticated
  USING (public.is_smartnekam_moderator());

DROP POLICY IF EXISTS questions_read_moderators ON public.questions;
CREATE POLICY questions_read_moderators
  ON public.questions FOR SELECT TO authenticated
  USING (public.is_smartnekam_moderator());

DROP POLICY IF EXISTS school_announcements_read_moderators ON public.school_announcements;
CREATE POLICY school_announcements_read_moderators
  ON public.school_announcements FOR SELECT TO authenticated
  USING (public.is_smartnekam_moderator());

-- Fill audit gaps for admin workflow tables whose original RPCs did not log changes.
CREATE OR REPLACE FUNCTION public.admin_audit_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_old JSONB := pg_catalog.to_jsonb(OLD);
  v_new JSONB := pg_catalog.to_jsonb(NEW);
BEGIN
  IF v_actor IS NULL OR NOT public.is_smartnekam_moderator() THEN
    RETURN NEW;
  END IF;

  IF (v_old ->> 'status') IS NOT DISTINCT FROM (v_new ->> 'status')
     AND (v_old ->> 'priority') IS NOT DISTINCT FROM (v_new ->> 'priority')
     AND (v_old ->> 'verified') IS NOT DISTINCT FROM (v_new ->> 'verified')
     AND (v_old ->> 'assigned_to') IS NOT DISTINCT FROM (v_new ->> 'assigned_to') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.admin_audit_log(actor_id, action_name, entity_type, entity_id, details)
  VALUES (
    v_actor,
    ('admin_update_' || TG_TABLE_NAME)::VARCHAR(80),
    TG_TABLE_NAME::VARCHAR(48),
    NULLIF(v_new ->> 'id', '')::UUID,
    pg_catalog.jsonb_build_object(
      'old_status', v_old ->> 'status',
      'new_status', v_new ->> 'status',
      'old_priority', v_old ->> 'priority',
      'new_priority', v_new ->> 'priority',
      'old_verified', v_old ->> 'verified',
      'new_verified', v_new ->> 'verified',
      'old_assigned_to', v_old ->> 'assigned_to',
      'new_assigned_to', v_new ->> 'assigned_to'
    )
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS admin_audit_status_change ON public.mentors;
CREATE TRIGGER admin_audit_status_change
AFTER UPDATE OF status, verified ON public.mentors
FOR EACH ROW EXECUTE FUNCTION public.admin_audit_status_change();

DROP TRIGGER IF EXISTS admin_audit_status_change ON public.courses;
CREATE TRIGGER admin_audit_status_change
AFTER UPDATE OF status ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.admin_audit_status_change();

DROP TRIGGER IF EXISTS admin_audit_status_change ON public.flashcard_decks;
CREATE TRIGGER admin_audit_status_change
AFTER UPDATE OF status ON public.flashcard_decks
FOR EACH ROW EXECUTE FUNCTION public.admin_audit_status_change();

DROP TRIGGER IF EXISTS admin_audit_status_change ON public.community_events;
CREATE TRIGGER admin_audit_status_change
AFTER UPDATE OF status ON public.community_events
FOR EACH ROW EXECUTE FUNCTION public.admin_audit_status_change();

DROP TRIGGER IF EXISTS admin_audit_status_change ON public.support_tickets;
CREATE TRIGGER admin_audit_status_change
AFTER UPDATE OF status, priority, assigned_to ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.admin_audit_status_change();

DROP TRIGGER IF EXISTS admin_audit_status_change ON public.account_data_requests;
CREATE TRIGGER admin_audit_status_change
AFTER UPDATE OF status ON public.account_data_requests
FOR EACH ROW EXECUTE FUNCTION public.admin_audit_status_change();

REVOKE ALL PRIVILEGES ON FUNCTION public.admin_audit_status_change() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_moderate_study_group(
  p_group_id UUID,
  p_decision TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_old_status TEXT;
  v_new_status TEXT;
BEGIN
  IF v_actor IS NULL OR NOT public.is_smartnekam_moderator() THEN
    RAISE EXCEPTION 'Only an active SmartNekam moderator can manage study groups.';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('activate', 'archive', 'remove') THEN
    RAISE EXCEPTION 'Decision must be activate, archive, or remove.';
  END IF;
  IF p_reason IS NOT NULL AND length(p_reason) > 2000 THEN
    RAISE EXCEPTION 'Reason is too long.';
  END IF;

  v_new_status := CASE p_decision WHEN 'activate' THEN 'active' WHEN 'archive' THEN 'archived' ELSE 'removed' END;
  SELECT status INTO v_old_status FROM public.study_groups WHERE id = p_group_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Study group not found.'; END IF;

  UPDATE public.study_groups SET status = v_new_status, updated_at = pg_catalog.now() WHERE id = p_group_id;
  INSERT INTO public.admin_audit_log(actor_id, action_name, entity_type, entity_id, details)
  VALUES (v_actor, 'moderate_study_group', 'study_group', p_group_id,
    pg_catalog.jsonb_build_object('old_status', v_old_status, 'new_status', v_new_status, 'reason', p_reason));
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_moderate_question(
  p_question_id UUID,
  p_decision TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_old_status TEXT;
  v_new_status TEXT;
BEGIN
  IF v_actor IS NULL OR NOT public.is_smartnekam_moderator() THEN
    RAISE EXCEPTION 'Only an active SmartNekam moderator can manage Q&A.';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('reopen', 'resolve', 'close', 'remove') THEN
    RAISE EXCEPTION 'Decision must be reopen, resolve, close, or remove.';
  END IF;
  IF p_reason IS NOT NULL AND length(p_reason) > 2000 THEN
    RAISE EXCEPTION 'Reason is too long.';
  END IF;

  v_new_status := CASE p_decision WHEN 'reopen' THEN 'open' WHEN 'resolve' THEN 'resolved' WHEN 'close' THEN 'closed' ELSE 'removed' END;
  SELECT status INTO v_old_status FROM public.questions WHERE id = p_question_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Question not found.'; END IF;

  UPDATE public.questions SET status = v_new_status, updated_at = pg_catalog.now() WHERE id = p_question_id;
  INSERT INTO public.admin_audit_log(actor_id, action_name, entity_type, entity_id, details)
  VALUES (v_actor, 'moderate_question', 'question', p_question_id,
    pg_catalog.jsonb_build_object('old_status', v_old_status, 'new_status', v_new_status, 'reason', p_reason));
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_revoke_certificate(
  p_certificate_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_code TEXT;
BEGIN
  IF v_actor IS NULL OR NOT public.is_smartnekam_moderator() THEN
    RAISE EXCEPTION 'Only an active SmartNekam moderator can revoke certificates.';
  END IF;
  IF p_reason IS NULL OR length(pg_catalog.btrim(p_reason)) < 3 OR length(p_reason) > 2000 THEN
    RAISE EXCEPTION 'A revocation reason of 3 to 2000 characters is required.';
  END IF;

  UPDATE public.certificates
     SET status = 'revoked', revoked_at = pg_catalog.now(), revoked_by = v_actor, revoke_reason = pg_catalog.btrim(p_reason)
   WHERE id = p_certificate_id AND status = 'active'
   RETURNING certificate_code INTO v_code;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active certificate not found, or it is already revoked.'; END IF;

  INSERT INTO public.admin_audit_log(actor_id, action_name, entity_type, entity_id, details)
  VALUES (v_actor, 'revoke_certificate', 'certificate', p_certificate_id,
    pg_catalog.jsonb_build_object('certificate_code', v_code, 'reason', pg_catalog.btrim(p_reason)));
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_create_institution(
  p_kind TEXT,
  p_name TEXT,
  p_region TEXT DEFAULT NULL,
  p_country TEXT DEFAULT 'Tanzania',
  p_website TEXT DEFAULT NULL,
  p_district TEXT DEFAULT NULL,
  p_school_type TEXT DEFAULT NULL,
  p_admissions_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_actor IS NULL OR NOT public.is_smartnekam_moderator() OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = v_actor AND p.role = 'super_admin' AND p.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Only an active super admin can add institutions.';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('school', 'university') THEN RAISE EXCEPTION 'Institution type must be school or university.'; END IF;
  IF p_name IS NULL OR length(pg_catalog.btrim(p_name)) < 2 OR length(p_name) > 180 THEN RAISE EXCEPTION 'Institution name must contain 2 to 180 characters.'; END IF;
  IF p_country IS NULL OR length(pg_catalog.btrim(p_country)) < 2 OR length(p_country) > 80 THEN RAISE EXCEPTION 'Valid country is required.'; END IF;
  IF p_website IS NOT NULL AND p_website <> '' AND p_website !~* '^https?://' THEN RAISE EXCEPTION 'Website must start with http:// or https://.'; END IF;
  IF p_admissions_url IS NOT NULL AND p_admissions_url <> '' AND p_admissions_url !~* '^https?://' THEN RAISE EXCEPTION 'Admissions URL must start with http:// or https://.'; END IF;

  IF p_kind = 'school' AND EXISTS (
    SELECT 1 FROM public.schools s
    WHERE pg_catalog.lower(pg_catalog.btrim(s.name)) = pg_catalog.lower(pg_catalog.btrim(p_name))
      AND pg_catalog.lower(s.country) = pg_catalog.lower(pg_catalog.btrim(p_country))
  ) THEN
    RAISE EXCEPTION 'A school with that name and country already exists.';
  END IF;
  IF p_kind = 'university' AND EXISTS (
    SELECT 1 FROM public.universities u
    WHERE pg_catalog.lower(pg_catalog.btrim(u.name)) = pg_catalog.lower(pg_catalog.btrim(p_name))
      AND pg_catalog.lower(u.country) = pg_catalog.lower(pg_catalog.btrim(p_country))
  ) THEN
    RAISE EXCEPTION 'A university with that name and country already exists.';
  END IF;

  IF p_kind = 'school' THEN
    INSERT INTO public.schools(name, region, district, country, school_type, website)
    VALUES (pg_catalog.btrim(p_name), NULLIF(pg_catalog.btrim(COALESCE(p_region, '')), ''), NULLIF(pg_catalog.btrim(COALESCE(p_district, '')), ''), pg_catalog.btrim(p_country), NULLIF(pg_catalog.btrim(COALESCE(p_school_type, '')), ''), NULLIF(pg_catalog.btrim(COALESCE(p_website, '')), ''))
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.universities(name, region, country, website, admissions_url)
    VALUES (pg_catalog.btrim(p_name), NULLIF(pg_catalog.btrim(COALESCE(p_region, '')), ''), pg_catalog.btrim(p_country), NULLIF(pg_catalog.btrim(COALESCE(p_website, '')), ''), NULLIF(pg_catalog.btrim(COALESCE(p_admissions_url, '')), ''))
    RETURNING id INTO v_id;
  END IF;

  INSERT INTO public.admin_audit_log(actor_id, action_name, entity_type, entity_id, details)
  VALUES (v_actor, 'create_institution', p_kind, v_id, pg_catalog.jsonb_build_object('name', pg_catalog.btrim(p_name), 'country', pg_catalog.btrim(p_country)));
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_create_opportunity(
  p_title TEXT,
  p_type TEXT,
  p_sponsor TEXT DEFAULT NULL,
  p_country TEXT DEFAULT 'Tanzania',
  p_level TEXT DEFAULT 'ALL',
  p_deadline DATE DEFAULT NULL,
  p_eligibility TEXT DEFAULT NULL,
  p_source_url TEXT DEFAULT NULL,
  p_application_url TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_field TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_actor IS NULL OR NOT public.is_smartnekam_moderator() THEN
    RAISE EXCEPTION 'Only an active SmartNekam moderator can submit an opportunity for review.';
  END IF;
  IF p_title IS NULL OR length(pg_catalog.btrim(p_title)) < 3 OR length(p_title) > 200 THEN RAISE EXCEPTION 'Title must contain 3 to 200 characters.'; END IF;
  IF p_type IS NULL OR p_type NOT IN ('scholarship','competition','internship','job','graduate_programme','volunteering','loan','university') THEN RAISE EXCEPTION 'Unsupported opportunity type.'; END IF;
  IF COALESCE(pg_catalog.btrim(p_country), '') = '' OR length(p_country) > 100 THEN RAISE EXCEPTION 'Country is required.'; END IF;
  IF p_level IS NOT NULL AND p_level NOT IN ('O_LEVEL','A_LEVEL','UNIVERSITY','ALL') THEN RAISE EXCEPTION 'Unsupported level.'; END IF;
  IF p_source_url IS NULL OR p_source_url !~* '^https?://' THEN RAISE EXCEPTION 'A valid official source URL is required.'; END IF;
  IF p_application_url IS NOT NULL AND p_application_url <> '' AND p_application_url !~* '^https?://' THEN RAISE EXCEPTION 'Application URL must start with http:// or https://.'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.opportunities o
    WHERE pg_catalog.lower(pg_catalog.btrim(o.title)) = pg_catalog.lower(pg_catalog.btrim(p_title))
      AND o.source_url = p_source_url
      AND o.status NOT IN ('closed', 'rejected')
  ) THEN
    RAISE EXCEPTION 'An opportunity with this title and source URL already exists.';
  END IF;

  INSERT INTO public.opportunities(type, title, sponsor, description, level, field, country, deadline, eligibility, source_url, application_url, verified, status, created_by)
  VALUES (p_type, pg_catalog.btrim(p_title), NULLIF(pg_catalog.btrim(COALESCE(p_sponsor,'')),''), NULLIF(pg_catalog.btrim(COALESCE(p_description,'')),''), COALESCE(p_level,'ALL'), NULLIF(pg_catalog.btrim(COALESCE(p_field,'')),''), pg_catalog.btrim(p_country), p_deadline, NULLIF(pg_catalog.btrim(COALESCE(p_eligibility,'')),''), p_source_url, NULLIF(pg_catalog.btrim(COALESCE(p_application_url,'')),''), FALSE, 'pending_review', v_actor)
  RETURNING id INTO v_id;

  INSERT INTO public.admin_audit_log(actor_id, action_name, entity_type, entity_id, details)
  VALUES (v_actor, 'create_opportunity', 'opportunity', v_id, pg_catalog.jsonb_build_object('type', p_type, 'status', 'pending_review', 'source_url', p_source_url));
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_create_school_announcement(
  p_school_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_audience TEXT DEFAULT 'school',
  p_publish BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_actor IS NULL OR NOT public.is_smartnekam_moderator() OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = v_actor AND p.role = 'super_admin' AND p.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Only an active super admin can create school announcements from this panel.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.schools WHERE id = p_school_id) THEN RAISE EXCEPTION 'School not found.'; END IF;
  IF p_title IS NULL OR length(pg_catalog.btrim(p_title)) < 2 OR length(p_title) > 180 THEN RAISE EXCEPTION 'Title must contain 2 to 180 characters.'; END IF;
  IF p_body IS NULL OR length(pg_catalog.btrim(p_body)) < 2 THEN RAISE EXCEPTION 'Announcement body is required.'; END IF;
  IF p_audience NOT IN ('school','students','parents','teachers','all') THEN RAISE EXCEPTION 'Unsupported audience.'; END IF;

  INSERT INTO public.school_announcements(school_id, created_by, title, body, audience, status, publish_at)
  VALUES (p_school_id, v_actor, pg_catalog.btrim(p_title), pg_catalog.btrim(p_body), p_audience, CASE WHEN p_publish THEN 'published' ELSE 'draft' END, pg_catalog.now())
  RETURNING id INTO v_id;
  INSERT INTO public.admin_audit_log(actor_id, action_name, entity_type, entity_id, details)
  VALUES (v_actor, 'create_school_announcement', 'school_announcement', v_id, pg_catalog.jsonb_build_object('school_id', p_school_id, 'audience', p_audience, 'status', CASE WHEN p_publish THEN 'published' ELSE 'draft' END));
  RETURN v_id;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.admin_moderate_study_group(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON FUNCTION public.admin_moderate_question(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON FUNCTION public.admin_revoke_certificate(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON FUNCTION public.admin_create_institution(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON FUNCTION public.admin_create_opportunity(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON FUNCTION public.admin_create_school_announcement(UUID, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_moderate_study_group(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_moderate_question(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_certificate(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_institution(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_opportunity(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_school_announcement(UUID, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

COMMIT;

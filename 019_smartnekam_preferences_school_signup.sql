-- SmartNekam SQL 019
-- Fix profile preferences permissions and capture school/university at signup.
-- Prerequisites: SQL 001A/001B, SQL 013, SQL 017.
-- Safe to re-run. Does not remove user data.

BEGIN;

-- 1. Ensure these preferences tables exist even if SQL 013 was only partly applied.
CREATE TABLE IF NOT EXISTS public.user_app_preferences (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    language_code VARCHAR(5) NOT NULL DEFAULT 'sw',
    theme_mode VARCHAR(12) NOT NULL DEFAULT 'system',
    text_size VARCHAR(16) NOT NULL DEFAULT 'normal',
    reduced_motion BOOLEAN NOT NULL DEFAULT FALSE,
    low_data_mode BOOLEAN NOT NULL DEFAULT FALSE,
    auto_download_over_wifi BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_app_preferences_language_check CHECK (language_code IN ('sw', 'en')),
    CONSTRAINT user_app_preferences_theme_check CHECK (theme_mode IN ('system', 'light', 'dark')),
    CONSTRAINT user_app_preferences_text_size_check CHECK (text_size IN ('normal', 'large', 'extra_large'))
);

CREATE TABLE IF NOT EXISTS public.user_privacy_settings (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    profile_visibility VARCHAR(16) NOT NULL DEFAULT 'community',
    show_online_status BOOLEAN NOT NULL DEFAULT FALSE,
    allow_direct_messages VARCHAR(20) NOT NULL DEFAULT 'group_members',
    allow_group_invites BOOLEAN NOT NULL DEFAULT TRUE,
    show_in_leaderboards BOOLEAN NOT NULL DEFAULT TRUE,
    show_academic_details BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_privacy_settings_visibility_check CHECK (profile_visibility IN ('public', 'community', 'private')),
    CONSTRAINT user_privacy_settings_dm_check CHECK (allow_direct_messages IN ('everyone', 'group_members', 'no_one'))
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS institution_name VARCHAR(180);

ALTER TABLE public.user_app_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_privacy_settings ENABLE ROW LEVEL SECURITY;

-- 2. Rebuild own-row policies and provide the table privileges needed by Supabase upsert().
DROP POLICY IF EXISTS user_app_preferences_select_own ON public.user_app_preferences;
CREATE POLICY user_app_preferences_select_own ON public.user_app_preferences
    FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS user_app_preferences_insert_own ON public.user_app_preferences;
CREATE POLICY user_app_preferences_insert_own ON public.user_app_preferences
    FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS user_app_preferences_update_own ON public.user_app_preferences;
CREATE POLICY user_app_preferences_update_own ON public.user_app_preferences
    FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS user_privacy_settings_select_own ON public.user_privacy_settings;
CREATE POLICY user_privacy_settings_select_own ON public.user_privacy_settings
    FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS user_privacy_settings_insert_own ON public.user_privacy_settings;
CREATE POLICY user_privacy_settings_insert_own ON public.user_privacy_settings
    FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS user_privacy_settings_update_own ON public.user_privacy_settings;
CREATE POLICY user_privacy_settings_update_own ON public.user_privacy_settings
    FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

REVOKE ALL PRIVILEGES ON TABLE public.user_app_preferences FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.user_privacy_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_app_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_privacy_settings TO authenticated;

-- Let the pre-login registration page read public institution lists.
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS schools_public_read ON public.schools;
CREATE POLICY schools_public_read ON public.schools FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS universities_public_read ON public.universities;
CREATE POLICY universities_public_read ON public.universities FOR SELECT TO anon, authenticated USING (true);
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON TABLE public.schools, public.universities TO anon, authenticated;

-- 3. Keep institution IDs on the profile when a new person signs up.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_full_name TEXT;
    v_username TEXT;
    v_level TEXT;
    v_form_or_year TEXT;
    v_institution_name TEXT;
    v_school_text TEXT;
    v_university_text TEXT;
    v_school_id UUID;
    v_university_id UUID;
BEGIN
    v_full_name := COALESCE(
        NULLIF(btrim(NEW.raw_user_meta_data ->> 'full_name'), ''),
        NULLIF(btrim(NEW.raw_user_meta_data ->> 'name'), ''),
        NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
        CASE WHEN NEW.phone IS NOT NULL THEN 'Mwanafunzi ' || right(regexp_replace(NEW.phone, '\D', '', 'g'), 4) END,
        'Mwanafunzi ' || right(replace(NEW.id::text, '-', ''), 4)
    );
    v_username := lower(btrim(COALESCE(NEW.raw_user_meta_data ->> 'username', '')));
    IF v_username = '' THEN
        v_username := 'student_' || substr(replace(NEW.id::text, '-', ''), 1, 10);
    END IF;
    IF v_username !~ '^[a-z0-9_]{3,20}$' THEN
        RAISE EXCEPTION 'username_invalid';
    END IF;
    IF public.smartnekam_normalize_identity(v_username) = public.smartnekam_normalize_identity(v_full_name) THEN
        RAISE EXCEPTION 'username_must_be_different_from_display_name';
    END IF;

    v_level := upper(btrim(COALESCE(NEW.raw_user_meta_data ->> 'level', '')));
    IF v_level NOT IN ('O_LEVEL', 'A_LEVEL', 'UNIVERSITY') THEN
        v_level := NULL;
    END IF;
    v_form_or_year := NULLIF(btrim(NEW.raw_user_meta_data ->> 'form_or_year'), '');
    v_institution_name := NULLIF(left(btrim(COALESCE(NEW.raw_user_meta_data ->> 'institution_name', '')), 180), '');
    v_school_text := btrim(COALESCE(NEW.raw_user_meta_data ->> 'school_id', ''));
    v_university_text := btrim(COALESCE(NEW.raw_user_meta_data ->> 'university_id', ''));

    IF v_level = 'UNIVERSITY'
       AND v_university_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_university_id := v_university_text::uuid;
        IF NOT EXISTS (SELECT 1 FROM public.universities u WHERE u.id = v_university_id) THEN
            v_university_id := NULL;
        END IF;
    ELSIF v_level IN ('O_LEVEL', 'A_LEVEL')
       AND v_school_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_school_id := v_school_text::uuid;
        IF NOT EXISTS (SELECT 1 FROM public.schools s WHERE s.id = v_school_id) THEN
            v_school_id := NULL;
        END IF;
    END IF;

    IF v_school_id IS NOT NULL OR v_university_id IS NOT NULL THEN
        v_institution_name := NULL;
    END IF;

    INSERT INTO public.profiles (
        id, full_name, phone, email, username, level, form_or_year, school_id, university_id, institution_name
    ) VALUES (
        NEW.id, v_full_name, NEW.phone, NEW.email, v_username, v_level, v_form_or_year, v_school_id, v_university_id, v_institution_name
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$function$;
REVOKE ALL PRIVILEGES ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

COMMIT;

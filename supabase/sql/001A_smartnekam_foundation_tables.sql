-- SmartNekam | SQL 001A: Foundation tables only
-- Run this entire script in Supabase SQL Editor > New query.
-- This file intentionally has NO PL/pgSQL functions or RETURN statements.
-- It does not drop existing tables or data.

BEGIN;

CREATE TABLE IF NOT EXISTS public.schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(180) NOT NULL,
    region VARCHAR(80),
    district VARCHAR(100),
    country VARCHAR(80) NOT NULL DEFAULT 'Tanzania',
    school_type VARCHAR(40),
    website TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT schools_name_not_blank CHECK (length(btrim(name)) > 0)
);
CREATE INDEX IF NOT EXISTS schools_name_idx ON public.schools (lower(name));

CREATE TABLE IF NOT EXISTS public.universities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(180) NOT NULL,
    region VARCHAR(80),
    country VARCHAR(80) NOT NULL DEFAULT 'Tanzania',
    website TEXT,
    admissions_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT universities_name_not_blank CHECK (length(btrim(name)) > 0)
);
CREATE INDEX IF NOT EXISTS universities_name_idx ON public.universities (lower(name));

CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    level VARCHAR(30) NOT NULL,
    category VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT subjects_level_check CHECK (level IN ('O_LEVEL', 'A_LEVEL', 'UNIVERSITY')),
    CONSTRAINT subjects_name_not_blank CHECK (length(btrim(name)) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS subjects_name_level_unique_idx
    ON public.subjects (lower(name), level);

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(120) NOT NULL DEFAULT 'SmartNekam Student',
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(150),
    role VARCHAR(30) NOT NULL DEFAULT 'student',
    level VARCHAR(30),
    form_or_year VARCHAR(30),
    school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
    university_id UUID REFERENCES public.universities(id) ON DELETE SET NULL,
    combination VARCHAR(30),
    course VARCHAR(150),
    region VARCHAR(80),
    xp INTEGER NOT NULL DEFAULT 0,
    coins INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0,
    referral_code VARCHAR(20) UNIQUE,
    referred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT profiles_role_check CHECK (role IN ('student', 'mentor', 'teacher', 'school_admin', 'parent', 'moderator', 'super_admin')),
    CONSTRAINT profiles_level_check CHECK (level IS NULL OR level IN ('O_LEVEL', 'A_LEVEL', 'UNIVERSITY')),
    CONSTRAINT profiles_status_check CHECK (status IN ('active', 'suspended', 'banned')),
    CONSTRAINT profiles_xp_nonnegative CHECK (xp >= 0),
    CONSTRAINT profiles_coins_nonnegative CHECK (coins >= 0),
    CONSTRAINT profiles_streak_nonnegative CHECK (streak >= 0),
    CONSTRAINT profiles_full_name_not_blank CHECK (length(btrim(full_name)) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_unique_idx
    ON public.profiles (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_school_id_idx ON public.profiles (school_id);
CREATE INDEX IF NOT EXISTS profiles_university_id_idx ON public.profiles (university_id);
CREATE INDEX IF NOT EXISTS profiles_referred_by_idx ON public.profiles (referred_by);

CREATE TABLE IF NOT EXISTS public.profile_subjects (
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    selected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (profile_id, subject_id)
);
CREATE INDEX IF NOT EXISTS profile_subjects_subject_id_idx ON public.profile_subjects (subject_id);

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schools_public_read ON public.schools;
CREATE POLICY schools_public_read ON public.schools FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS universities_public_read ON public.universities;
CREATE POLICY universities_public_read ON public.universities FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS subjects_public_read ON public.subjects;
CREATE POLICY subjects_public_read ON public.subjects FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING (id = (SELECT auth.uid()));
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
    USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));
DROP POLICY IF EXISTS profile_subjects_select_own ON public.profile_subjects;
CREATE POLICY profile_subjects_select_own ON public.profile_subjects FOR SELECT TO authenticated
    USING (profile_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS profile_subjects_insert_own ON public.profile_subjects;
CREATE POLICY profile_subjects_insert_own ON public.profile_subjects FOR INSERT TO authenticated
    WITH CHECK (profile_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS profile_subjects_delete_own ON public.profile_subjects;
CREATE POLICY profile_subjects_delete_own ON public.profile_subjects FOR DELETE TO authenticated
    USING (profile_id = (SELECT auth.uid()));

REVOKE ALL PRIVILEGES ON TABLE public.schools FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.universities FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.subjects FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.profile_subjects FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON TABLE public.schools, public.universities, public.subjects TO anon, authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE (full_name, level, form_or_year, school_id, university_id, combination, course, region)
    ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.profile_subjects TO authenticated;

COMMIT;

-- Verify after successful execution with:
-- SELECT to_regclass('public.profiles'), to_regclass('public.subjects'),
--        to_regclass('public.schools'), to_regclass('public.universities'),
--        to_regclass('public.profile_subjects');

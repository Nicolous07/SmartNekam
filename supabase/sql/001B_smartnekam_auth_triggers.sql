-- SmartNekam | SQL 001B: Auth profile trigger + updated_at trigger
-- Prerequisite: SQL 001A_smartnekam_foundation_tables.sql ran successfully.
-- Run this whole script in Supabase Dashboard > SQL Editor > New query.
-- This script does not drop tables or delete data.

BEGIN;

-- Keep profiles.updated_at current whenever a profile row is updated.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
    NEW.updated_at := pg_catalog.now();
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Create a profile row whenever Supabase Auth creates a new user.
-- Supabase Auth remains responsible for passwords, OTP, and login identities.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    INSERT INTO public.profiles (id, full_name, phone, email)
    VALUES (
        NEW.id,
        COALESCE(
            NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
            NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
            'SmartNekam Student'
        ),
        NEW.phone,
        NEW.email
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created_smartnekam ON auth.users;
CREATE TRIGGER on_auth_user_created_smartnekam
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user();

-- Prevent clients from invoking this trigger-only function directly.
REVOKE ALL PRIVILEGES ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

COMMIT;

-- Expected result: Success. No rows returned.
-- Next: verify these triggers exist, then run SQL 002 Learning Library.

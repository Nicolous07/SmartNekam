-- SMARTNEKAM SQL-027: Give the designated account Super Admin access.
-- Run this manually in Supabase SQL Editor AFTER the account has been created
-- with email/password and a row exists in auth.users.
-- Does not contain or modify any password.

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id
    INTO v_user_id
    FROM auth.users
   WHERE lower(email) = lower('nicolousmunisi07@gmail.com')
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Akaunti ya admin haijapatikana. Kwanza sajili/unda akaunti hii kwenye Supabase Auth, kisha endesha SQL-027 tena.';
  END IF;

  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (v_user_id, 'SmartNekam Admin', 'nicolousmunisi07@gmail.com', 'super_admin')
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        role = 'super_admin',
        updated_at = now();
END $$;

-- Verify the resulting role.
SELECT u.email, p.role, p.status
FROM auth.users AS u
JOIN public.profiles AS p ON p.id = u.id
WHERE lower(u.email) = lower('nicolousmunisi07@gmail.com');

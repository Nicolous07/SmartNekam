-- SmartNekam SQL 053: allow authenticated users to SELECT posts via existing RLS.
-- The posts_select_published_or_owner policy remains the row-level gate:
-- published posts, the current user's own posts, and posts visible to moderators.
-- This fixes "permission denied for table posts" without exposing posts to anon.
GRANT SELECT ON TABLE public.posts TO authenticated;

DO $verify$
BEGIN
  IF NOT has_table_privilege('authenticated', 'public.posts', 'SELECT') THEN
    RAISE EXCEPTION 'SQL-053 verification failed: authenticated lacks SELECT on public.posts';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'posts'
      AND c.relrowsecurity = TRUE
  ) THEN
    RAISE EXCEPTION 'SQL-053 verification failed: RLS is not enabled on public.posts';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'posts'
      AND policyname = 'posts_select_published_or_owner'
  ) THEN
    RAISE EXCEPTION 'SQL-053 verification failed: the posts SELECT RLS policy is missing';
  END IF;
END;
$verify$;

-- SmartNekam SQL 054: allow learners to mark only their own notifications as read.
-- SELECT remains governed by notifications_select_own.
-- UPDATE is granted only on the two read-state columns, while the existing
-- notifications_update_read_state_own RLS policy restricts rows to auth.uid().
GRANT UPDATE (is_read, read_at) ON TABLE public.notifications TO authenticated;

DO $verify$
BEGIN
  IF NOT has_column_privilege('authenticated', 'public.notifications', 'is_read', 'UPDATE') THEN
    RAISE EXCEPTION 'SQL-054 verification failed: authenticated cannot update notifications.is_read';
  END IF;

  IF NOT has_column_privilege('authenticated', 'public.notifications', 'read_at', 'UPDATE') THEN
    RAISE EXCEPTION 'SQL-054 verification failed: authenticated cannot update notifications.read_at';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'notifications'
      AND c.relrowsecurity = TRUE
  ) THEN
    RAISE EXCEPTION 'SQL-054 verification failed: RLS is not enabled on public.notifications';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'notifications_update_read_state_own'
      AND cmd = 'UPDATE'
  ) THEN
    RAISE EXCEPTION 'SQL-054 verification failed: own-notification UPDATE policy is missing';
  END IF;
END;
$verify$;

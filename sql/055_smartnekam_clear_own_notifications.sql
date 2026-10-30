-- SmartNekam SQL 055: let each authenticated user clear only their own notifications.
-- The DELETE privilege is paired with row-level security so a user cannot
-- delete notifications belonging to another account.
GRANT DELETE ON TABLE public.notifications TO authenticated;

DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
CREATE POLICY notifications_delete_own
ON public.notifications
FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));

DO $verify$
BEGIN
  IF NOT has_table_privilege('authenticated', 'public.notifications', 'DELETE') THEN
    RAISE EXCEPTION 'SQL-055 verification failed: authenticated lacks DELETE on notifications';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'notifications'
      AND c.relrowsecurity = TRUE
  ) THEN
    RAISE EXCEPTION 'SQL-055 verification failed: RLS is not enabled on notifications';
  END IF;
END;
$verify$;

-- Keep the signed-in user's chat inbox synchronized when a new conversation is created.
-- The existing chat_participants SELECT policy limits visible events to conversations
-- the current user is allowed to see. The client additionally filters inserts by user_id.

BEGIN;

DO $publication$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
  END IF;
END;
$publication$;

NOTIFY pgrst, 'reload schema';

COMMIT;

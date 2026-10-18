-- SmartNekam SQL 036: Audio-call signaling through an app-owned table.
-- This replaces the failed SQL 035 approach. It does NOT alter realtime.messages.
-- Run in Supabase Dashboard > SQL Editor using an owner/admin database role.
-- Requires public.chat_participants(user_id, conversation_id, left_at).

BEGIN;

CREATE TABLE IF NOT EXISTS public.smartnekam_call_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id text NOT NULL,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT smartnekam_call_signals_not_self CHECK (sender_id <> recipient_id),
  CONSTRAINT smartnekam_call_signals_payload_object CHECK (jsonb_typeof(signal) = 'object')
);

CREATE INDEX IF NOT EXISTS smartnekam_call_signals_conversation_created_idx
  ON public.smartnekam_call_signals (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS smartnekam_call_signals_recipient_created_idx
  ON public.smartnekam_call_signals (recipient_id, created_at DESC);

ALTER TABLE public.smartnekam_call_signals ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON TABLE public.smartnekam_call_signals TO authenticated;

DROP POLICY IF EXISTS "SmartNekam call participants receive signals" ON public.smartnekam_call_signals;
CREATE POLICY "SmartNekam call participants receive signals"
ON public.smartnekam_call_signals
FOR SELECT
TO authenticated
USING (
  (sender_id = (SELECT auth.uid()) OR recipient_id = (SELECT auth.uid()))
  AND created_at > now() - interval '10 minutes'
  AND EXISTS (
    SELECT 1
    FROM public.chat_participants AS cp
    WHERE cp.user_id = (SELECT auth.uid())
      AND cp.conversation_id::text = smartnekam_call_signals.conversation_id
      AND cp.left_at IS NULL
  )
);

DROP POLICY IF EXISTS "SmartNekam active chat members send call signals" ON public.smartnekam_call_signals;
CREATE POLICY "SmartNekam active chat members send call signals"
ON public.smartnekam_call_signals
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = (SELECT auth.uid())
  AND recipient_id <> sender_id
  AND signal->>'from' = (SELECT auth.uid())::text
  AND signal->>'to' = recipient_id::text
  AND signal->>'conversationId' = conversation_id
  AND signal->>'type' IN ('offer', 'answer', 'ice-candidate', 'hangup', 'reject')
  AND EXISTS (
    SELECT 1
    FROM public.chat_participants AS sender_cp
    JOIN public.chat_participants AS recipient_cp
      ON recipient_cp.conversation_id = sender_cp.conversation_id
    WHERE sender_cp.user_id = (SELECT auth.uid())
      AND recipient_cp.user_id = smartnekam_call_signals.recipient_id
      AND sender_cp.conversation_id::text = smartnekam_call_signals.conversation_id
      AND sender_cp.left_at IS NULL
      AND recipient_cp.left_at IS NULL
  )
);

-- Add the app-owned table to Realtime so INSERT events can be delivered to the caller/callee.
-- If the connected SQL role cannot alter the publication, enable the table manually:
-- Supabase Dashboard > Database > Publications > supabase_realtime > select smartnekam_call_signals.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'smartnekam_call_signals'
     ) THEN
    BEGIN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.smartnekam_call_signals';
    EXCEPTION WHEN insufficient_privilege OR wrong_object_type THEN
      RAISE NOTICE 'Enable public.smartnekam_call_signals manually in Database > Publications > supabase_realtime.';
    END;
  END IF;
END $$;

COMMIT;

-- Verify the table and Realtime publication membership after running this migration.
SELECT
  to_regclass('public.smartnekam_call_signals') AS signaling_table,
  EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'smartnekam_call_signals'
  ) AS realtime_enabled;

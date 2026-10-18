-- SmartNekam SQL 037: incoming-call notifications (in-app + device push).
-- Requires SQL 033 (notifications/push pipeline) and SQL 036 (smartnekam_call_signals).
-- Does NOT alter Supabase-managed realtime.messages.
BEGIN;

-- Add the dedicated call type while preserving every existing accepted type.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (
    notification_type IN (
      'system', 'announcement', 'content_review', 'deadline', 'application',
      'chat', 'mentor', 'community', 'achievement', 'referral', 'security', 'call'
    )
  );

CREATE OR REPLACE FUNCTION public.smartnekam_notify_incoming_audio_call()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_caller_name text;
BEGIN
  -- Only the first WebRTC offer means a new incoming call. Answers, ICE,
  -- rejects and hangups must not create user-facing push notifications.
  IF COALESCE(NEW.signal->>'type', '') <> 'offer' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(pg_catalog.btrim(p.full_name), ''), 'Mtumiaji wa SmartNekam')
    INTO v_caller_name
  FROM public.profiles p
  WHERE p.id = NEW.sender_id;
  v_caller_name := COALESCE(v_caller_name, 'Mtumiaji wa SmartNekam');

  -- Active recipient only; the existing signaling RLS also validates that
  -- sender and recipient are active members of this same conversation.
  INSERT INTO public.notifications (user_id, title, body, notification_type, data)
  SELECT NEW.recipient_id,
         'Simu ya sauti inayoingia',
         v_caller_name || ' anakupigia simu ya sauti. Fungua SmartNekam ili kujibu.',
         'call',
         pg_catalog.jsonb_build_object(
           'href', '/communities?tab=chats&conversation=' || NEW.conversation_id,
           'source', 'incoming_call',
           'conversation_id', NEW.conversation_id,
           'caller_id', NEW.sender_id,
           'call_signal_id', NEW.id
         )
  FROM public.profiles recipient
  WHERE recipient.id = NEW.recipient_id
    AND recipient.status = 'active'
    AND recipient.id <> NEW.sender_id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS smartnekam_notify_incoming_audio_call_after_offer ON public.smartnekam_call_signals;
CREATE TRIGGER smartnekam_notify_incoming_audio_call_after_offer
AFTER INSERT ON public.smartnekam_call_signals
FOR EACH ROW
EXECUTE FUNCTION public.smartnekam_notify_incoming_audio_call();

-- Best effort: if notifications are not yet in the Realtime publication,
-- try to add the table; push delivery still uses the configured Database Webhook.
DO $publication$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
     ) THEN
    BEGIN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
    EXCEPTION WHEN insufficient_privilege OR wrong_object_type OR duplicate_object THEN
      RAISE NOTICE 'If in-app realtime toast does not appear, enable public.notifications in Database > Publications > supabase_realtime.';
    END;
  END IF;
END;
$publication$;

COMMIT;

SELECT
  to_regclass('public.smartnekam_call_signals') AS signaling_table,
  to_regclass('public.notifications') AS notification_table,
  EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) AS notifications_realtime_enabled;

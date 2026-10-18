-- SmartNekam SQL 033: notification automation, browser push subscriptions, and admin targeting.
-- Prerequisites: SQL 003, SQL 006, SQL 007, SQL 013, and SQL 016 must already be applied.
-- Safe to re-run: only replaces functions/triggers and adds one RPC.

BEGIN;

-- Add newly inserted notification rows to Supabase Realtime so an open app can show an in-app toast.
DO $publication$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
     ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$publication$;

-- 1) Direct messages, private group chats, and mentor chats.
CREATE OR REPLACE FUNCTION public.smartnekam_notify_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_sender_name TEXT;
  v_conversation_type TEXT;
  v_conversation_title TEXT;
  v_title TEXT;
  v_body TEXT;
  v_type TEXT;
BEGIN
  SELECT COALESCE(NULLIF(pg_catalog.btrim(p.full_name), ''), 'Mtumiaji wa SmartNekam'),
         c.conversation_type, c.title
    INTO v_sender_name, v_conversation_type, v_conversation_title
  FROM public.profiles p
  JOIN public.chat_conversations c ON c.id = NEW.conversation_id
  WHERE p.id = NEW.sender_id;

  v_sender_name := COALESCE(v_sender_name, 'Mtumiaji wa SmartNekam');
  v_body := CASE
    WHEN NULLIF(pg_catalog.btrim(COALESCE(NEW.body, '')), '') IS NOT NULL
      THEN pg_catalog.left(pg_catalog.regexp_replace(pg_catalog.btrim(NEW.body), '\s+', ' ', 'g'), 220)
    WHEN NEW.attachment_path IS NOT NULL THEN 'Amekutumia kiambatisho.'
    ELSE 'Ujumbe mpya umefika.'
  END;
  v_type := CASE
    WHEN v_conversation_type = 'mentor' THEN 'mentor'
    WHEN v_conversation_type = 'group' THEN 'community'
    ELSE 'chat'
  END;
  v_title := CASE
    WHEN v_conversation_type = 'group' THEN COALESCE(NULLIF(pg_catalog.btrim(v_conversation_title), ''), 'Group chat') || ': ujumbe mpya'
    ELSE 'Ujumbe mpya kutoka ' || v_sender_name
  END;

  INSERT INTO public.notifications (user_id, title, body, notification_type, data)
  SELECT cp.user_id, v_title,
         v_sender_name || ': ' || v_body,
         v_type,
         pg_catalog.jsonb_build_object(
           'href', '/communities?conversation=' || NEW.conversation_id::TEXT,
           'conversation_id', NEW.conversation_id,
           'message_id', NEW.id,
           'sender_id', NEW.sender_id,
           'source', 'chat_message'
         )
  FROM public.chat_participants cp
  JOIN public.profiles recipient ON recipient.id = cp.user_id AND recipient.status = 'active'
  WHERE cp.conversation_id = NEW.conversation_id
    AND cp.user_id <> NEW.sender_id
    AND cp.left_at IS NULL
    AND cp.is_muted = FALSE;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS smartnekam_notify_chat_message_after_insert ON public.chat_messages;
CREATE TRIGGER smartnekam_notify_chat_message_after_insert
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.smartnekam_notify_chat_message();

-- 2) Study-group messages notify every other active group member.
CREATE OR REPLACE FUNCTION public.smartnekam_notify_study_group_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_sender_name TEXT;
  v_group_name TEXT;
  v_body TEXT;
BEGIN
  SELECT COALESCE(NULLIF(pg_catalog.btrim(p.full_name), ''), 'Mtumiaji wa SmartNekam')
    INTO v_sender_name FROM public.profiles p WHERE p.id = NEW.sender_id;
  SELECT g.name INTO v_group_name FROM public.study_groups g WHERE g.id = NEW.group_id;

  v_sender_name := COALESCE(v_sender_name, 'Mtumiaji wa SmartNekam');
  v_group_name := COALESCE(v_group_name, 'kikundi cha masomo');
  v_body := CASE
    WHEN NULLIF(pg_catalog.btrim(COALESCE(NEW.body, '')), '') IS NOT NULL
      THEN pg_catalog.left(pg_catalog.regexp_replace(pg_catalog.btrim(NEW.body), '\s+', ' ', 'g'), 220)
    ELSE 'Amekutumia kiambatisho.'
  END;

  INSERT INTO public.notifications (user_id, title, body, notification_type, data)
  SELECT gm.user_id,
         'Ujumbe mpya: ' || v_group_name,
         v_sender_name || ': ' || v_body,
         'community',
         pg_catalog.jsonb_build_object(
           'href', '/communities', 'group_id', NEW.group_id,
           'message_id', NEW.id, 'sender_id', NEW.sender_id, 'source', 'study_group_message'
         )
  FROM public.group_members gm
  JOIN public.profiles recipient ON recipient.id = gm.user_id AND recipient.status = 'active'
  WHERE gm.group_id = NEW.group_id AND gm.user_id <> NEW.sender_id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS smartnekam_notify_study_group_message_after_insert ON public.study_group_messages;
CREATE TRIGGER smartnekam_notify_study_group_message_after_insert
AFTER INSERT ON public.study_group_messages
FOR EACH ROW EXECUTE FUNCTION public.smartnekam_notify_study_group_message();

-- 3) Comments on a group post notify the post author (except self-comments).
CREATE OR REPLACE FUNCTION public.smartnekam_notify_group_post_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_owner UUID;
  v_sender_name TEXT;
BEGIN
  SELECT gp.author_id INTO v_owner FROM public.group_posts gp WHERE gp.id = NEW.post_id;
  IF v_owner IS NULL OR v_owner = NEW.author_id THEN RETURN NEW; END IF;
  SELECT COALESCE(NULLIF(pg_catalog.btrim(p.full_name), ''), 'Mtumiaji wa SmartNekam')
    INTO v_sender_name FROM public.profiles p WHERE p.id = NEW.author_id;

  INSERT INTO public.notifications (user_id, title, body, notification_type, data)
  SELECT v_owner, 'Maoni mapya kwenye chapisho lako',
         COALESCE(v_sender_name, 'Mtu') || ': ' || pg_catalog.left(pg_catalog.regexp_replace(pg_catalog.btrim(NEW.body), '\s+', ' ', 'g'), 220),
         'community',
         pg_catalog.jsonb_build_object('href', '/communities', 'post_id', NEW.post_id, 'comment_id', NEW.id, 'source', 'group_post_comment')
  WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_owner AND p.status = 'active');
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS smartnekam_notify_group_post_comment_after_insert ON public.group_post_comments;
CREATE TRIGGER smartnekam_notify_group_post_comment_after_insert
AFTER INSERT ON public.group_post_comments
FOR EACH ROW EXECUTE FUNCTION public.smartnekam_notify_group_post_comment();

-- 4) Answers to a question notify its owner.
CREATE OR REPLACE FUNCTION public.smartnekam_notify_question_answer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_owner UUID;
  v_question_title TEXT;
  v_sender_name TEXT;
BEGIN
  SELECT q.user_id, COALESCE(NULLIF(pg_catalog.btrim(q.title), ''), 'Swali lako')
    INTO v_owner, v_question_title FROM public.questions q WHERE q.id = NEW.question_id;
  IF v_owner IS NULL OR v_owner = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(NULLIF(pg_catalog.btrim(p.full_name), ''), 'Mtumiaji wa SmartNekam')
    INTO v_sender_name FROM public.profiles p WHERE p.id = NEW.user_id;

  INSERT INTO public.notifications (user_id, title, body, notification_type, data)
  SELECT v_owner, 'Jibu jipya: ' || v_question_title,
         COALESCE(v_sender_name, 'Mtu') || ': ' || pg_catalog.left(pg_catalog.regexp_replace(pg_catalog.btrim(NEW.body), '\s+', ' ', 'g'), 220),
         'community',
         pg_catalog.jsonb_build_object('href', '/communities', 'question_id', NEW.question_id, 'answer_id', NEW.id, 'source', 'question_answer')
  WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_owner AND p.status = 'active');
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS smartnekam_notify_question_answer_after_insert ON public.answers;
CREATE TRIGGER smartnekam_notify_question_answer_after_insert
AFTER INSERT ON public.answers
FOR EACH ROW EXECUTE FUNCTION public.smartnekam_notify_question_answer();

-- 5) Comments on a question notify its owner.
CREATE OR REPLACE FUNCTION public.smartnekam_notify_question_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_owner UUID;
  v_question_title TEXT;
  v_sender_name TEXT;
BEGIN
  SELECT q.user_id, COALESCE(NULLIF(pg_catalog.btrim(q.title), ''), 'Swali lako')
    INTO v_owner, v_question_title FROM public.questions q WHERE q.id = NEW.question_id;
  IF v_owner IS NULL OR v_owner = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(NULLIF(pg_catalog.btrim(p.full_name), ''), 'Mtumiaji wa SmartNekam')
    INTO v_sender_name FROM public.profiles p WHERE p.id = NEW.user_id;

  INSERT INTO public.notifications (user_id, title, body, notification_type, data)
  SELECT v_owner, 'Maoni mapya: ' || v_question_title,
         COALESCE(v_sender_name, 'Mtu') || ': ' || pg_catalog.left(pg_catalog.regexp_replace(pg_catalog.btrim(NEW.body), '\s+', ' ', 'g'), 220),
         'community',
         pg_catalog.jsonb_build_object('href', '/communities', 'question_id', NEW.question_id, 'comment_id', NEW.id, 'source', 'question_comment')
  WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_owner AND p.status = 'active');
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS smartnekam_notify_question_comment_after_insert ON public.question_comments;
CREATE TRIGGER smartnekam_notify_question_comment_after_insert
AFTER INSERT ON public.question_comments
FOR EACH ROW EXECUTE FUNCTION public.smartnekam_notify_question_comment();

-- 6) Comments/replies on the main social feed notify post/comment owners.
CREATE OR REPLACE FUNCTION public.smartnekam_notify_post_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_sender_name TEXT;
  v_content TEXT;
BEGIN
  IF NEW.status <> 'published' THEN RETURN NEW; END IF;

  SELECT COALESCE(NULLIF(pg_catalog.btrim(p.full_name), ''), 'Mtumiaji wa SmartNekam')
    INTO v_sender_name FROM public.profiles p WHERE p.id = NEW.author_id;
  v_sender_name := COALESCE(v_sender_name, 'Mtumiaji wa SmartNekam');
  v_content := pg_catalog.left(pg_catalog.regexp_replace(pg_catalog.btrim(NEW.content), '[[:space:]]+', ' ', 'g'), 220);

  INSERT INTO public.notifications (user_id, title, body, notification_type, data)
  SELECT recipients.user_id,
         CASE WHEN EXISTS (
           SELECT 1 FROM public.posts p WHERE p.id = NEW.post_id AND p.author_id = recipients.user_id
         ) THEN 'Maoni mapya kwenye chapisho lako' ELSE 'Jibu jipya kwenye maoni yako' END,
         v_sender_name || ': ' || v_content,
         'community',
         pg_catalog.jsonb_build_object(
           'href', '/dashboard', 'post_id', NEW.post_id,
           'comment_id', NEW.id, 'parent_comment_id', NEW.parent_comment_id,
           'sender_id', NEW.author_id, 'source', 'post_comment'
         )
  FROM (
    SELECT p.author_id AS user_id
      FROM public.posts p
      WHERE p.id = NEW.post_id
    UNION
    SELECT parent.author_id AS user_id
      FROM public.post_comments parent
      WHERE parent.id = NEW.parent_comment_id AND parent.post_id = NEW.post_id
  ) recipients
  JOIN public.profiles recipient ON recipient.id = recipients.user_id AND recipient.status = 'active'
  WHERE recipients.user_id <> NEW.author_id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS smartnekam_notify_post_comment_after_insert ON public.post_comments;
CREATE TRIGGER smartnekam_notify_post_comment_after_insert
AFTER INSERT ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.smartnekam_notify_post_comment();

-- 7) Support-ticket messages notify the other side of a conversation.
-- Internal staff notes are intentionally excluded from notifications to the requester.
CREATE OR REPLACE FUNCTION public.smartnekam_notify_support_ticket_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_owner UUID;
  v_assigned_to UUID;
  v_subject TEXT;
  v_sender_name TEXT;
  v_message TEXT;
BEGIN
  IF NEW.is_internal THEN RETURN NEW; END IF;

  SELECT t.user_id, t.assigned_to, t.subject
    INTO v_owner, v_assigned_to, v_subject
    FROM public.support_tickets t
   WHERE t.id = NEW.ticket_id;
  IF v_owner IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(NULLIF(pg_catalog.btrim(p.full_name), ''), 'Mtumiaji wa SmartNekam')
    INTO v_sender_name FROM public.profiles p WHERE p.id = NEW.sender_id;
  v_sender_name := COALESCE(v_sender_name, 'Mtumiaji wa SmartNekam');
  v_message := pg_catalog.left(pg_catalog.regexp_replace(pg_catalog.btrim(NEW.message), '[[:space:]]+', ' ', 'g'), 220);

  INSERT INTO public.notifications (user_id, title, body, notification_type, data)
  SELECT target.user_id,
         'Ujumbe mpya wa msaada: ' || COALESCE(NULLIF(v_subject, ''), 'Support ticket'),
         v_sender_name || ': ' || v_message,
         'system',
         pg_catalog.jsonb_build_object(
           'href', '/notifications', 'ticket_id', NEW.ticket_id,
           'message_id', NEW.id, 'sender_id', NEW.sender_id, 'source', 'support_ticket_message'
         )
  FROM (
    SELECT v_owner AS user_id
    UNION
    SELECT v_assigned_to WHERE v_assigned_to IS NOT NULL
  ) target
  JOIN public.profiles recipient ON recipient.id = target.user_id AND recipient.status = 'active'
  WHERE target.user_id <> NEW.sender_id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS smartnekam_notify_support_ticket_message_after_insert ON public.support_ticket_messages;
CREATE TRIGGER smartnekam_notify_support_ticket_message_after_insert
AFTER INSERT ON public.support_ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.smartnekam_notify_support_ticket_message();

-- 6) Trusted bulk notification RPC: target one user, chosen users, or all active users.
CREATE OR REPLACE FUNCTION public.admin_create_notifications(
  p_target_mode TEXT,
  p_user_ids UUID[],
  p_title TEXT,
  p_body TEXT DEFAULT '',
  p_notification_type TEXT DEFAULT 'announcement',
  p_data JSONB DEFAULT '{}'::JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor UUID := (SELECT auth.uid());
  v_mode TEXT := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_target_mode, '')));
  v_ids UUID[] := COALESCE(p_user_ids, ARRAY[]::UUID[]);
  v_count INTEGER := 0;
BEGIN
  IF v_actor IS NULL OR NOT public.is_smartnekam_moderator() THEN
    RAISE EXCEPTION 'Only an active SmartNekam moderator can send administrative notifications.';
  END IF;
  IF v_mode NOT IN ('one', 'selected', 'all') THEN
    RAISE EXCEPTION 'Target mode must be one, selected, or all.';
  END IF;
  IF v_mode = 'one' AND pg_catalog.cardinality(v_ids) <> 1 THEN
    RAISE EXCEPTION 'Choose exactly one recipient.';
  END IF;
  IF v_mode = 'selected' AND pg_catalog.cardinality(v_ids) < 1 THEN
    RAISE EXCEPTION 'Choose at least one recipient.';
  END IF;
  IF p_title IS NULL OR pg_catalog.length(pg_catalog.btrim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Notification title is required.';
  END IF;
  IF pg_catalog.length(p_title) > 180 OR pg_catalog.length(COALESCE(p_body, '')) > 5000 THEN
    RAISE EXCEPTION 'Notification title/body is too long.';
  END IF;
  IF p_notification_type NOT IN (
    'system', 'announcement', 'content_review', 'deadline', 'application',
    'chat', 'mentor', 'community', 'achievement', 'referral', 'security'
  ) THEN
    RAISE EXCEPTION 'Unsupported notification type.';
  END IF;
  IF p_data IS NOT NULL AND pg_catalog.jsonb_typeof(p_data) <> 'object' THEN
    RAISE EXCEPTION 'Notification data must be a JSON object.';
  END IF;

  INSERT INTO public.notifications (user_id, title, body, notification_type, data)
  SELECT p.id,
         pg_catalog.btrim(p_title),
         COALESCE(p_body, ''),
         p_notification_type,
         COALESCE(p_data, '{}'::JSONB) || pg_catalog.jsonb_build_object('href', '/notifications', 'source', 'admin', 'target_mode', v_mode)
  FROM public.profiles p
  WHERE p.status = 'active'
    AND (
      v_mode = 'all'
      OR (v_mode = 'one' AND p.id = v_ids[1])
      OR (v_mode = 'selected' AND p.id = ANY(v_ids))
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN RAISE EXCEPTION 'No active recipient profiles were found.'; END IF;

  INSERT INTO public.admin_audit_log (actor_id, action_name, entity_type, entity_id, details)
  VALUES (
    v_actor, 'create_notifications', 'notification', NULL,
    pg_catalog.jsonb_build_object('target_mode', v_mode, 'recipient_count', v_count, 'notification_type', p_notification_type, 'title', pg_catalog.btrim(p_title))
  );

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_create_notifications(TEXT, UUID[], TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_notifications(TEXT, UUID[], TEXT, TEXT, TEXT, JSONB) TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';

-- SmartNekam SQL 034: focus user notifications, followed-post alerts, mentor requests, and chat media.
-- Prerequisites: existing SmartNekam migrations 003, 006, 007, 016, 017, 021, and 033.
-- Re-runnable. Existing notification data is retained.

BEGIN;

-- 1) Limit automatic notifications to the categories requested by the product:
-- followed users' new posts, incoming direct/mentor chat messages and requests,
-- admin-created notices (RPCs), and answers to the user's own Q&A question.
DROP TRIGGER IF EXISTS smartnekam_notify_study_group_message_after_insert ON public.study_group_messages;
DROP TRIGGER IF EXISTS smartnekam_notify_group_post_comment_after_insert ON public.group_post_comments;
DROP TRIGGER IF EXISTS smartnekam_notify_question_comment_after_insert ON public.question_comments;
DROP TRIGGER IF EXISTS smartnekam_notify_post_comment_after_insert ON public.post_comments;
DROP TRIGGER IF EXISTS smartnekam_notify_support_ticket_message_after_insert ON public.support_ticket_messages;

-- 2) Only direct and mentor chats create per-user message notifications; exclude group rooms.
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

  IF v_conversation_type NOT IN ('direct', 'mentor') THEN RETURN NEW; END IF;

  v_sender_name := COALESCE(v_sender_name, 'Mtumiaji wa SmartNekam');
  v_body := CASE
    WHEN NULLIF(pg_catalog.btrim(COALESCE(NEW.body, '')), '') IS NOT NULL
      THEN pg_catalog.left(pg_catalog.regexp_replace(pg_catalog.btrim(NEW.body), '[[:space:]]+', ' ', 'g'), 220)
    WHEN NEW.attachment_path IS NOT NULL THEN 'Amekutumia kiambatisho.'
    ELSE 'Ujumbe mpya umefika.'
  END;
  v_type := CASE WHEN v_conversation_type = 'mentor' THEN 'mentor' ELSE 'chat' END;
  v_title := CASE
    WHEN v_conversation_type = 'mentor' THEN 'Ujumbe mpya kutoka mentor: ' || v_sender_name
    ELSE 'Ujumbe mpya kutoka ' || v_sender_name
  END;

  INSERT INTO public.notifications (user_id, title, body, notification_type, data)
  SELECT cp.user_id, v_title, v_sender_name || ': ' || v_body, v_type,
         pg_catalog.jsonb_build_object(
           'href', '/communities?tab=chats&conversation=' || NEW.conversation_id::TEXT,
           'conversation_id', NEW.conversation_id, 'message_id', NEW.id,
           'sender_id', NEW.sender_id, 'source', 'chat_message'
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

-- 3) Notify the mentor when a student submits a mentorship request, and notify
-- the student when the mentor accepts or declines it.
CREATE OR REPLACE FUNCTION public.smartnekam_notify_mentor_request_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_mentor_user_id UUID;
  v_mentor_name TEXT;
  v_student_name TEXT;
BEGIN
  IF NEW.status <> 'requested' THEN RETURN NEW; END IF;
  SELECT m.user_id, COALESCE(NULLIF(pg_catalog.btrim(m.display_name), ''), NULLIF(pg_catalog.btrim(mp.full_name), ''), 'Mentor')
    INTO v_mentor_user_id, v_mentor_name
  FROM public.mentors m
  JOIN public.profiles mp ON mp.id = m.user_id
  WHERE m.id = NEW.mentor_id;
  SELECT COALESCE(NULLIF(pg_catalog.btrim(full_name), ''), 'Mwanafunzi')
    INTO v_student_name FROM public.profiles WHERE id = NEW.student_id;

  IF v_mentor_user_id IS NOT NULL AND v_mentor_user_id <> NEW.student_id THEN
    INSERT INTO public.notifications (user_id, title, body, notification_type, data)
    SELECT v_mentor_user_id,
           'Ombi jipya la mentorship',
           COALESCE(v_student_name, 'Mwanafunzi') || ' ameomba ushauri kuhusu: ' || NEW.topic,
           'mentor',
           pg_catalog.jsonb_build_object('href', '/communities?tab=mentors', 'session_id', NEW.id, 'source', 'mentor_request')
    WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_mentor_user_id AND p.status = 'active');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS smartnekam_notify_mentor_request_after_insert ON public.mentor_sessions;
CREATE TRIGGER smartnekam_notify_mentor_request_after_insert
AFTER INSERT ON public.mentor_sessions
FOR EACH ROW EXECUTE FUNCTION public.smartnekam_notify_mentor_request_insert();

CREATE OR REPLACE FUNCTION public.smartnekam_notify_mentor_request_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_mentor_name TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  IF NEW.status NOT IN ('accepted', 'declined') OR OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  SELECT COALESCE(NULLIF(pg_catalog.btrim(m.display_name), ''), NULLIF(pg_catalog.btrim(p.full_name), ''), 'Mentor')
    INTO v_mentor_name
  FROM public.mentors m JOIN public.profiles p ON p.id = m.user_id
  WHERE m.id = NEW.mentor_id;
  v_title := CASE WHEN NEW.status = 'accepted' THEN 'Ombi lako la mentorship limekubaliwa' ELSE 'Jibu la ombi la mentorship' END;
  v_body := CASE WHEN NEW.status = 'accepted'
    THEN COALESCE(v_mentor_name, 'Mentor') || ' amekubali ombi lako: ' || NEW.topic
    ELSE COALESCE(v_mentor_name, 'Mentor') || ' hawezi kukubali ombi hili kwa sasa: ' || NEW.topic
  END;

  INSERT INTO public.notifications (user_id, title, body, notification_type, data)
  SELECT NEW.student_id, v_title, v_body, 'mentor',
         pg_catalog.jsonb_build_object(
           'href', CASE WHEN NEW.status = 'accepted'
             THEN '/communities?tab=chats'
             ELSE '/communities?tab=mentors' END,
           'session_id', NEW.id, 'conversation_id', NEW.chat_conversation_id,
           'source', 'mentor_request_response', 'status', NEW.status
         )
  WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = NEW.student_id AND p.status = 'active');
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS smartnekam_notify_mentor_request_status_after_update ON public.mentor_sessions;
CREATE TRIGGER smartnekam_notify_mentor_request_status_after_update
AFTER UPDATE OF status ON public.mentor_sessions
FOR EACH ROW EXECUTE FUNCTION public.smartnekam_notify_mentor_request_status();

-- 4) Q&A answers should notify the author and link directly to their question.
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
  SELECT COALESCE(NULLIF(pg_catalog.btrim(p.full_name), ''), 'Mwanafunzi')
    INTO v_sender_name FROM public.profiles p WHERE p.id = NEW.user_id;

  INSERT INTO public.notifications (user_id, title, body, notification_type, data)
  SELECT v_owner, 'Jibu jipya: ' || v_question_title,
         COALESCE(v_sender_name, 'Mwanafunzi') || ': ' || pg_catalog.left(pg_catalog.regexp_replace(pg_catalog.btrim(NEW.body), '[[:space:]]+', ' ', 'g'), 220),
         'community',
         pg_catalog.jsonb_build_object('href', '/communities/questions/' || NEW.question_id::TEXT, 'question_id', NEW.question_id, 'answer_id', NEW.id, 'source', 'question_answer')
  WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_owner AND p.status = 'active');
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS smartnekam_notify_question_answer_after_insert ON public.answers;
CREATE TRIGGER smartnekam_notify_question_answer_after_insert
AFTER INSERT ON public.answers
FOR EACH ROW EXECUTE FUNCTION public.smartnekam_notify_question_answer();

-- 5) New posts from accounts a learner follows create a notification for that follower.
CREATE OR REPLACE FUNCTION public.smartnekam_notify_followed_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_author_name TEXT;
  v_content TEXT;
BEGIN
  IF NEW.status <> 'published' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'published' THEN RETURN NEW; END IF;

  SELECT COALESCE(NULLIF(pg_catalog.btrim(p.full_name), ''), 'Mwanafunzi')
    INTO v_author_name FROM public.profiles p WHERE p.id = NEW.author_id;
  v_content := pg_catalog.left(pg_catalog.regexp_replace(pg_catalog.btrim(COALESCE(NEW.content, '')), '[[:space:]]+', ' ', 'g'), 220);

  INSERT INTO public.notifications (user_id, title, body, notification_type, data)
  SELECT uf.follower_id,
         CASE WHEN NEW.is_anonymous THEN 'Post mpya kutoka kwa unayemfuata' ELSE 'Post mpya kutoka ' || COALESCE(v_author_name, 'unayemfuata') END,
         CASE WHEN NEW.is_anonymous THEN v_content ELSE v_content END,
         'community',
         pg_catalog.jsonb_build_object('href', '/posts/' || NEW.id::TEXT, 'post_id', NEW.id, 'author_id', NEW.author_id, 'source', 'followed_post')
  FROM public.user_follows uf
  JOIN public.profiles recipient ON recipient.id = uf.follower_id AND recipient.status = 'active'
  WHERE uf.following_id = NEW.author_id
    AND uf.follower_id <> NEW.author_id
    AND NOT NEW.is_anonymous; -- do not reveal anonymous posts through follow notifications.

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS smartnekam_notify_followed_post_after_publish ON public.posts;
CREATE TRIGGER smartnekam_notify_followed_post_after_publish
AFTER INSERT OR UPDATE OF status ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.smartnekam_notify_followed_post();

-- 6) Allow rich chat attachments (image/audio/video/common documents), retaining private member-only storage.
ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_type_check;
ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_type_check CHECK (message_type IN ('text', 'image', 'audio', 'video', 'file'));

UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
      'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif',
      'audio/mpeg','audio/mp4','audio/wav','audio/x-wav','audio/ogg','audio/webm','audio/aac','audio/3gpp',
      'video/mp4','video/webm','video/quicktime',
      'application/pdf','application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain','text/csv'
    ]::TEXT[]
WHERE id = 'smartnekam-chat-attachments';

-- Camera uploads to the existing Q&A bucket include common mobile photo formats.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['application/pdf','image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']::TEXT[]
WHERE id = 'community-attachments';

-- Ensure browser push trigger support stays enabled for all newly inserted notification rows.
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

COMMIT;
NOTIFY pgrst, 'reload schema';

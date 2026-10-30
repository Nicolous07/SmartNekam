BEGIN;

-- Aggregated admin analytics only. No message bodies or learner identifiers are returned.
-- SECURITY INVOKER keeps the existing table RLS policies in force.
CREATE OR REPLACE FUNCTION public.admin_smartnekam_daily_analytics(p_days INTEGER DEFAULT 14)
RETURNS TABLE (
  day_date DATE,
  new_users BIGINT,
  new_study_groups BIGINT,
  new_chat_groups BIGINT,
  new_questions BIGINT,
  group_messages BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_days INTEGER := LEAST(GREATEST(COALESCE(p_days, 14), 1), 90);
  v_start TIMESTAMPTZ;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.is_smartnekam_moderator() THEN
    RAISE EXCEPTION 'admin_access_required';
  END IF;

  v_start := (
    ((pg_catalog.now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date - (v_days - 1))::timestamp
    AT TIME ZONE 'Africa/Dar_es_Salaam'
  );

  RETURN QUERY
  WITH calendar AS (
    SELECT
      ((pg_catalog.now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date - d.day_offset)::date AS day_date
    FROM pg_catalog.generate_series(v_days - 1, 0, -1) AS d(day_offset)
  ),
  user_counts AS (
    SELECT
      (p.created_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date AS day_date,
      pg_catalog.count(*)::bigint AS total
    FROM public.profiles AS p
    WHERE p.created_at >= v_start
    GROUP BY 1
  ),
  study_group_counts AS (
    SELECT
      (g.created_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date AS day_date,
      pg_catalog.count(*)::bigint AS total
    FROM public.study_groups AS g
    WHERE g.created_at >= v_start
      AND g.status = 'active'
    GROUP BY 1
  ),
  chat_group_counts AS (
    SELECT
      (c.created_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date AS day_date,
      pg_catalog.count(*)::bigint AS total
    FROM public.chat_conversations AS c
    WHERE c.created_at >= v_start
      AND c.conversation_type = 'group'
      AND c.status = 'active'
    GROUP BY 1
  ),
  question_counts AS (
    SELECT
      (q.created_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date AS day_date,
      pg_catalog.count(*)::bigint AS total
    FROM public.questions AS q
    WHERE q.created_at >= v_start
      AND q.status IN ('open', 'resolved')
    GROUP BY 1
  ),
  group_message_counts AS (
    SELECT
      (m.created_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date AS day_date,
      pg_catalog.count(*)::bigint AS total
    FROM public.chat_messages AS m
    JOIN public.chat_conversations AS c ON c.id = m.conversation_id
    WHERE m.created_at >= v_start
      AND m.deleted_at IS NULL
      AND c.conversation_type = 'group'
      AND c.status = 'active'
    GROUP BY 1
  )
  SELECT
    calendar.day_date,
    COALESCE(user_counts.total, 0)::bigint,
    COALESCE(study_group_counts.total, 0)::bigint,
    COALESCE(chat_group_counts.total, 0)::bigint,
    COALESCE(question_counts.total, 0)::bigint,
    COALESCE(group_message_counts.total, 0)::bigint
  FROM calendar
  LEFT JOIN user_counts ON user_counts.day_date = calendar.day_date
  LEFT JOIN study_group_counts ON study_group_counts.day_date = calendar.day_date
  LEFT JOIN chat_group_counts ON chat_group_counts.day_date = calendar.day_date
  LEFT JOIN question_counts ON question_counts.day_date = calendar.day_date
  LEFT JOIN group_message_counts ON group_message_counts.day_date = calendar.day_date
  ORDER BY calendar.day_date;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_smartnekam_daily_analytics(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_smartnekam_daily_analytics(INTEGER) TO authenticated;

COMMIT;

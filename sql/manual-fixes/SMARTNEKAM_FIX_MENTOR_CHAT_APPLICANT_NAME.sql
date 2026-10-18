-- SmartNekam: ensure accepted mentorship chats appear in the inbox under the applicant's name.
-- Run in Supabase Dashboard > SQL Editor after SQL 006 (mentorship) and SQL 016/017.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_my_chat_inbox()
RETURNS TABLE (
    conversation_id UUID,
    conversation_type TEXT,
    other_user_id UUID,
    other_full_name TEXT,
    other_username TEXT,
    other_avatar_url TEXT,
    last_message TEXT,
    last_message_at TIMESTAMPTZ,
    unread_count BIGINT,
    can_message BOOLEAN,
    group_visibility TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT * FROM (
        -- Direct chats and private mentor/student chats. For a mentorship conversation,
        -- the other participant is the applicant when the current user is the mentor.
        SELECT
            c.id AS conversation_id,
            c.conversation_type::TEXT AS conversation_type,
            other_p.id AS other_user_id,
            COALESCE(NULLIF(pg_catalog.btrim(other_p.full_name), ''), NULLIF(other_p.username, ''), 'Mwanafunzi')::TEXT AS other_full_name,
            COALESCE(other_p.username, '')::TEXT AS other_username,
            other_p.avatar_url::TEXT AS other_avatar_url,
            last_msg.body::TEXT AS last_message,
            COALESCE(last_msg.created_at, c.updated_at) AS last_message_at,
            COALESCE(unread.amount, 0)::BIGINT AS unread_count,
            CASE
                WHEN c.conversation_type = 'mentor' THEN TRUE
                ELSE public.can_start_smartnekam_direct_message(other_p.id)
            END AS can_message,
            NULL::TEXT AS group_visibility
        FROM public.chat_participants AS mine
        JOIN public.chat_conversations AS c
          ON c.id = mine.conversation_id
        JOIN public.chat_participants AS theirs
          ON theirs.conversation_id = c.id
         AND theirs.user_id <> mine.user_id
         AND theirs.left_at IS NULL
        JOIN public.profiles AS other_p
          ON other_p.id = theirs.user_id
         AND other_p.status = 'active'
        LEFT JOIN LATERAL (
            SELECT m.body, m.created_at
            FROM public.chat_messages AS m
            WHERE m.conversation_id = c.id
            ORDER BY m.created_at DESC
            LIMIT 1
        ) AS last_msg ON TRUE
        LEFT JOIN LATERAL (
            SELECT count(*) AS amount
            FROM public.chat_messages AS m
            WHERE m.conversation_id = c.id
              AND m.sender_id <> mine.user_id
              AND m.created_at > COALESCE(mine.last_read_at, 'epoch'::TIMESTAMPTZ)
        ) AS unread ON TRUE
        WHERE mine.user_id = (SELECT auth.uid())
          AND mine.left_at IS NULL
          AND c.conversation_type IN ('direct', 'mentor')
          AND c.status = 'active'

        UNION ALL

        -- Group chats keep their group title rather than a participant's name.
        SELECT
            c.id AS conversation_id,
            c.conversation_type::TEXT AS conversation_type,
            NULL::UUID AS other_user_id,
            COALESCE(NULLIF(pg_catalog.btrim(c.title), ''), 'Chat group')::TEXT AS other_full_name,
            NULL::TEXT AS other_username,
            NULL::TEXT AS other_avatar_url,
            last_msg.body::TEXT AS last_message,
            COALESCE(last_msg.created_at, c.updated_at) AS last_message_at,
            COALESCE(unread.amount, 0)::BIGINT AS unread_count,
            TRUE AS can_message,
            s.visibility::TEXT AS group_visibility
        FROM public.chat_participants AS mine
        JOIN public.chat_conversations AS c
          ON c.id = mine.conversation_id
         AND c.conversation_type = 'group'
         AND c.status = 'active'
        JOIN public.chat_group_settings AS s
          ON s.conversation_id = c.id
        LEFT JOIN LATERAL (
            SELECT m.body, m.created_at
            FROM public.chat_messages AS m
            WHERE m.conversation_id = c.id
            ORDER BY m.created_at DESC
            LIMIT 1
        ) AS last_msg ON TRUE
        LEFT JOIN LATERAL (
            SELECT count(*) AS amount
            FROM public.chat_messages AS m
            WHERE m.conversation_id = c.id
              AND m.sender_id <> mine.user_id
              AND m.created_at > COALESCE(mine.last_read_at, 'epoch'::TIMESTAMPTZ)
        ) AS unread ON TRUE
        WHERE mine.user_id = (SELECT auth.uid())
          AND mine.left_at IS NULL
    ) AS chats
    ORDER BY chats.last_message_at DESC NULLS LAST;
$function$;

REVOKE ALL ON FUNCTION public.get_my_chat_inbox() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_chat_inbox() TO authenticated;

COMMIT;

-- After running this SQL, accept a new mentorship request to test the full flow.
-- Existing accepted sessions that already have chat_conversation_id should appear in Chats too.

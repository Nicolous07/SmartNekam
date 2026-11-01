-- SmartNekam SQL 056: include every active member who opts into the leaderboard.
-- The public ranking only returns the fields needed for ranking; no private contact data.

CREATE OR REPLACE FUNCTION public.get_smartnekam_leaderboard(
    p_period TEXT DEFAULT 'all_time',
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    rank_position BIGINT,
    user_id UUID,
    display_name TEXT,
    level TEXT,
    total_xp BIGINT,
    current_streak INTEGER,
    longest_streak INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_uid UUID := auth.uid();
    v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;
    IF p_period IS NULL OR p_period NOT IN ('all_time', 'week', 'month') THEN
        RAISE EXCEPTION 'Period must be all_time, week, or month.';
    END IF;

    RETURN QUERY
    WITH leaderboard_points AS (
        SELECT
            p.id AS uid,
            p.full_name::TEXT AS uname,
            COALESCE(p.level, '')::TEXT AS academic_level,
            p.streak AS active_streak,
            p.longest_streak AS best_streak,
            CASE
                WHEN p_period = 'all_time' THEN p.xp::BIGINT
                ELSE COALESCE(SUM(x.amount), 0)::BIGINT
            END AS points
        FROM public.profiles AS p
        LEFT JOIN public.xp_ledger AS x
          ON x.user_id = p.id
         AND (
             (p_period = 'week' AND x.created_at >= (
                 pg_catalog.date_trunc('week', pg_catalog.now() AT TIME ZONE 'Africa/Dar_es_Salaam')
                 AT TIME ZONE 'Africa/Dar_es_Salaam'
             ))
             OR
             (p_period = 'month' AND x.created_at >= (
                 pg_catalog.date_trunc('month', pg_catalog.now() AT TIME ZONE 'Africa/Dar_es_Salaam')
                 AT TIME ZONE 'Africa/Dar_es_Salaam'
             ))
             OR p_period = 'all_time'
         )
        WHERE p.status = 'active'
          AND p.show_on_leaderboard IS TRUE
        GROUP BY p.id, p.full_name, p.level, p.streak, p.longest_streak, p.xp
    ), ranked AS (
        SELECT
            pg_catalog.row_number() OVER (
                ORDER BY lp.points DESC, lp.active_streak DESC, lp.uname ASC
            ) AS pos,
            lp.*
        FROM leaderboard_points AS lp
    )
    SELECT
        r.pos::BIGINT,
        r.uid,
        r.uname,
        r.academic_level,
        r.points,
        r.active_streak,
        r.best_streak
    FROM ranked AS r
    ORDER BY r.pos
    LIMIT v_limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_smartnekam_leaderboard(TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_smartnekam_leaderboard(TEXT, INTEGER) TO authenticated;

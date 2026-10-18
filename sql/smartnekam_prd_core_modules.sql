-- SmartNekam PRD core modules: Daily Challenge, Study Planner, Flashcards, In-app Notifications
-- Run in Supabase SQL Editor after the existing SmartNekam schema.

CREATE TABLE IF NOT EXISTS public.daily_challenge_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_date date NOT NULL DEFAULT CURRENT_DATE,
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0),
  total_questions integer NOT NULL DEFAULT 5 CHECK (total_questions > 0),
  points_awarded integer NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, challenge_date)
);

CREATE TABLE IF NOT EXISTS public.study_planner_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title varchar(180) NOT NULL,
  subject varchar(100),
  task_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS study_planner_tasks_user_date_idx
  ON public.study_planner_tasks(user_id, task_date, completed_at);

CREATE TABLE IF NOT EXISTS public.student_flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deck_title varchar(120) NOT NULL DEFAULT 'Kadi zangu',
  front text NOT NULL,
  back text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS student_flashcards_user_deck_idx
  ON public.student_flashcards(user_id, deck_title, created_at DESC);

CREATE TABLE IF NOT EXISTS public.student_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title varchar(160) NOT NULL,
  body text NOT NULL,
  kind varchar(40) NOT NULL DEFAULT 'info',
  href text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS student_notifications_user_created_idx
  ON public.student_notifications(user_id, created_at DESC);

ALTER TABLE public.daily_challenge_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_planner_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_challenge_attempts' AND policyname='Users read own challenge attempts') THEN
    CREATE POLICY "Users read own challenge attempts" ON public.daily_challenge_attempts FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='study_planner_tasks' AND policyname='Users manage own study tasks') THEN
    CREATE POLICY "Users manage own study tasks" ON public.study_planner_tasks FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='student_flashcards' AND policyname='Users manage own flashcards') THEN
    CREATE POLICY "Users manage own flashcards" ON public.student_flashcards FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='student_notifications' AND policyname='Users read own notifications') THEN
    CREATE POLICY "Users read own notifications" ON public.student_notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='student_notifications' AND policyname='Users update own notifications') THEN
    CREATE POLICY "Users update own notifications" ON public.student_notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Awarding challenge points happens in a trusted database function, not in the browser.
CREATE OR REPLACE FUNCTION public.complete_daily_challenge(
  p_score integer,
  p_total integer DEFAULT 5,
  p_challenge_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_points integer;
  v_attempt_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Ingia ili kuhifadhi matokeo.' USING ERRCODE = '28000';
  END IF;
  IF p_total < 1 OR p_total > 20 OR p_score < 0 OR p_score > p_total THEN
    RAISE EXCEPTION 'Matokeo si sahihi.' USING ERRCODE = '22023';
  END IF;

  v_points := 5 + (p_score * 2);
  INSERT INTO public.daily_challenge_attempts(user_id, challenge_date, score, total_questions, points_awarded)
  VALUES (v_user, COALESCE(p_challenge_date, CURRENT_DATE), p_score, p_total, v_points)
  ON CONFLICT (user_id, challenge_date) DO NOTHING
  RETURNING id INTO v_attempt_id;

  IF v_attempt_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'already_completed', true, 'points_awarded', 0);
  END IF;

  UPDATE public.profiles
  SET edupoints_balance = COALESCE(edupoints_balance, 0) + v_points
  WHERE id = v_user;

  INSERT INTO public.student_notifications(user_id, title, body, kind, href)
  VALUES (v_user, 'Daily Challenge imekamilika',
    format('Umepata alama %s/%s na %s EduPoints.', p_score, p_total, v_points),
    'success', '/learn/daily-challenge');

  RETURN jsonb_build_object('success', true, 'already_completed', false, 'points_awarded', v_points, 'attempt_id', v_attempt_id);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_daily_challenge(integer, integer, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_daily_challenge(integer, integer, date) TO authenticated;
GRANT SELECT ON public.daily_challenge_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_planner_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_flashcards TO authenticated;
GRANT SELECT, UPDATE ON public.student_notifications TO authenticated;

-- SmartNekam SQL 047: learner-created teaching channels with inline YouTube playback.
-- Run after the existing SmartNekam migrations in Supabase SQL Editor.
BEGIN;

CREATE TABLE IF NOT EXISTS public.learning_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  slug varchar(130) NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  category varchar(24) NOT NULL DEFAULT 'other',
  language varchar(2) NOT NULL DEFAULT 'sw',
  status varchar(16) NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learning_channels_name_not_blank CHECK (length(btrim(name)) BETWEEN 2 AND 100),
  CONSTRAINT learning_channels_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT learning_channels_category_check CHECK (category IN ('life','academics','technology','career','business','health','other')),
  CONSTRAINT learning_channels_language_check CHECK (language IN ('sw','en')),
  CONSTRAINT learning_channels_status_check CHECK (status IN ('published','hidden'))
);
CREATE INDEX IF NOT EXISTS learning_channels_discovery_idx ON public.learning_channels(status, category, created_at DESC);
CREATE INDEX IF NOT EXISTS learning_channels_owner_idx ON public.learning_channels(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.learning_channel_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.learning_channels(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title varchar(180) NOT NULL,
  description text NOT NULL DEFAULT '',
  youtube_url text NOT NULL,
  position integer NOT NULL DEFAULT 1,
  status varchar(16) NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learning_channel_videos_title_not_blank CHECK (length(btrim(title)) BETWEEN 2 AND 180),
  CONSTRAINT learning_channel_videos_youtube_url_check CHECK (youtube_url ~* '^https?://(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)/'),
  CONSTRAINT learning_channel_videos_position_check CHECK (position > 0),
  CONSTRAINT learning_channel_videos_status_check CHECK (status IN ('published','hidden'))
);
CREATE INDEX IF NOT EXISTS learning_channel_videos_channel_idx ON public.learning_channel_videos(channel_id, status, position, created_at);

ALTER TABLE public.learning_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_channel_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS learning_channels_read_published_or_owner ON public.learning_channels;
CREATE POLICY learning_channels_read_published_or_owner ON public.learning_channels
FOR SELECT TO authenticated
USING (status = 'published' OR owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS learning_channels_create_own ON public.learning_channels;
CREATE POLICY learning_channels_create_own ON public.learning_channels
FOR INSERT TO authenticated
WITH CHECK (owner_id = (SELECT auth.uid()) AND status = 'published'
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.status = 'active'));

DROP POLICY IF EXISTS learning_channels_update_own ON public.learning_channels;
CREATE POLICY learning_channels_update_own ON public.learning_channels
FOR UPDATE TO authenticated
USING (owner_id = (SELECT auth.uid()))
WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS learning_channels_delete_own ON public.learning_channels;
CREATE POLICY learning_channels_delete_own ON public.learning_channels
FOR DELETE TO authenticated
USING (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS learning_channel_videos_read_published_or_owner ON public.learning_channel_videos;
CREATE POLICY learning_channel_videos_read_published_or_owner ON public.learning_channel_videos
FOR SELECT TO authenticated
USING (
  (status = 'published' AND EXISTS (
    SELECT 1 FROM public.learning_channels c WHERE c.id = channel_id AND c.status = 'published'
  ))
  OR owner_id = (SELECT auth.uid())
);

DROP POLICY IF EXISTS learning_channel_videos_create_own_channel ON public.learning_channel_videos;
CREATE POLICY learning_channel_videos_create_own_channel ON public.learning_channel_videos
FOR INSERT TO authenticated
WITH CHECK (
  owner_id = (SELECT auth.uid()) AND status = 'published'
  AND EXISTS (
    SELECT 1 FROM public.learning_channels c
    WHERE c.id = channel_id AND c.owner_id = (SELECT auth.uid()) AND c.status = 'published'
  )
);

DROP POLICY IF EXISTS learning_channel_videos_update_own ON public.learning_channel_videos;
CREATE POLICY learning_channel_videos_update_own ON public.learning_channel_videos
FOR UPDATE TO authenticated
USING (owner_id = (SELECT auth.uid()))
WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS learning_channel_videos_delete_own ON public.learning_channel_videos;
CREATE POLICY learning_channel_videos_delete_own ON public.learning_channel_videos
FOR DELETE TO authenticated
USING (owner_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_channels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_channel_videos TO authenticated;

COMMIT;

-- Verify after running:
-- SELECT to_regclass('public.learning_channels'), to_regclass('public.learning_channel_videos');

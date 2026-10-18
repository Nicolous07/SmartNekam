-- SmartNekam SQL 022: additive official institution communities and study channels
-- Run after SQL 001A-021 have succeeded. Does not drop existing data or features.
BEGIN;

CREATE TABLE IF NOT EXISTS public.institution_communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
  university_id uuid UNIQUE REFERENCES public.universities(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT 'Jamii rasmi ya taasisi ya SmartNekam.',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT institution_community_one_institution CHECK ((school_id IS NOT NULL)::int + (university_id IS NOT NULL)::int = 1)
);
CREATE TABLE IF NOT EXISTS public.institution_community_members (
  community_id uuid NOT NULL REFERENCES public.institution_communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_role text NOT NULL DEFAULT 'member' CHECK (member_role IN ('member','visitor','ambassador','admin')),
  verified_student boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id,user_id)
);
CREATE TABLE IF NOT EXISTS public.study_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid REFERENCES public.institution_communities(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  level text NOT NULL CHECK (level IN ('O_LEVEL','A_LEVEL','UNIVERSITY','ALL')),
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (community_id,slug)
);
CREATE TABLE IF NOT EXISTS public.study_channel_members (
  channel_id uuid NOT NULL REFERENCES public.study_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id,user_id)
);

ALTER TABLE public.institution_communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_channel_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Institution communities readable by signed in users" ON public.institution_communities;
CREATE POLICY "Institution communities readable by signed in users" ON public.institution_communities FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Institution memberships visible to members" ON public.institution_community_members;
CREATE POLICY "Institution memberships visible to members" ON public.institution_community_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.institution_community_members mine WHERE mine.community_id = institution_community_members.community_id AND mine.user_id = auth.uid()));
DROP POLICY IF EXISTS "Study channels readable by signed in users" ON public.study_channels;
CREATE POLICY "Study channels readable by signed in users" ON public.study_channels FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Own channel memberships readable" ON public.study_channel_members;
CREATE POLICY "Own channel memberships readable" ON public.study_channel_members FOR SELECT TO authenticated USING (user_id = auth.uid());

GRANT SELECT ON public.institution_communities, public.institution_community_members, public.study_channels, public.study_channel_members TO authenticated;

CREATE OR REPLACE FUNCTION public.smartnekam_ensure_institution_community()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.school_id IS NOT NULL THEN
    INSERT INTO public.institution_communities (school_id, name)
    SELECT s.id, s.name || ' Official Community' FROM public.schools s WHERE s.id = NEW.school_id
    ON CONFLICT (school_id) DO NOTHING;
    INSERT INTO public.institution_community_members (community_id,user_id,member_role,verified_student)
    SELECT c.id, NEW.id, 'member', true FROM public.institution_communities c WHERE c.school_id = NEW.school_id
    ON CONFLICT (community_id,user_id) DO NOTHING;
  ELSIF NEW.university_id IS NOT NULL THEN
    INSERT INTO public.institution_communities (university_id, name)
    SELECT u.id, u.name || ' Official Community' FROM public.universities u WHERE u.id = NEW.university_id
    ON CONFLICT (university_id) DO NOTHING;
    INSERT INTO public.institution_community_members (community_id,user_id,member_role,verified_student)
    SELECT c.id, NEW.id, 'member', true FROM public.institution_communities c WHERE c.university_id = NEW.university_id
    ON CONFLICT (community_id,user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_auto_join_institution_community ON public.profiles;
CREATE TRIGGER profiles_auto_join_institution_community AFTER INSERT OR UPDATE OF school_id, university_id ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.smartnekam_ensure_institution_community();

-- Seed course/level channels as global channels. Idempotent.
INSERT INTO public.study_channels (community_id,slug,title,level,description) VALUES
(NULL,'computing-it','Computing & IT','UNIVERSITY','Programming, AI, data science na coding.'),
(NULL,'medicine-health','Medicine & Health','UNIVERSITY','Medicine, nursing na health sciences.'),
(NULL,'engineering','Engineering','UNIVERSITY','Engineering, practicals na lab manuals.'),
(NULL,'business-economics','Business & Economics','UNIVERSITY','Business, economics na entrepreneurship.'),
(NULL,'law','Law','UNIVERSITY','Legal studies na discussion.'),
(NULL,'form-4-csee','Form 4 CSEE','O_LEVEL','CSEE revision, past papers na majibu.'),
(NULL,'a-level-pcb','A-Level PCB','A_LEVEL','Physics, Chemistry na Biology.'),
(NULL,'a-level-pcm','A-Level PCM','A_LEVEL','Physics, Chemistry na Mathematics.'),
(NULL,'a-level-egm','A-Level EGM','A_LEVEL','Economics, Geography na Mathematics.')
ON CONFLICT (community_id,slug) DO NOTHING;

-- Existing profiles get their official community membership too.
INSERT INTO public.institution_communities (school_id,name)
SELECT s.id, s.name || ' Official Community' FROM public.schools s
JOIN public.profiles p ON p.school_id=s.id
ON CONFLICT (school_id) DO NOTHING;
INSERT INTO public.institution_communities (university_id,name)
SELECT u.id, u.name || ' Official Community' FROM public.universities u
JOIN public.profiles p ON p.university_id=u.id
ON CONFLICT (university_id) DO NOTHING;
INSERT INTO public.institution_community_members (community_id,user_id,member_role,verified_student)
SELECT c.id,p.id,'member',true FROM public.profiles p JOIN public.institution_communities c ON c.school_id=p.school_id OR c.university_id=p.university_id
ON CONFLICT (community_id,user_id) DO NOTHING;

COMMIT;
NOTIFY pgrst, 'reload schema';

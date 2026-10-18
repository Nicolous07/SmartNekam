# SmartNekam — Frontend (Next.js)

Frontend hii imesasishwa kutumia schema ya Supabase ya SmartNekam iliyotengenezwa kwa SQL migrations 001A–014. Theme ya msingi ya green / black / white na asset za mradi wa awali zimehifadhiwa pale zilipoweza kutumika.

## Mahitaji
- Node.js 20.9+ (Node 22 inapendekezwa kwa Next.js ya sasa)
- npm
- Supabase project ya SmartNekam yenye migrations 001A–014 zilizotekelezwa

## Kuanzisha
1. Fungua folder `SmartNekam_App_Source` kwa VS Code.
2. Hakikisha `.env.local` ipo kwenye root, sehemu moja na `package.json`.
3. Terminal:

   ```bash
   npm install
   npm run dev
   ```

4. Fungua `http://localhost:3000`.

## Environment variables
Faili `.env.local` linalokuja na kifurushi limetumia project URL na publishable key ulizotoa. Tumia publishable key kwenye browser/server Supabase clients; usiweke `service_role` key au secret key kwenye frontend.

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Jina `NEXT_PUBLIC_SUPABASE_ANON_KEY` limeachwa ili liendane na existing client helpers, lakini thamani yake inaweza kuwa publishable key ya Supabase.

## Supabase Auth
Katika Supabase Dashboard → Authentication → URL Configuration, ongeza `http://localhost:3000` kama Site URL/development URL na uangalie Redirect URLs za callback zinazotumiwa na auth page. Kwa production, tumia domain halisi ya app.

## Roles za staff
- Usijipe role kwa kuhariri profile kupitia browser. Role za `moderator`, `school_admin` na `super_admin` zinapaswa kuwekwa na trusted administrator kupitia SQL Editor/server-side privileged workflow.
- Baada ya akaunti yako kusajiliwa, unaweza kuthibitisha user yako na profile katika SQL Editor. Tumia email yako halisi kwa query hii na usibadilishe role ya user mwingine:

  ```sql
  UPDATE public.profiles AS p
  SET role = 'super_admin'
  FROM auth.users AS u
  WHERE p.id = u.id
    AND u.email = 'WEKA_EMAIL_YAKO_HAPA';
  ```

  Endesha hii tu kwenye Supabase SQL Editor ukiwa una mamlaka ya admin wa project; usiwahi kuweka privileged database key kwenye frontend.

## Modules zilizounganishwa
- Dashboard: profiles, progress, notes/papers, questions, opportunities, courses, daily challenge na notifications.
- Library uploads/downloads: private `learning-resources` bucket na notes/past papers schema.
- Community: study groups, posts, chat messages, Q&A, mentors, live sessions na events.
- Learn: quizzes, flashcards, study planner, courses/lessons na leaderboards.
- Opportunities: scholarships, programmes, saved items na application tracker.
- Profile/settings, notifications, moderator dashboard, certificate verification, wallet/subscriptions data views, parent/school data schema.
- Search hutumia RPC `search_smartnekam`.

## Bado vinahitaji integrations/QA kabla ya production
SQL schema pekee haitumii provider integrations moja kwa moja. AI responses, mobile-money confirmations, push notifications, document/data deletion workers, scheduled reminders, live video, na baadhi ya admin workflows zinahitaji server-side functions/providers na majaribio ya role-specific access. Subjects, course content, opportunities na quiz questions pia zinahitaji seed/import data.

## Migrations
Angalia `sql/README-SQL-SW.md`. SQL 001A–014 ziliripotiwa kufanikiwa kwenye Supabase yako. SQL 015 ni patch ya ziada kwa moderation queue na private invite links; endesha kwenye SQL Editor baada ya kukagua file na schema yako.

## Maboresho ya Profile na Chat (SQL 017)
Tazama `SQL-017-SETUP-SW.md`. Endesha migration ya `SQL-017_smartnekam_profiles_chat_groups_message_controls.sql` kabla ya kutumia registration mpya, profile photos, chat groups na message reply/edit/delete/reactions.

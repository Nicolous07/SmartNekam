# SmartNekam — Marekebisho ya Study Planner (SQL 043)

## Tatizo

`complete_study_plan_item()` ya awali iliweka kazi kuwa imekamilika na kisha kufanya `UPDATE public.profiles` kwenye fields za streak/last activity. Database yako ina ulinzi unaokataa kubadilisha system-managed profile fields, hivyo kukamilisha kazi kulitoa error.

## Marekebisho

SQL 043 inabadilisha RPC `public.complete_study_plan_item(UUID)` ili:

- ihakikishe mtumiaji ameingia;
- iruhusu mtumiaji kukamilisha task yake mwenyewe tu;
- iweke `study_plan_items.status = 'completed'` na `completed_at`;
- ihifadhi activity kwenye `user_learning_days` bila kufuta activity iliyokuwepo siku hiyo;
- isiandike moja kwa moja kwenye `public.profiles`, hivyo haitagongana na profile guard.

Kwa sababu profile fields zinalindwa na mfumo, SQL hii haitasasisha streak/XP moja kwa moja. Gamification/streak inapaswa kusimamiwa na trusted central gamification routine, si na Study Planner kuandika `profiles` moja kwa moja.

## Kuweka

1. Supabase Dashboard → SQL Editor → New query.
2. Fungua `SMARTNEKAM_SQL_043_STUDY_PLANNER_PROFILE_GUARD_FIX.sql`, nakili yote na u-run.
3. Hakikisha query ya mwisho inaonyesha `avoids_direct_profile_update = true` na `security_definer = true`.
4. Kwenye code, tumia `src/components/learning/StudyPlanner.tsx` kutoka patch/full project. Mabadiliko ya UI yanaondoa ujumbe wa mafanikio wa zamani wakati wa kujaribu kukamilisha task, ili error na success notice zisionekane pamoja.

## Hakuna haja ya

- kuzima profile guard;
- kubadilisha grants za `profiles`;
- kuendesha SQL 041/042 tena;
- kufanya mabadiliko ya frontend kwenye `.env.local`.

Migration inahitaji SQL za msingi 001A/001B, 004 na 008 ziwe tayari zimetekelezwa.

# SmartNekam — UPGRADE 022 (Kiswahili)

## Maboresho
- Profile route haizuiwi tena na onboarding redirect ikiwa mtumiaji hajakamilisha `level`; sasa anaweza kufungua profile na kurekebisha taarifa.
- Avatar ya mtumiaji inaonekana kwenye profile link ya navbar ikiwa `profiles.avatar_url` imejazwa; posts na chats zinaendelea kutumia picha badala ya initials pale URL ipo.
- Jamii imeongezewa tabs za **Shule na Vyuo Rasmi** na **Channels za Masomo**, bila kuondoa Q&A, Study Groups, Mentorship, Events au Chats.
- SQL 022 inaongeza official institution communities, auto-enrollment kwa profiles zenye school_id/university_id, na channels za O-Level/A-Level/University.

## Kuweka
1. Hifadhi backup ya Supabase.
2. SQL 001A–021 zikiwa tayari zimefanikiwa, run `SQL-022_smartnekam_institution_communities_channels.sql` kwenye Supabase SQL Editor.
3. Tumia source code iliyo kwenye ZIP, kisha endesha `npm ci` na `npm run dev`.
4. Jaribu profile link, avatar ya post, na Jamii > Shule na Vyuo Rasmi / Channels za Masomo.

Migration haifuti tables au data zilizopo. Hata hivyo, migration haijajaribiwa kwenye Supabase halisi ya mtumiaji; hifadhi backup kabla ya ku-run.

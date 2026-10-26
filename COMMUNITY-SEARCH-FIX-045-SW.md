# SmartNekam — Community Auto-Join & Global Search Fix (SQL 045)

## Tatizo linalorekebishwa

SQL 045 inarekebisha flow ya Official Community kwa kutumia school_id / university_id halisi badala ya kutegemea maandishi ya jina pekee. Inajaribu kurejesha ID kutoka Supabase Auth metadata na kutumia jina/alias pale tu ambapo jina linatoa match moja tu. Majina yanayolingana na shule zaidi ya moja hayachaguliwi kwa kubahatisha.

## Yaliyomo

- Hufungua Official Community kwa kila shule/chuo kilichopo kwenye registry.
- Huunganisha profile yenye school_id au university_id sahihi na Official Community yake.
- Hujaribu kurekebisha profiles za zamani kwa kutumia Auth metadata au jina/alias la taasisi lenye match ya kipekee.
- Huunda/huweka trigger ya auto-join kwa signup mpya au profile ikibadilisha taasisi.
- RPC join_smartnekam_institution_community hurekebisha affiliation pale inapoweza, kisha huruhusu kujiunga ikiwa ID ya shule/chuo inalingana kabisa.
- Huondoa membership za zamani za Official Community ambazo zinakinzana na taasisi iliyo kwenye profile.
- Huongeza RPC search_smartnekam_global kwa kutafuta katika matokeo yaliyokuwepo pamoja na Home Feed posts/comments, institution communities, group posts zinazoonekana, Q&A answers/comments, mentors walioidhinishwa, events na public live sessions.
- UI ya SearchDialog sasa hutumia RPC mpya na ina routes/labels kwa matokeo mapya. Ikiwa SQL 045 bado haijaendeshwa, hutumia utafutaji wa zamani kama fallback.

## Mahitaji kabla ya ku-run

Hakikisha msingi wa SmartNekam umewekwa, hasa:
- sql/001A_smartnekam_foundation_tables.sql
- sql/003_smartnekam_community_qa.sql
- sql/014_smartnekam_global_search.sql
- sql/016_smartnekam_social_feed_direct_messages.sql
- sql/019_smartnekam_preferences_school_signup.sql
- sql/022_smartnekam_institution_communities_channels.sql
- sql/023_tanzania_institution_registry.sql
- sql/024_smartnekam_official_community_same_institution_only.sql

## Jinsi ya kuendesha

1. Fungua Supabase Dashboard → SQL Editor → New query.
2. Fungua faili sql/045_smartnekam_community_autojoin_global_search.sql kwenye mradi.
3. Nakili faili lote, libandike kwenye SQL Editor na bonyeza Run.
4. Baada ya Success, deploy toleo la frontend lenye src/components/layout/SearchDialog.tsx kutoka branch ya fix.
5. Jaribu search kwa jina la shule, neno kwenye post, neno kwenye answer, jina la mentor na title ya event.
6. Jaribu kuingia kwa akaunti yenye shule sahihi na ubonyeze “Jiunge na jamii rasmi”.

## Ukaguzi wa baada ya migration

\`\`\`sql
-- Orodha ya profiles ambazo bado hazina ID ya taasisi lakini zina jina la taasisi lililohifadhiwa.
SELECT id, full_name, level, institution_name
FROM public.profiles
WHERE school_id IS NULL
  AND university_id IS NULL
  AND NULLIF(btrim(institution_name), '') IS NOT NULL;

-- Hakikisha memberships za Official Community zinaendana na profile.
SELECT count(*) AS mismatched_memberships
FROM public.institution_community_members m
JOIN public.institution_communities c ON c.id = m.community_id
JOIN public.profiles p ON p.id = m.user_id
WHERE (c.school_id IS NOT NULL AND p.school_id IS DISTINCT FROM c.school_id)
   OR (c.university_id IS NOT NULL AND p.university_id IS DISTINCT FROM c.university_id);

-- Smoke test ya search.
SELECT * FROM public.search_smartnekam_global('mathematics', 20, NULL);
\`\`\`

## Muhimu

- Migration haiwezi guess kwa usalama kama jina la taasisi halipo kwenye registry au lina matches nyingi; profile hizo zitabaki bila ID hadi registry/alias isahihishwe.
- Migration inafuta tu stale memberships za Official Community zisizolingana na school/university ID ya profile. Haiifuti profile, post, chat, notes, au Q&A.
- Search haitafuti private direct messages, private chat content au document vault files. Matokeo yanaheshimu RLS/ruhusa za maudhui.
- Hakuna Supabase service-role key au payment secret inayohitajika katika frontend.

# SmartNekam SQL 020 — Marekebisho ya Chat Groups na theme ya UI

## Kwa nini SQL 020?

SQL hii inarekebisha function ya kuunda chat group ikiwa SQL 017 iliishia bila kusajili function ipasavyo kwenye Supabase/PostgREST. Inatoa ruhusa ya `EXECUTE` kwa `authenticated`, inahakikisha group inahifadhiwa pamoja na muundaji kama admin, na inafanya Supabase isome upya RPC schema cache.

## Hatua

1. Hifadhi backup ya database yako.
2. Fungua Supabase Dashboard → SQL Editor → New query.
3. Bandika faili lote `020_smartnekam_chat_group_creation_repair.sql` na ubofye Run.
4. Usirudie SQL 001–019 ikiwa migrations hizo tayari zilifanikiwa.
5. Fanya refresh ya SmartNekam, nenda **Jamii → Chats → Chat Groups · Unda / Jiunge**, kisha jaribu kuunda group la majaribio.
6. Ikiwa group bado halitengenezwi, UI sasa itaonyesha ujumbe halisi wa Supabase. Tuma huo ujumbe kamili ili kosa mahsusi lirekebishwe.

## Urambazaji wa simu

- Swipe kushoto: huenda sehemu inayofuata (Home → Learn → Jamii → Fursa → Maktaba → Profile).
- Swipe kulia: hurudi sehemu iliyopita.
- Swipe inaanzia kwenye nafasi ya kawaida ya ukurasa pekee; links, vitufe, inputs na maeneo ya horizontal scrolling hazitabadilishwa.

## Theme

UI sasa hutumia navy/dark blue, kadi za slate, indigo/violet na turquoise kulingana na reference image. Dark theme ndiyo default mpya; unaweza kuchagua light theme kupitia Theme Toggle.

# SmartNekam SQL 019 — Mwongozo wa Kiswahili

Migration hii inarekebisha `Permission denied for table user_app_preferences`, inahakikisha mipangilio ya faragha inaweza kuhifadhiwa, na kuhifadhi shule/chuo kilichochaguliwa wakati wa usajili.

## Hatua

1. Hifadhi backup ya database kabla ya migration.
2. Fungua Supabase Dashboard → SQL Editor → New query.
3. Bandika faili lote `019_smartnekam_preferences_school_signup.sql` na ubonyeze Run.
4. SQL hii inategemea SQL 001A/001B, SQL 013 na SQL 017 kuwa zili-run. Ikiwa SQL 017 ilishafanikiwa, usiirudie.
5. Fungua SmartNekam, jisajili kwa akaunti ya majaribio, kisha jaribu Profile → Hifadhi mabadiliko.

## Shule na vyuo kwenye usajili

Fomu husoma shule kutoka `public.schools` na vyuo kutoka `public.universities`. Orodha itakuwa na chaguo tu pale ambapo taasisi zimeingizwa kwenye database. Ikiwa orodha ni tupu, ongeza taarifa za shule/chuo kwenye jedwali husika (kwa SQL Editor au admin tooling iliyopo) kisha refresh ukurasa wa usajili. Uchaguzi umeachwa hiari ili orodha tupu isizuie mtumiaji kufungua akaunti.

## Ujumbe wa hesabu kwenye posts

Uandishi wa kawaida, preview na majedwali vinaendelea kufanya kazi. Kitufe cha zana za LaTeX/hesabu kimeondolewa; fomula zilizoandikwa kwa syntax ghafi kama `\sqrt` au `\sum` sasa haziwasilishwi kama amri ndefu kwa wasomaji.

## Kumbuka

Nimetengeneza na kukagua source code, lakini sina uthibitisho wa kuendesha SQL hii kwenye database yako halisi. Ukiapata error, tuma ujumbe mzima na mstari ulioonyeshwa.

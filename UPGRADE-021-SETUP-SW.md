# SmartNekam — SQL 021 (Group Members, Follow & Mobile Navigation)

SQL 021 hurekebisha hitilafu ya `conversation_id is ambiguous` inayotokea wakati wa kuunda Chat Group, inaongeza uwezo wa kualika wanachama kwenye group, na inaongeza kitufe cha Follow kwenye posts.

## Ikiwa SQL 001–020 tayari zilifanikiwa

1. Hifadhi backup ya Supabase database.
2. Fungua Supabase Dashboard → SQL Editor → New query.
3. Fungua `021_smartnekam_group_members_follow_navigation.sql`, nakili SQL yote, kisha Run.
4. Subiri ujumbe wa mafanikio. Usirudie migrations 001–020.
5. Deploy/restart SmartNekam na refresh browser.
6. Jaribu `Jamii → Chats → Chat Groups → Unda group`.
7. Baada ya group kufunguka, bonyeza `Ongeza watu`, tafuta kwa jina/username, chagua watu na bonyeza `Ongeza waliochaguliwa`. Mwanachama yeyote wa group anaweza kutumia kitufe hicho; hadi watu 50 wanaweza kuchaguliwa kwa mara moja.
8. Kwenye post ya mtumiaji mwingine, bonyeza `Fuata`. Kitufe hakionekani kwenye post ya kujificha jina (anonymous) au post yako mwenyewe.

## Ikiwa unajenga database mpya

Endesha migrations kwa mpangilio uliopo kwenye mradi huu. SQL 021 inategemea tables na RPC zilizowekwa na SQL 006, 016, 017, 018 na 020.

## Marekebisho ya UI

- Navigation ya simu sasa ni bar nyeusi iliyoinuka, yenye kitufe cha sehemu inayotumika cha kijani-lime na kitufe cha kati cha `+`.
- Swipe ya kurasa kuu kwenye simu ni Home → Learn → Jamii → Profile. Navigation ya chini huficha inaposogea chini kama ilivyokuwa awali.
- Avatar ya profile sasa huonekana yote juu ya cover, bila kukatwa na card.
- Kitendo cha Follow kinaonekana sambamba na Like, Comment na Share.

## Ikiwa bado kuna kosa

Nakili kosa lote kutoka Supabase SQL Editor au ujumbe wa SmartNekam. SQL 021 inatengeneza upya RPC ya kuunda group, kwa hiyo haipaswi kuhitaji kurudia SQL 017/020.

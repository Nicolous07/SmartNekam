# SmartNekam — Video moja hadi 50 MB na YouTube player kwenye Home Feed

## Kilichoongezwa kwenye app

- Video moja inaweza kupakiwa kutoka kwenye kifaa hadi **50 MB**.
- Mtumiaji anaweza kuchagua klipu 2–5 na kubonyeza **Unganisha video**. Browser huzicheza kwa mpangilio na kurekodi matokeo kuwa faili moja; faili la mwisho lazima liwe 50 MB au chini.
- Jumla ya faili za kuanzia kwa merge ni hadi 150 MB ili kupunguza matumizi makubwa ya kumbukumbu ya simu/kompyuta. Kila klipu ya kuanzia inaweza kuwa hadi 50 MB.
- Picha na nyaraka zimebaki na kikomo cha 10 MB kila moja, na kikomo cha viambatisho 5 kwa post bado kipo.
- Link za video za YouTube zinatambuliwa kwenye maandishi ya post. Home Feed huonyesha YouTube player ndani ya post, ili mtumiaji abonyeze Play bila kutoka kwenye feed.
- Video player ya post huendelea kucheza video iliyowekwa kama attachment; YouTube video inachezwa kupitia official embed player.

## Hatua za kuwezesha

1. Endesha `sql/051_smartnekam_feed_50mb_video_merge_youtube.sql` kwenye Supabase → SQL Editor.
2. Kwenye Supabase Dashboard, hakikisha **Storage → Settings → Global file size limit** iko 50 MB au zaidi. Kikomo cha bucket pekee hakiwezi kuzidi global limit ya project.
3. Hakikisha deployment ya Vercel kwa commit ya sasa imekamilika.

## Kutumia

### Kuunganisha klipu kuwa video moja
1. Home → Home Feed → Chapisha post.
2. Kwenye sehemu ya viambatisho, chagua **Unganisha video**.
3. Chagua klipu 2 hadi 5. Jumla ya klipu za kuanzia isiwe zaidi ya 150 MB.
4. Subiri browser iunganishe klipu. Ikiwa matokeo yanazidi 50 MB au browser haiwezi kucheza format fulani, app itaonyesha ujumbe wa kosa; tumia klipu fupi/ndogo au pakia video moja iliyokwisha unganishwa.
5. Hakiki preview ya video, andika maelezo ya post, kisha Chapisha.

Merging hufanyika ndani ya browser na hutumia CPU/kumbukumbu ya kifaa. Matokeo yanaweza kuwa WebM au MP4 kulingana na format zinazoungwa mkono na browser. Video zenye codec isiyoungwa mkono haziwezi kuunganishwa na browser hiyo.

### Kuonyesha YouTube ndani ya post
Bandika link kamili ya video ndani ya maandishi ya post. Link za kawaida `youtube.com/watch?v=...`, `youtu.be/...`, `youtube.com/shorts/...`, `youtube.com/embed/...` na `youtube.com/live/...` zinatambuliwa. Baada ya kuchapisha, player huonekana chini ya maandishi. Mtazamaji akibonyeza Play, video huchezwa ndani ya feed. Baadhi ya video zinaweza kuzima embedding na zitaonyesha ujumbe wa YouTube wenyewe.

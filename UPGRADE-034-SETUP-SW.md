# SmartNekam Upgrade 034 — Notifications, Q&A Camera Scan, Chat Attachments

Upgrade này inaongeza arifa maalum, kuweka maswali ya akaunti yako juu, kupiga picha ya swali kwa kamera, na kutuma/kuona/pakua viambatanishi kwenye chat.

## 1. Hifadhi kazi yako na weka frontend

1. Tengeneza backup ya mradi na `.env.local` yako.
2. Hamisha yaliyomo kwenye ZIP hii kwenye mradi wako, bila kubadilisha `.env.local` yako.
3. Kama una-copy faili kwa mkono, faili kuu zilizobadilishwa ni:
   - `src/components/notifications/PushNotificationSetup.tsx`
   - `src/components/community/CommunityActions.tsx`
   - `src/components/communities/DirectMessages.tsx`
   - `src/app/(app)/communities/page.tsx`
   - `src/app/(app)/communities/questions/[id]/page.tsx`

## 2. Endesha SQL 034

1. Fungua Supabase Dashboard → SQL Editor → New query.
2. Nakili faili kamili `SQL-034_smartnekam_focused_notifications_chat_media.sql`.
3. Bonyeza Run na hakikisha hakuna error.

Inategemea migration za msingi za SmartNekam, hasa SQL 003 (Q&A), SQL 006 (chat/mentor_sessions), SQL 007 (notifications), SQL 016/017 (DM + chat permissions), SQL 021 (follows) na SQL 033 (push notifications). Usirun kabla ya hizo kuwepo.

## 3. Notifications zinazotolewa

- Post mpya kutoka kwa mtu anayefuatwa: inaenda kwa followers wake tu.
- Ujumbe mpya wa direct chat/mentor chat: unaenda kwa mpokeaji, si mtumaji mwenyewe.
- Ombi jipya la mentorship: mentor anapata notification; mwanafunzi anaambiwa ombi limekubaliwa au limekataliwa.
- Ujumbe wa admin: unatumia RPC za admin zilizopo; push itatolewa kwa kifaa kilichosajiliwa.
- Jibu jipya kwenye swali la Q&A: mmiliki wa swali anaarifiwa na kiungo kinafungua swali husika.

Arifa za zamani za group chat/comments/support zimezimwa ili zifuate orodha uliyoomba. Notifications zilizokwishahifadhiwa hazifutwi.

## 4. Scan swali kwa kamera

Kwenye Communities → Q&A → Uliza swali, bonyeza `Piga/scan swali kwa kamera`, piga picha, jaza somo/maelezo, kisha Tuma swali. Kwenye simu, browser inaweza kuomba ruhusa ya kamera au kufungua camera/file picker kulingana na OS/browser. Picha itahifadhiwa kwenye bucket ya faragha `community-attachments` na kuonekana kwenye ukurasa wa swali. Max 10 MB kwa picha hii.

## 5. Viambatanishi vya chat

Kwenye Chat, bonyeza alama ya paperclip kuchagua picha, sauti, video au faili linalokubaliwa (max 10 MB). Mpokeaji ataweza kuona picha, kusikiliza sauti, kucheza video au kufungua/kupakua faili. Viambatanishi vinabaki kwenye private bucket `smartnekam-chat-attachments`; ni washiriki wa mazungumzo tu wanaoweza kuvifikia.

## 6. Push notification ya simu/PC

Kwenye Notifications, bonyeza `Allow notifications`. Browser itaonyesha ombi rasmi la ruhusa. Ikiruhusiwa, subscription itahifadhiwa kwenye `push_devices`. Push halisi bado inahitaji VAPID secrets, deployed Supabase Edge Function `smartnekam-push`, na Database Webhook ya `public.notifications` → `INSERT` kama ilivyo kwenye `PUSH-NOTIFICATIONS-SETUP-SW.md`.

Tovuti haiwezi kulazimisha kufungua ukurasa wa System Settings wa kila OS/browser kwa sababu browser haifichui API ya jumla kwa hilo. Ikiwa ruhusa imezuiwa tayari, ujumbe mfupi utaelekeza kufungua Site settings za SmartNekam → Notifications → Allow, kisha kurudi kwenye app.

## 7. Jaribio

- Fuata account A kwa account B; chapisha post kama B; hakikisha A anapata notification.
- Tuma direct message kutoka A kwenda B; hakikisha B tu ndiye anayepata.
- Tuma mentorship request; hakikisha mentor anaona notification.
- Uliza swali kwa account A na ujibu kwa B; hakikisha A ana notification inayofungua swali lake.
- Piga picha ya swali na uhakikishe inafunguka kwenye question detail.
- Tuma picha/audio/file kwenye chat na hakikisha akaunti ya pili inaweza kuona/kusikiliza/kupakua.
- Ruhusu browser push kwenye vifaa vyote unavyotaka kuarifiwa na uthibitishe Database Webhook ina status ya mafanikio.

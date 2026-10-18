# SmartNekam — Daily Challenge Manager (SQL 039)

## Kilichoongezwa
- Sehemu mpya ya **Daily Challenge** ndani ya Admin Panel.
- Fomu ya kuandika kichwa, maelezo, lebo ya kiwango (hiari), tarehe na maswali matano yenye machaguo A–D na jibu sahihi.
- Kwa kuwa database ya sasa ina Daily Challenge moja kwa kila tarehe, changamoto inayopangwa ni ya watumiaji wote; level ni lebo ya maudhui tu.
- Kitufe cha **Tengeneza na Tuma**: huunda quiz, huhifadhi answer keys, huchapisha, hupanga tarehe na kuingiza notifications za in-app kwa profiles zilizo active.
- Orodha ya changamoto za leo, zijazo na zilizopita.
- Ukaguzi wa role ya `moderator` / `super_admin`, hali `active`, uthibitisho wa tarehe na kuzuia overwrite ya tarehe ambayo tayari imepangiwa.

## Kuweka kwenye mradi
1. Hifadhi nakala ya mradi na `.env.local`.
2. Nakili `src/components/admin/AdminDailyChallengeComposer.tsx`, pamoja na toleo lililosasishwa la `src/app/(app)/admin/page.tsx` na `src/app/(app)/admin/[module]/page.tsx`, kwenye njia hizo hizo.
3. Kwenye Supabase SQL Editor endesha `sql/039_smartnekam_admin_daily_challenge_manager.sql`. Inahitaji migrations za SQL 004 (quizzes/daily challenge) na SQL 007 (notifications/audit log) ziwe zimekamilika.
4. Anzisha upya app kwa `npm run dev`.
5. Ingia kama akaunti ya `moderator` au `super_admin` iliyo active, fungua **Admin Panel → Daily Challenge**, jaza maswali 5, chagua tarehe na ubonyeze **Tengeneza na Tuma**.

## Notifications
RPC huingiza taarifa katika `public.notifications` kwa akaunti zote zenye profile status `active`. Push ya kifaa inahitaji Database Webhook iliyounganishwa na Supabase Edge Function `smartnekam-push`, VAPID keys na watumiaji kuwa wamewasha push. Bila push setup, notifications za ndani ya app bado zinahifadhiwa.

## Tahadhari
- Challenge moja tu inaruhusiwa kwa tarehe moja; ikiwa tarehe imepangiwa tayari, chagua tarehe nyingine. SQL haibadilishi challenge iliyopo kimyakimya.
- Hakuna key ya jibu inayorejeshwa kwa student page kabla ya kuwasilisha.
- Build nzima lazima ijaribiwe kwenye mazingira yenye dependencies: `npm install` kisha `npm run build`.

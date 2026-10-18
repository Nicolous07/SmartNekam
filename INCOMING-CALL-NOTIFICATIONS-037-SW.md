# SmartNekam — Arifa za simu zinazoingia (SQL 037)

SQL 037 huunda notification kila offer mpya ya simu inapoingia kwenye `public.smartnekam_call_signals`. Notification hiyo inaonekana kwenye app kupitia `NotificationRealtimeBridge`, na inatumwa kwenye kifaa kupitia Database Webhook iliyopo ya `public.notifications` INSERT.

## Mahitaji
- SQL 033: `notifications`, `push_devices`, preferences, na Edge Function/Webhook ya push imewekwa.
- SQL 036: `public.smartnekam_call_signals` na policies za RLS zipo.
- Mtumiaji aliyepigiwa simu ana akaunti active na ameshawasha browser push kwenye kifaa hicho.

## Kuweka
1. Supabase Dashboard → SQL Editor → New query.
2. Fungua `sql/037_smartnekam_incoming_call_notifications.sql`, nakili yote, bonyeza Run.
3. Hakikisha Database Webhook ya `public.notifications` INSERT inaelekeza kwenye `smartnekam-push` Edge Function na header `x-smartnekam-webhook-secret` inalingana na `PUSH_WEBHOOK_SECRET`.
4. Hakikisha `/sw.js` imewekwa root na watumiaji wamebonyeza “Allow notifications” kwenye SmartNekam.
5. Badilisha `src/components/communities/DirectMessages.tsx`, `src/components/notifications/NotificationRealtimeBridge.tsx` na `public/sw.js` kwa matoleo ya mradi huu, kisha anzisha upya app.

## Matokeo
- Offer ya simu hutengeneza notification moja tu; answer/ICE/reject/hangup hazitengenezi notification mpya.
- App toast inaonyesha “Simu ya sauti inayoingia” na kiungo cha kufungua chat husika.
- Push ya kifaa ina jina la anayepiga na vibration pattern pale kifaa/browser vinapoiunga mkono.
- Ikiwa mtumiaji anafungua chat baada ya push, `DirectMessages` huangalia offer ya hivi karibuni ili aruhusiwe kujibu hata kama offer ilitumwa kabla ya chat kufunguliwa.

## Kumbuka
Website haiwezi kulazimisha OS/browser kuruhusu notifications au kufungua mipangilio ya kifaa. Push za background zinahitaji HTTPS (isipokuwa localhost), ruhusa ya mtumiaji, VAPID, push device active, na webhook/Edge Function iliyosetiwa. Web Push pia si sawa na simu ya asili ya simu; tabia ya vibration/kuonekana inategemea browser na mfumo wa kifaa.

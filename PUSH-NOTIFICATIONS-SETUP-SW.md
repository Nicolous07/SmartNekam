# SmartNekam — In-app + simu/PC Push Notifications

Marekebisho haya yanaongeza:

- Taarifa za ndani ya app na toast inapoingia notification mpya, mradi app iko wazi.
- Automatic in-app notifications kwa DM/mentor/group chats, study-group messages, majibu ya maswali, comments/majibu ya social feed na support tickets (internal staff notes hazitumwi kwa waombaji).
- Web Push kwa simu/PC kupitia Service Worker, ikiwemo background push wakati tab imefungwa kwa browser/OS zinazoiunga mkono.
- Admin anaweza kutuma kwa mtu mmoja, watumiaji alio-select, au akaunti zote active.

## A. Weka SQL

1. Fungua Supabase Dashboard → SQL Editor → New query.
2. Nakili na u-run faili `sql/033_smartnekam_push_and_message_notifications.sql` lote.
3. SQL 003 (community/Q&A), SQL 006 (chat/mentor), SQL 007 (notifications), SQL 013 (support tickets) na SQL 016 (social feed/comments) lazima ziwe tayari zimerun kabla ya SQL 033.

## B. Washa browser push

Web Push inahitaji VAPID key pair inayolingana kati ya browser na Supabase Edge Function. Kwa toleo hili, public key ya kuanzia tayari imewekwa kwenye UI ili kosa la “ongeza NEXT_PUBLIC_VAPID_PUBLIC_KEY” lisitokee key isipokuwepo `.env.local`.

Kama unataka kuisanidi wazi kwenye `.env.local` kwenye root ya Next.js app, ongeza mstari huu (tumia thamani hii hiyo ili ilingane na private key ya seva):

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BI0OkrwyzQjkekKBtfqw6iy2QgHgtlRlvWvdQi_DFrhdx_cKWe6dwlV2PUfp8HDPoM_eNwc55OsjJj_S-QkeBDU
```

Kama umebadilisha `.env.local`, anzisha upya Next.js. Private key usiiweke kwenye frontend, Git, wala `NEXT_PUBLIC_*`. Jozi ya keys na `PUSH_WEBHOOK_SECRET` imewekwa kwenye faili tofauti `SMARTNEKAM_VAPID_SERVER_SECRETS.txt` inayotolewa pamoja na marekebisho haya. **Usipakie faili hilo kwenye Git au ku-share hadharani.** Usitengeneze key pair mpya bila kubadilisha public key inayotumika kwenye frontend.

Weka values zilizomo kwenye faili hilo kwenye Supabase Edge Function secrets (Supabase CLI ikiwa tayari imesakinishwa):

```bash
supabase link --project-ref PROJECT_REF
# Badilisha PROJECT_REF kwa project ref yako.
supabase secrets set VAPID_PUBLIC_KEY="<public key kutoka kwenye faili la secrets>" VAPID_PRIVATE_KEY="<private key kutoka kwenye faili la secrets>" PUSH_WEBHOOK_SECRET="<webhook secret kutoka kwenye faili la secrets>"
supabase functions deploy smartnekam-push --no-verify-jwt
```

`PUSH_WEBHOOK_SECRET` inapaswa kufanana kabisa na header `x-smartnekam-webhook-secret` utakayoseti kwenye Database Webhook. Usiiweke private key au webhook secret kwenye browser/frontend.

## C. Unganisha Database Webhook na Edge Function

Supabase Dashboard → Database → Webhooks → Create webhook:

- Name: `smartnekam-notification-push`
- Table: `public.notifications`
- Event: `INSERT` pekee
- Type/URL: HTTP Request / `POST`
- URL: `https://PROJECT_REF.supabase.co/functions/v1/smartnekam-push` (badilisha `PROJECT_REF` kwa project ref yako)
- Header: `x-smartnekam-webhook-secret` = thamani ya `PUSH_WEBHOOK_SECRET` uliyoseti kwenye Edge Functions secrets
- Kama dashboard ina chaguo la Verify JWT, lizime kwa function hii kwa kuwa function inalinda request kwa secret header maalum.

Webhook hii ndiyo hutuma push kwa simu/PC kila record mpya ya `notifications` inapoingizwa — ikijumuisha ujumbe wa chat na matangazo ya Admin.

## D. Washa kwa kifaa

1. Fungua SmartNekam kwa HTTPS (au `localhost` wakati wa development), ingia.
2. Fungua **Taarifa / Notifications**.
3. Bonyeza **Washa push notification** na ukubali ruhusa ya kivinjari/kifaa.
4. Rudia kwenye browser/kifaa kingine unachotumia.

Notification za ndani ya app hazihitaji ruhusa ya mfumo. Push ya simu/PC inategemea user kuruhusu notifications, kifaa/kivinjari kuunga mkono push, na Edge Function + Database Webhook kusanidiwa. Kwa iPhone/iPad, browser push huhitaji mazingira ya Safari/PWA yanayoungwa mkono na mfumo wa iOS.

## E. Jaribio

- Tuma DM kutoka akaunti A kwenda akaunti B: B anatakiwa kuona notification ya ndani ya app na push kwenye kifaa kilichosajiliwa.
- Tuma ujumbe kwenye study group: wanachama wengine walioko active wanapata notification.
- Comment kwenye post au jibu comment: mmiliki wa post/comment anapata notification.
- Tuma jibu kwenye support ticket: upande mwingine wa mazungumzo unapata notification.
- Admin → Notifications: jaribu `Mtu mmoja`, `Chagua wengi`, kisha `Wote` kwa ujumbe wa majaribio.
- Angalia Edge Function logs na Database Webhook logs endapo push haijafika. In-app notification inapaswa kuonekana kwenye `/notifications` hata kama kifaa hakijasajiliwa kwa push.

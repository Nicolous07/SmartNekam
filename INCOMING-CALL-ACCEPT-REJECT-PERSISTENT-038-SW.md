# SmartNekam — Arifa ya simu inayoingia inayodumu (SQL 038 / UI patch)

## Mabadiliko

- Arifa za kawaida ndani ya app bado huondoka baada ya sekunde 3.
- Arifa ya simu inayoingia haijiwekei timer; inabaki juu mpaka simu ijibiwe au ikatwe.
- Arifa ya ndani ya app ina vitufe **Pokea** na **Kata**.
- Push notification ya kifaa hutumia `requireInteraction` na hutoa vitufe vya Pokea/Kata kwenye browser/OS zinazounga mkono notification actions.
- Kubonyeza Pokea/Kata kwenye push hufungua SmartNekam kwenye chat husika na kutekeleza hatua kwenye call offer inayolingana.
- Baada ya jibu au kukataa kutumwa kwa mafanikio, app hufunga banner ya ndani na service worker hufunga push notification inayolingana.
- Ikiwa microphone/kuunganisha call kunashindwa au reject haikutumwa, arifa ya simu hubaki ili mtumiaji ajaribu tena.

## Faili zilizobadilishwa

1. `src/components/communities/DirectMessages.tsx`
2. `src/components/notifications/NotificationRealtimeBridge.tsx`
3. `public/sw.js`
4. `supabase/functions/smartnekam-push/index.ts`

## Kuweka kwenye mradi uliopo

1. Badilisha faili nne hapo juu kwa zile za toleo hili.
2. Huhitaji SQL mpya kwa mabadiliko haya ikiwa `smartnekam_call_signals` (SQL 036) na trigger ya incoming call notifications (SQL 037) tayari zimewekwa.
3. Deploy upya Edge Function baada ya kubadilisha code yake:

```bash
supabase functions deploy smartnekam-push
```

4. Thibitisha Supabase Function Secrets zipo: `PUSH_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, na `VAPID_SUBJECT` (hiari).
5. Hakikisha Database Webhook ya `public.notifications` / `INSERT` inaelekeza kwenye `smartnekam-push`.
6. Restart Next.js (`Ctrl+C`, kisha `npm run dev`) na reload browser kwa hard refresh. Service Worker `/sw.js` itasasishwa na browser.
7. Jaribu kwa akaunti mbili kwenye chat binafsi: piga simu, thibitisha arifa haiondoki yenyewe, bonyeza **Pokea** kwa upande wa mpokeaji, kisha jaribu tena na **Kata**.

## Muhimu

- Push za kifaa zinahitaji HTTPS (localhost inaruhusiwa kwa maendeleo), VAPID, Web Push subscription hai, webhook na ruhusa ya notifications ya kifaa.
- Vitufe vya Pokea/Kata ndani ya push notification vinategemea browser/OS; baadhi ya vifaa huonyesha arifa bila action buttons. Katika hali hiyo, fungua arifa ili kuona vitufe vya ndani ya SmartNekam.
- Mfumo hauwezi kukwepa mipangilio ya OS ya kuficha/dismiss notification. `requireInteraction` huomba arifa ibaki, lakini baadhi ya vifaa vinaweza kuwa na sera zao.
- Hakuna SQL mpya katika patch hii. Tumia migrations 036/037 ambazo tayari zipo kwenye mradi, ikiwa bado hazijaendeshwa.

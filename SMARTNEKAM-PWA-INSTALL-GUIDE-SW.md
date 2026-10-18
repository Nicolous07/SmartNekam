# SmartNekam PWA install patch — maelekezo ya Kiswahili

Patch hii inaongeza uwezo wa kusakinisha SmartNekam bila kuanzisha project mpya wala kubadilisha theme ya sasa.

## Majina yaliyohakikiwa

- `src/app/layout.tsx` hubaki na jina hili kwa sababu Next.js hulitumia kama root layout. Tunabadilisha import tu kuongeza install prompt.
- `public/manifest.webmanifest` hubaki na jina hili kwa sababu layout na browser zinarejea path hii.
- `public/sw.js` haijajumuishwa wala kubadilishwa: `PushNotificationSetup.tsx` iliyopo tayari inasajili `/sw.js` kwa push notifications. Component mpya ya install prompt haijaribu kuisajili tena.
- `src/components/pwa/SmartNekamInstallPrompt.tsx` ni jina jipya lililo mahsusi kwa SmartNekam; halibadilishi component iliyopo ya notifications.
- Icons mpya ziko kwenye `public/icons/` na Apple icon iko `public/apple-touch-icon.png`.

## Kuweka patch

1. Hifadhi backup ya project yako.
2. Fungua ZIP hii. Nakili mafaili yaliyomo kwenye root ya project yako huku ukidumisha folder paths. Kubali kubadilisha `src/app/layout.tsx` na `public/manifest.webmanifest` pekee kati ya mafaili yaliyopo.
3. Ikiwa uliwahi kutumia patch ya zamani na faili `src/components/pwa/PwaSupport.tsx` ipo, unaweza kuifuta baada ya kuthibitisha kuwa layout sasa ina import ya `SmartNekamInstallPrompt`. Ikiwa huku-copy patch ya zamani, faili hilo halipo na hakuna cha kufuta.
4. Endesha `npm ci` na `npm run build`.
5. Build ikipita, commit na push kwenye GitHub ili Vercel ifanye deployment.

## Kusakinisha

- Android: fungua SmartNekam kwenye Chrome, kisha chagua Sakinisha/Install app.
- iPhone/iPad: fungua kwa Safari → Share → Add to Home Screen.
- Windows: fungua kwa Edge → `...` → Apps → Install this site as an app.

PWA inahitaji mtandao kwa data ya Supabase; patch hii haihifadhi taarifa binafsi za login/feed offline.

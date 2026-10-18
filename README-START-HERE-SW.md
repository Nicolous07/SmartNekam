# SmartNekam app packages — anza hapa

Hii ni kit ya kuongeza njia ya kutengeneza Windows `.exe` kwenye SmartNekam iliyopo. Haibadilishi Next.js `package.json`, theme, Supabase, SQL au service worker ya PWA.

## Hatua ya kwanza tu
1. Pakua ZIP hii na uifungue.
2. Nakili folder `desktop` na faili `ANDROID-APPLE-WINDOWS-STEPS-SW.md` ndani ya root ya repository yako ya SmartNekam — kiwango kilekile chenye `package.json`, `src/` na `public/`.
3. Usizibadilishe wala kuzifuta faili nyingine.
4. Commit/push mabadiliko hayo kwenda GitHub.

## Kujenga Windows `.exe`
Baada ya hatua ya kwanza, fungua terminal ndani ya `desktop/`, kisha endesha:

```powershell
npm install
npm start
npm run dist:win
```

Fungua `desktop/release/` kupata installer `.exe` na portable `.exe`.

Programu hii ya desktop hufungua `https://smartnekam.vercel.app/`; inahitaji intaneti na itapata updates za tovuti baada ya Vercel deploy. Hii siyo bundle offline ya Next.js.

## Android na Apple
Fuata `ANDROID-APPLE-WINDOWS-STEPS-SW.md` baada ya Windows build kuthibitishwa. Usitengeneze au kupakia signing keys kwenye GitHub. iOS/App Store build inahitaji Mac yenye Xcode na akaunti ya Apple Developer.

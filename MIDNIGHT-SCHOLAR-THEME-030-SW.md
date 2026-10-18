# SmartNekam — Midnight Scholar Theme (v030)

Mabadiliko haya yanafanya **Midnight Scholar** kuwa theme ya msingi kwa mara ya kwanza app inapofunguliwa, na kuongeza chaguo za Dark, Light, System na AMOLED Black.

## Rangi kuu

| Token | Thamani | Matumizi |
|---|---|---|
| Background | `#0B0F1A` | Background kuu ya dark theme |
| Card | `#121826` | Cards, panels na navigation surfaces |
| Elevated card | `#1A2234` | Panels zilizoinuliwa/modals |
| Primary | `#4F7CFF` | Primary buttons, active states na links |
| Secondary | `#8B5CF6` | Purple accent, community na gradients |
| Success | `#22D3A6` | Verified, correct answers na progress |
| Warning | `#FFB020` | Deadlines na reminders |
| Danger | `#FF5C7A` | Errors na safety alerts |
| Text | `#F4F6FB` | Maandishi makuu kwenye dark |
| Muted text | `#A7B0C4` | Maandishi ya ziada kwenye dark |

## Theme modes

- **Dark · Midnight Scholar:** default kwenye usakinishaji mpya.
- **Light:** background laini `#F6F8FC`, cards nyeupe na primary blue.
- **System:** hufuata `prefers-color-scheme` ya kifaa na husasishwa OS ikibadilika.
- **AMOLED Black:** background kuu nyeusi kabisa `#000000`, cards karibu nyeusi.

Chaguo huhifadhiwa kwa `localStorage` chini ya key `theme`. Hali ya awali ni Dark iwapo hakuna chaguo lililohifadhiwa. Theme color ya browser pia hufuata mode iliyochaguliwa.

## Mafaili muhimu yaliyobadilishwa

- `src/app/globals.css` — color tokens, typography, surface styles, Auth light override na AMOLED.
- `src/lib/theme.ts` — modes nne na helper ya kutekeleza mode.
- `src/components/layout/ThemeInitializer.tsx` — theme ya awali na kufuatilia OS kwa mode ya System.
- `src/components/layout/ThemeToggle.tsx` — selector ya modes nne.
- `src/components/layout/AppNavbar.tsx` — navigation ya simu yenye glass navy, active blue-purple gradient na labels.
- `src/app/layout.tsx` — dark-first document class, fonts za Inter na Plus Jakarta Sans, theme color.
- `src/app/page.tsx` na `src/app/(auth)/auth/page.tsx` — public/welcome/Auth theme support.
- Learning, opportunity, notification, profile na mentor components — accent colors za module (blue/purple/teal/orange).

## Kujaribu local

```bash
npm ci
npm run dev
```

Fungua landing page. Kwa mara ya kwanza theme inapaswa kuwa Dark. Tumia selector ya appearance iliyo juu ya landing/Auth au ndani ya nav/profile kubadilisha mode. Refresh ukurasa kuona kuwa chaguo linabaki. Chagua System, kisha badilisha Light/Dark preference ya kifaa kuthibitisha mabadiliko.

## Uhakiki

TypeScript/TSX syntax transpilation imepita kwenye mafaili yaliyobadilishwa, na CSS imekaguliwa kwa parser. Build kamili ya Next.js haikuthibitishwa katika mazingira haya kwa sababu `npm ci` ilikwama bila kukamilisha dependencies; tekeleza `npm ci` na `npm run build` kwenye mazingira yako kabla ya deployment.

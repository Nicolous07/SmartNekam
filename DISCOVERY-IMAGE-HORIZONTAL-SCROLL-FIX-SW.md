# SmartNekam — Marekebisho ya Gundua SmartNekam

## Kilichorekebishwa

- Kadi za `Gundua SmartNekam` sasa zina layering ya picha iliyo wazi (picha `z-0`, overlay `z-10`, maandishi `z-20`) ili background isifunike picha.
- Picha zinatumia assets za ndani ya `public/images` moja kwa moja kupitia `unoptimized`, na zinaposhindwa kupakia zinafanya fallback kwenda `/images/hero-desk.jpg`. Ikiwa fallback nayo haipatikani, gradient na icon ya kadi bado vinaonekana badala ya kadi tupu.
- Kadi nne za huduma zinapakia mapema kwa sababu idadi yake ni ndogo, ili kupunguza hali ya picha kuonekana tupu wakati wa kuanza kutembeza rail.
- Horizontal rail ina `flex-wrap: nowrap`, `overflow-x: auto`, `touch-action`, `overscroll-behavior-x`, scroll snap, na scrollbar ya kijani kwa simu/trackpad.
- Kuna maelekezo mafupi: “Telezesha kushoto au kulia kuona huduma zote”.

## Mafaili yaliyobadilishwa

- `src/components/posts/PostFeed.tsx`
- `src/components/posts/DiscoveryFeatureCard.tsx` (mpya)
- `src/app/globals.css`

Picha za kadi zinatumia files zilizopo kwenye `public/images/`: `reference-library.webp`, `reference-learn.webp`, `reference-home-feed.webp`, `reference-opportunities.webp`. Hakikisha folder `public/images` yote ipo kwenye deployment.

## Kuweka kwenye mradi wako

1. Hifadhi nakala ya mradi.
2. Kutoka kwenye ZIP, nakili/overwite mafaili hayo matatu kwenye paths zilizo juu.
3. Thibitisha kuwa `public/images/hero-desk.jpg` na picha nne za `reference-*.webp` zipo.
4. Ikiwa dev server ilikuwa wazi, simamisha kwa `Ctrl+C` na iwashe tena:

```bash
npm run dev
```

Hakuna SQL ya Supabase inayohitajika kwa marekebisho haya; ni frontend/CSS pekee.

## Ukaguzi uliofanywa

- Picha nne za discovery na picha ya fallback zilihakikiwa kuwa zipo kwenye `public/images`.
- TSX ya `PostFeed.tsx` na `DiscoveryFeatureCard.tsx` imepitishwa kwenye parser ya TypeScript.
- Build kamili ya Next.js haijatekelezwa hapa kwa sababu `node_modules` haipo kwenye nakala ya ukaguzi. Baada ya kuweka code, endesha `npm install` na `npm run build` kwenye kompyuta yako.

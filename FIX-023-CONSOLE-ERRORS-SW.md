# SmartNekam — Fix 023 (Kiswahili)

Fix hii inarekebisha makosa mawili ya runtime:

1. `Encountered a script tag while rendering React component` kwenye `src/app/layout.tsx`.
   - Imeondolewa script ya inline kwenye RootLayout.
   - `ThemeInitializer` inasoma `localStorage.theme` baada ya hydration na kuweka class ya dark/light.
   - Dark ndiyo default ya server; hakuna `<script>` wala `next/script` ndani ya RootLayout.
2. `ReferenceError: schools is not defined` kwenye `src/app/(app)/communities/page.tsx`.
   - Matokeo ya `schoolsRes` na `universitiesRes` sasa yanawekwa kwenye arrays salama, zikiwa tupu kama Supabase haijarejesha data.

## Kuweka kwenye project iliyopo

Nakili faili hizi kutoka ZIP na uzibadilishe kwa path hizo hizo:

- `src/app/layout.tsx`
- `src/app/(app)/communities/page.tsx`
- Ongeza `src/components/layout/ThemeInitializer.tsx`

Kisha simamisha server ya development (`Ctrl+C`) na uanze upya:

```bash
npm run dev
```

Kama Turbopack bado inaonyesha stack trace ya zamani, simamisha server, futa folder `.next`, kisha endesha `npm run dev` tena. Hii ni front-end fix; haihitaji SQL migration.

Ukaguzi wa transpile wa TypeScript/TSX umefanyika kwa faili 87 bila syntax errors. Build kamili ya Next.js bado haijathibitishwa kwenye environment hii.

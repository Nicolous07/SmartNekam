# SmartNekam v031 — Navigation na picha za kila ukurasa

## Kilichobadilika

- Navigation ya desktop iko juu ya ukurasa, ina icons tu, na sehemu iliyo active inainuka kwa duara lenye gradient ya blue-purple katika mtindo wa mfano uliotumwa.
- Navigation ya simu iko chini, ina Home, Library, Jamii, Learn na Fursa. Kitufe cha `+` kiko katikati ili kuendelea na kazi ya chapisho/kupakia nyenzo. Bar bado hujificha wakati mtumiaji anasogeza chini na huonekana tena anaposogeza juu.
- Home Feed ina picha kubwa ya wanafunzi na kadi zenye picha za Library, Learn, Jamii na Fursa. Kadi ya Admin huonekana kwa staff pekee kwa kutumia ukaguzi uliopo wa `isStaffUser`.
- Kurasa za Login, Library, Learn, Jamii, Fursa na Admin zina picha husika juu ya ukurasa. Overlay ya Midnight Scholar inaweka maandishi yasomeke juu ya picha.
- Picha zimeboreshwa kuwa WebP na kuwekwa chini ya `public/images/`.

## Picha zilizowekwa

| Ukurasa | Faili |
|---|---|
| Home Feed / Jamii | `public/images/reference-home-feed.webp` |
| Login | `public/images/reference-login.webp` |
| Fursa | `public/images/reference-opportunities.webp` |
| Learn | `public/images/reference-learn.webp` |
| Library | `public/images/reference-library.webp` |
| Admin Panel | `public/images/reference-admin.webp` |

Picha ya Fursa iliyotolewa ina watermark ya chanzo chake; kwa matumizi ya production, ibadilishe na picha uliyo na haki ya kutumia isiyo na watermark.

## Kuweka project

1. Pakua ZIP na ufungue folda `SmartNekam_App_Source`.
2. Kama tayari una project, linganisha na kuhamisha mafaili yaliyobadilishwa badala ya kufuta project yako yote.
3. Hakuna SQL mpya inayohitajika kwa mabadiliko haya ya UI.
4. Endesha `npm ci`, kisha `npm run dev`.
5. Kabla ya deployment, endesha `npm run build` kwenye mazingira yenye dependencies zilizowekwa.

## Mafaili yaliyobadilishwa

- `src/components/layout/AppNavbar.tsx`
- `src/app/globals.css`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/library/page.tsx`
- `src/app/(app)/learn/page.tsx`
- `src/app/(app)/communities/page.tsx`
- `src/app/(app)/opportunities/page.tsx`
- `src/app/(app)/admin/page.tsx`
- `src/app/(auth)/auth/page.tsx`

## Uthibitisho

Ukaguzi wa syntax ya TSX kwa TypeScript transpiler na parsing ya CSS umepita. Build kamili ya Next.js haijaendeshwa katika mazingira haya kwa sababu `node_modules` hazipo hapa.

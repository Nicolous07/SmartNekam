# SmartNekam — Upgrade 033: Kusoma nyenzo ndani ya app

## Maboresho yaliyowekwa
- Nyenzo zilizopo kwenye Library zina kitufe cha **Soma sasa**.
- Ukurasa wa nyenzo sasa una reader ndani ya SmartNekam badala ya kumlazimisha mwanafunzi ku-download kwanza.
- PDF hutumia PDF viewer ya kivinjari ndani ya ukurasa: ina native PDF toolbar ya kutafuta maandishi, kuchagua ukurasa, na zoom.
- Reader ina vidhibiti vya ukurasa/zoom, skrini nzima, na huhifadhi ukurasa wa mwisho kwenye kifaa hicho kwa `localStorage`.
- Picha (JPG/JPEG/PNG/WEBP/GIF) zinaonyeshwa ndani ya app na zina zoom.
- DOCX/PPTX/EPUB zina maelezo ya wazi kuwa reader ya aina hizo bado haijaunganishwa; kitufe cha `Pakua nyenzo` kipo kwa nyenzo zilizoidhinishwa.
- Faili bado zinakaa kwenye private Supabase Storage. Server Component hutengeneza signed URL ya dakika 15 tu kwa kutumia session/RLS ya mtumiaji aliyelogin.

## Files zilizoongezwa/kubadilishwa
- `src/components/library/SmartNekamResourceReader.tsx`
- `src/app/(app)/library/[id]/page.tsx`
- `src/app/(app)/library/page.tsx`

## Hakuna SQL mpya inayohitajika
Upgrade hii inatumia jedwali na bucket `learning-resources` zilizopo. Hakikisha SQL-002 na SQL-032 (au migrations zinazolingana na schema ya project yako) zimeendeshwa na bucket `learning-resources` ipo.

## Kujaribu
1. Kwenye terminal, ingia kwenye `SmartNekam_App_Source`.
2. Endesha `npm install` kama dependencies hazijawekwa.
3. Hakikisha `.env.local` ina `NEXT_PUBLIC_SUPABASE_URL` na `NEXT_PUBLIC_SUPABASE_ANON_KEY` sahihi.
4. Endesha `npm run dev`.
5. Ingia, fungua Library, chagua PDF ya status `approved`, kisha bonyeza `Soma sasa`.
6. Jaribu ukurasa, zoom, fullscreen, na kurudi kwenye ukurasa huo tena kwenye kifaa hicho.

## Mambo ya kuzingatia
- PDF inasomwa moja kwa moja kwa PDF viewer ya browser; toolbar yake hutofautiana kidogo kwa Chrome, Edge, Firefox, Safari na simu.
- Hali ya ukurasa huhifadhiwa kwenye browser ya kifaa hicho tu, si kwenye akaunti ya mwanafunzi. Reader haiwezi kupata page number ya mwisho kutoka kwenye PDF viewer ya browser, kwa hiyo inatumia namba ambayo mtumiaji amechagua kwenye toolbar ya SmartNekam.
- DOCX/PPTX/EPUB zinahitaji renderer/converter maalumu ikiwa zinapaswa kusomwa kikamilifu ndani ya app bila download.
- Signed URL ni ya muda mfupi. Ikiisha muda, rudisha/refresh ukurasa ili ipatikane nyingine.

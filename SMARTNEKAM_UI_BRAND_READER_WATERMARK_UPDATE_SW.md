# SmartNekam — UI, Logo, Smooth Reader & Download Watermark (v4)

Marekebisho ya toleo hili:

- Notification toast inaonekana sehemu ya juu ya skrini na hufunga baada ya sekunde 3.
- Kadi za `Gundua SmartNekam`, `SmartNekam People`, na `Campus & Study groups` zina horizontal scrolling na touch scrolling.
- Reader ya Library imerekebishwa kwa mobile viewport na touch scrolling.
- Nembo rasmi ya mtumiaji iko `public/images/smartnekam-logo.png`; toleo la alama ndogo liko `public/images/smartnekam-mark.png`. Nembo inatumika kwenye landing page, login/register, navbar, favicon, na PWA icon.
- Download button ya Library huweka nembo kama watermark kwenye kila ukurasa wa PDF, kwenye picha, kwenye header ya Word (DOCX), kwenye slides za PowerPoint (PPTX), na kwenye kurasa za EPUB. Uwekaji wa watermark hufanyika kwenye browser kabla faili halijahifadhiwa.

## Kuendesha mradi

1. Hifadhi `.env.local` yako ya sasa. Usibadilishe Supabase URL/anon key zako kwa thamani za mfano.
2. Fungua terminal kwenye folder `SmartNekam_App_Source`.
3. Endesha `npm install` ili kusakinisha dependencies mpya `pdf-lib` na `jszip` na kusawazisha `package-lock.json`. Npm registry haikupatikana wakati wa kutengeneza kifurushi hiki, hivyo install haikuweza kukamilishwa hapa. Tumia `npm install` kabla ya `npm run dev`; usitumie `npm ci` mpaka lockfile isasishwe.
4. Endesha `npm run dev` na fungua local URL ya Next.js.

## Jaribio la haraka

- Pokea notification mpya: inapaswa kuonekana juu na kuondoka baada ya sekunde 3.
- Kwenye Home Feed, telezesha kadi kwenda kushoto/kulia kwa kidole au trackpad.
- Fungua note au past paper kwenye simu; jaribu kupanua/punguza, na usogeze reader juu/chini.
- Pakua PDF, picha, DOCX, PPTX au EPUB kupitia kitufe `Pakua nyenzo`, kisha hakikisha watermark ya SmartNekam imeonekana kwenye faili.

## Mambo ya kujua

- PDF na office documents huchakatwa kwenye browser; kwa faili kubwa, watermark inaweza kuchukua muda na kutumia kumbukumbu ya kifaa.
- Ikiwa nyenzo imewekewa ulinzi wa nenosiri au imeharibika, download itatoa kosa badala ya kupakua nakala bila watermark.
- Push notification za mfumo wa kifaa ni tofauti na toast ya ndani ya app; VAPID/Edge Function/Database Webhook na ruhusa ya browser vinapaswa kuendelea kusanidiwa kama ilivyoelezwa kwenye `PUSH-NOTIFICATIONS-SETUP-SW.md`.

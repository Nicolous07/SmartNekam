# SmartNekam — Full Project Code & SQL (Kiswahili)

Kifurushi hiki kina source code kamili ya frontend, Supabase functions, faili za public assets, SQL schema/migrations, na marekebisho ya mentorship yaliyotayarishwa katika mazungumzo.

## Kuanzisha frontend

1. Sakinisha Node.js LTS.
2. Nakili `.env.example` kuwa `.env.local`.
3. Weka thamani zako halisi za `NEXT_PUBLIC_SUPABASE_URL` na `NEXT_PUBLIC_SUPABASE_ANON_KEY` ndani ya `.env.local`. Usitume `.env.local` hadharani.
4. Fungua terminal ndani ya `SmartNekam_App_Source` na endesha:

   ```bash
   npm install
   npm run dev
   ```

5. Fungua `http://localhost:3000`.
6. Kabla ya production, endesha `npm run build` na ujaribu login, Library download/watermark, Q&A, chat, Admin, na notifications.

`npm install` inapendekezwa kwa sababu baadhi ya dependencies za reader/watermark ni mpya. Usitumie `.env.example` kama credentials za production.

## SQL iko wapi?

- `sql/` — schema na SQL files za SmartNekam, zikiwa na namba za migrations.
- `supabase/migrations/` — Supabase migration files za updates za hivi karibuni, pamoja na 020, 032, 033 na 034.
- `sql/manual-fixes/` — marekebisho ya ziada ya mentor role na jina la mwombaji kwenye chat.
- `supabase/manual-sql/` — nakala za marekebisho hayo ili yawe rahisi kuyaona karibu na Supabase migrations.
- `SQL-034_smartnekam_focused_notifications_chat_media.sql` — migration ya notifications za aina zilizokubaliwa na chat media.
- `PUSH-NOTIFICATIONS-SETUP-SW.md` — maelekezo ya Edge Function, VAPID na Database Webhook.

## Muhimu kuhusu SQL

**Database mpya:** fuata `sql/README-SQL-SW.md` na tumia migrations kwa mpangilio wa namba, ukiingiza pia SQL 020 kutoka `supabase/migrations/020...` na SQL 034 kutoka `supabase/migrations/034...`.

**Database iliyopo tayari:** usi-run migrations zote tena bila kuangalia ni zipi tayari zimeendeshwa. Tumia migration inayokosekana tu baada ya kuthibitisha hali ya Supabase yako.

SQL za `sql/manual-fixes/` ni patches za ziada:
- `SMARTNEKAM_FIX_MENTOR_ASSIGNMENT.sql`: Admin akimpa mtu role `mentor`, huunda/kuwasha mentor card ili aonekane kwenye directory.
- `SMARTNEKAM_FIX_MENTOR_CHAT_APPLICANT_NAME.sql`: hurekebisha chat inbox ili mentor aone jina la mwombaji wa mentorship.

Usi-run patch ikiwa marekebisho hayo tayari yamewekwa au kama schema yako imetofautiana bila kuikagua kwanza.

## Push notification za simu/PC

Push notifications zinahitaji: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` kwenye `.env.local`, VAPID private key na webhook secret kama Supabase Function secrets, Edge Function `smartnekam-push`, Database Webhook ya `public.notifications` (INSERT), na ruhusa ya browser kutoka kwa kila mtumiaji. **Usihifadhi VAPID private key ndani ya frontend, `.env.example`, wala Git repository.** Angalia `PUSH-NOTIFICATIONS-SETUP-SW.md`.

## Vipengele vya toleo hili

- Nembo rasmi ya SmartNekam kwenye UI/assets.
- Toast notifications juu ya skrini zinazofungwa baada ya sekunde 3.
- Home Feed cards zenye horizontal scrolling.
- Resource reader na watermark wakati wa kupakua nyenzo zinazoungwa mkono.
- Push notifications / in-app notifications na Admin targeting SQL.
- Q&A, chat attachments, mentorship, communities na Library.

## Ukaguzi

Kifurushi kina source code na migrations, lakini build ya Next.js inapaswa kuendeshwa kwenye kompyuta yako baada ya `npm install`. Hakikisha unajaribu migrations kwenye test Supabase project/backup kabla ya production.

# SmartNekam

**Kauli mbiu:** Soma, Ungana, Pata Fursa.

Mradi huu unaendelezwa kulingana na `PRD-IMPLEMENTATION-SW.md`, huku ukihifadhi muonekano wa SmartNekam wa kijani/nyeusi/nyeupe, cards, picha, animations na navigation ya awali.

## Stack

- Next.js App Router + React + TypeScript
- Supabase Auth, Database, Storage na RLS

## Kuanza

**Njia ya Windows:** bonyeza mara mbili `START-SMARTNEKAM.cmd`. Mara ya kwanza itaunda `.env.local`; jaza Supabase URL na anon key, kisha endesha script tena.

**Njia ya terminal:**

1. Nakili `.env.example` kuwa `.env.local`.
2. Jaza `NEXT_PUBLIC_SUPABASE_URL` na `NEXT_PUBLIC_SUPABASE_ANON_KEY` kutoka Supabase project yako. Usiweke service-role/secret key kwenye browser.
3. Supabase SQL Editor: endesha `sql/smartnekam_prd_core_modules.sql` kwa Daily Challenge, Study Planner, Flashcards na in-app notifications.
4. Washa SMS provider ya Supabase Auth ikiwa unataka kutumia login ya simu + OTP.
5. Kwenye terminal iliyofunguliwa ndani ya folda hii, endesha:

```bash
npm ci
npm run dev
```

Fungua http://localhost:3000.

## Sehemu za app

- Home/dashboard, Learn/courses, Library & Document Vault
- Daily Challenge, Study Planner, Flashcards na Taarifa
- Community, study groups, Q&A na AMA
- Scholarships, internships, admissions na application tracker
- Profile, EduPoints/Wallet na Admin Panel

Mahitaji yote ya bidhaa yaliyotumwa yamehifadhiwa kwenye `docs/SMARTNEKAM-PRD.md`; maelezo ya mabadiliko na mipaka ya integrations yapo `PRD-IMPLEMENTATION-SW.md`.

## Mabadiliko mapya — SQL 018
Angalia `UPGRADE-018-SETUP-SW.md` kwa maelekezo ya attachments, peer mentorship, crop ya picha na usafishaji wa components za zamani zisizotumika. Endesha SQL 018 baada ya migrations za 006, 013, 016 na 017 kufanikiwa.


## Mabadiliko mapya — SQL 019
Angalia `UPGRADE-019-SETUP-SW.md` kwa kurekebisha ruhusa za mipangilio ya profile na usajili wa shule/chuo. Ikiwa SQL 017 na SQL 018 tayari zimefanikiwa, endesha SQL 019 pekee.


## Marekebisho ya mwisho: SQL 020

Kama kuunda Chat Groups kupitia Chats kunashindwa baada ya SQL 017, endesha `020_smartnekam_chat_group_creation_repair.sql` kwenye Supabase SQL Editor. UI sasa inaonyesha kosa halisi la Supabase. Kwa simu, swipe kushoto/kulia hubadilisha Home, Learn, Jamii, Fursa, Maktaba na Profile.

## Recent upgrade: SQL 021

See `UPGRADE-021-SETUP-SW.md` for the group creation ambiguity fix, group member invites, and post follow feature. If SQL 001–020 already ran successfully, apply only `021_smartnekam_group_members_follow_navigation.sql`.

## Tanzania institution directory

Run SQL 023 after SQL 022, then follow `UPGRADE-023-TANZANIA-INSTITUTIONS-SW.md`. The local `npm run institutions:sync` script pulls public official directories, deduplicates them and upserts schools and tertiary institutions to Supabase. It requires a local `SUPABASE_SERVICE_ROLE_KEY`; never expose that key in client code or commit it.

## Notifications mpya — SQL 033

Tumia `PUSH-NOTIFICATIONS-SETUP-SW.md` kwa hatua za notifications za ndani ya app na push za simu/PC. SQL 037 (`sql/037_smartnekam_incoming_call_notifications.sql`) inaunganisha incoming-call offers na notification za app/kifaa baada ya SQL 033 na 036. Endesha `sql/033_smartnekam_push_and_message_notifications.sql` baada ya SQL 003, 006 na 007. Kwa push hata browser/tab ikiwa imefungwa, deploy `supabase/functions/smartnekam-push`, weka VAPID secrets, na unda Database Webhook ya `public.notifications` INSERT. Watumiaji pia wanapaswa kuwasha push kupitia ukurasa wa **Taarifa**.

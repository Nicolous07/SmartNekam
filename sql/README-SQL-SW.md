# SmartNekam — SQL migrations (Kiswahili)

Migrations 001A–014 zinaendana na schema mpya ya SmartNekam iliyojengwa katika Supabase. SQL 015 ni patch ndogo ya ziada kwa moderator queue na kuingia study group kwa invite code.

## Hali ya utekelezaji
- Tayari ziliripotiwa kufanikiwa kwenye Supabase: 001A, 001B, 002–014.
- SQL 015 bado ihakikiwe/itekelezwe ikiwa moderation dashboard inapaswa kuona notes/past papers zilizo `pending`, na invite-link joining inahitajika.

## Muhimu
- Usikimbize migrations 001A–014 tena bila sababu; zinaweza kutegemea hali halisi ya database yako.
- SQL 004 ni toleo lililorekebishwa la Quizzes/Gamification.
- SQL 014 ni toleo lililorekebishwa la Global Search.
- SQL 015 haifungui `payment_provider_events` kwa watumiaji wa kawaida.
- Kabla ya production, kagua sera za RLS kwa roles tofauti na fanya tests za read/write. Mafanikio ya migration si uthibitisho wa mwisho wa usalama wa kila workflow.


## Migrations 016–019
- SQL 016: Social Feed na Direct Messages.
- SQL 017: Username ya kipekee, profile picha/cover na controls za chat.
- SQL 018: Post attachments na peer mentorship.
- SQL 019: Ruhusa za `user_app_preferences` / `user_privacy_settings` na kuchukua shule/chuo wakati wa usajili.
- Ikiwa SQL 017 na 018 tayari zimefanikiwa, endesha SQL 019 pekee kwa marekebisho haya. Usirudie migrations za zamani.


## Migration 028 — Admin Panel operations
- SQL 028: policies za admin kusoma foleni kamili za moderation, RPC salama za study groups/Q&A, revoke certificates, kuongeza institutions, kuunda opportunities kwa foleni ya review, school announcements, na audit triggers za mabadiliko muhimu.
- Endesha SQL 028 baada ya migrations 003, 005, 006, 007, 010, 011, 013 na SQL-027 admin role bootstrap kuwa tayari.
- Baada ya kuendesha, jaribu kwanza kwenye records za majaribio. Data export/deletion, SMS/email/push na payment refunds bado zinahitaji trusted/provider backend.

## Migration 035 — Smart Chat Voice Call
- SQL 035 inaweka RLS ya Supabase Realtime kwa signaling ya private audio calls.
- Endesha SQL 035 baada ya 006, 016, 017 na 034.
- Simu za sauti hutumia WebRTC; hakuna sauti inayohifadhiwa kwenye database. Browser zote mbili zinahitaji ruhusa ya microphone na kufungua conversation ileile.


## Migration 037 — Incoming Call Notifications
- SQL 037: kila offer mpya ya simu huunda notification ya `call`, hivyo mfumo uliopo unaweza kuonyesha toast ya ndani na kutuma browser push kupitia webhook ya `notifications`.
- Endesha SQL 037 baada ya SQL 033 na 036. Haihitaji kubadilisha `realtime.messages`.
- Kwa push ya kifaa, webhook ya `public.notifications` INSERT, VAPID secrets, Edge Function na ruhusa ya kifaa lazima viwe vimesanidiwa.


## Migration 040 — Chat Group Management
- SQL 040: controls za creator/admin/member kwenye Chat Groups: send-messages policy, edit-group-info policy, approve-new-members, ruhusa ya kuongeza wanachama, role ya admins, kuondoa wanachama, kufuta group, kufuta ujumbe kwa wote, reset invite code na disappearing messages.
- Endesha SQL 040 baada ya SQL 006, 017 na 020/021. Haitabadilisha `realtime.messages`; hutumia jedwali la SmartNekam pekee.
- Kabla ya production, jaribu kwa creator, admin wa ziada na member wa kawaida kwenye database ya staging.

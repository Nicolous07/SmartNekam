# SmartNekam — PRD implementation update

Toleo hili linaendeleza muonekano wa awali wa SmartNekam: kijani/nyeusi/nyeupe, geometric cards, picha za app, animations, navbar na Admin Panel. Mabadiliko yanaongeza mtiririko wa kazi wa PRD bila kubadili utambulisho wa UI.

## Modules zilizounganishwa

- Home dashboard: greeting, EduPoints, mijadala, AMA, fursa na njia za haraka za Daily Challenge, planner, flashcards na taarifa.
- Learn: courses zilizokuwepo, Code Playground, Daily Challenge, Study Planner, Flashcards na njia ya Notes/Past Papers.
- Daily Challenge: maswali 5, timer ya dakika 5, maelezo ya majibu na pointi kupitia Supabase RPC.
- Study Planner: kuongeza, kukamilisha na kufuta kazi; data huhifadhiwa kwa user aliyeingia.
- Flashcards: decks, kutengeneza/kugeuza/kufuta kadi na kuhifadhi kupitia Supabase.
- Taarifa: in-app notifications, kusoma taarifa na kiungo cha kwenda kwenye sehemu husika.
- Create (+): menu ya haraka ya post, notes/past papers, study groups, Q&A, flashcards, planner, events na competitions.
- Authentication: email/password na Google zilizokuwepo; pia imeongezwa chaguo la simu + OTP kupitia Supabase Auth.
- Modules zilizokuwepo zinaendelea: Library/Vault, Communities/Q&A/AMA, Opportunities/Admissions, Profile/Wallet, Admin na certificates.

## Muhimu kabla ya kutumia modules mpya

1. Fungua Supabase SQL Editor.
2. Endesha `sql/smartnekam_prd_core_modules.sql` kwenye project yako.
3. Hakikisha `profiles.edupoints_balance` ipo (inahitajika kwenye schema iliyopo ya SmartNekam).
4. Ili kutumia simu + OTP, washa Phone/SMS provider na uweke mipangilio ya SMS kwenye Supabase Auth. Email login haitegemei SMS provider.
5. Tengeneza `.env.local` kutoka `.env.example`, ukitumia credentials za project yako; usiwahi kuweka secret/service-role key upande wa browser.

## Kuendesha

Kwenye Windows, unaweza kubonyeza mara mbili `START-SMARTNEKAM.cmd` ndani ya folda hii. Kwa terminal, hakikisha kwanza uko ndani ya folda yenye `package.json`.

```cmd
npm install
npm run dev
```

Fungua `http://localhost:3000`.

## Upeo na vitu vinavyohitaji huduma ya ziada

- Daily Challenge ina question bank ya kuanzia iliyo ndani ya source; timu inaweza kubadilisha/kuongeza maswali kutoka NECTA na mitaala mingine.
- Pointi huongezwa na database function ili mtumiaji asiweze kujipatia pointi kwa kubadilisha browser code.
- Notifications ni in-app. Push notifications zinahitaji Firebase Cloud Messaging na usanidi wake.
- Scholarship/opportunity verification inahitaji moderator na vyanzo rasmi; usionyeshe opportunity kama verified bila ukaguzi.
- Payments/M-Pesa, live classes, OTP delivery, na Google OAuth hutegemea credentials/settings za huduma husika.
- UI/Syntax imekaguliwa kwa mafaili yaliyobadilishwa; build kamili inapaswa kuendeshwa kwenye kompyuta yenye internet na dependencies zilizosakinishwa.

# SmartNekam — Full Core App (Kiswahili)

Hii ni source code ya mradi mzima wa SmartNekam (Next.js App Router, React na Supabase). Faili za siri za mazingira hazijawekwa; tumia `.env.example` kuunda `.env.local` yako mwenyewe.

## 1. Mahitaji
- Node.js LTS inayokubaliana na Next.js 16
- npm
- Mradi wa Supabase na URL/key sahihi
- Intaneti kwa mara ya kwanza ili npm ipakue dependencies

## 2. Sanidi mazingira

1. Nakili `.env.example` kuwa `.env.local`.
2. Weka `NEXT_PUBLIC_SUPABASE_URL` na `NEXT_PUBLIC_SUPABASE_ANON_KEY` zako halisi.
3. Usihifadhi `service_role`/secret key kwenye variables za `NEXT_PUBLIC_` wala ndani ya browser.

## 3. Sakinisha dependencies

```bash
npm ci
npm run dev
```

`npm ci` husakinisha dependencies kulingana na lockfile. Kama usakinishaji umeshindwa kwa sababu ya mtandao, rekebisha muunganisho kisha irudie.

Fungua `http://localhost:3000`.

## 4. Build ya production

```bash
npm ci
npm run build
npm start
```

## 5. Kumbuka
- SQL files ndani ya archive ni nyaraka/scripts za setup; zikague na ulinganishe na schema ya Supabase yako kabla ya kuziendesha.
- `node_modules` na `.next` hazipo kwenye ZIP. `.env.local` inaweza kuwa na Supabase URL na publishable/anon key pekee; usiweke service-role/secret key humo.
- Build kamili haijahakikishwa hapa kwa sababu mazingira ya kutengeneza package hayana uhakika wa kufikia npm registry. Ukipata error mpya, tuma error nzima pamoja na amri iliyotoa.

## PRD Core Upgrade (ongeza ya 15 Oktoba 2026)

Toleo hili linaongeza Daily Challenge, Study Planner, Flashcards, Taarifa na quick-create menu kwenye `+`, na chaguo la phone OTP kwenye login. Kabla ya kutumia module mpya, endesha `sql/smartnekam_prd_core_modules.sql` kwenye Supabase. Maelezo: `PRD-IMPLEMENTATION-SW.md`.

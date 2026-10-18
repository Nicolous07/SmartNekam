# SmartNekam — Core Project

SmartNekam ni app ya elimu iliyojengwa kwa Next.js, React, TypeScript na Supabase. Toleo hili limeondoa majaribio ya NekamAI ambayo hayakuwa yameunganishwa na app kuu na limeondoa nakala za project zilizojirudia.

## Kuendesha kwenye kompyuta

1. Nakili `.env.example` na uitengeneze kama `.env.local` kwenye folder kuu lenye `package.json`.
2. Weka `NEXT_PUBLIC_SUPABASE_URL` na `NEXT_PUBLIC_SUPABASE_ANON_KEY` za project yako. Usitumie `service_role` au secret key kwenye variables zinazoanza na `NEXT_PUBLIC_`.
3. Fungua terminal kwenye folder kuu na endesha:

```bash
npm ci
npm run dev
```

4. Fungua `http://localhost:3000`.

## Build kabla ya GitHub/Vercel

```bash
npm run build
```

`.env.local` haipaswi kupakiwa GitHub. `.env.example` ni template tu. Weka environment variables halisi kwenye Vercel baada ya kuunganisha GitHub.

## Muundo muhimu

- `src/` — app kuu ya Next.js.
- `public/` — picha, nembo, manifest na service worker ya PWA.
- `supabase/migrations/` — mabadiliko ya database yanayohifadhiwa kwa marejeo na mazingira mapya.
- `supabase/sql/` na `supabase/manual-sql/` — scripts za database na marekebisho ya ziada.
- `supabase/functions/` — Supabase Edge Functions, ikiwemo push notifications.
- `sql/` — nakala ya SQL za awali zinazotunzwa kwa ajili ya marejeo.

SQL zilizokwishaendeshwa hazitaendeshwa tena kwa kuwepo tu kwenye GitHub. Usifute au kurudia kuendesha migrations kwenye database hai bila kuhakiki hali ya database kwanza.

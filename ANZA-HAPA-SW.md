# SmartNekam — jinsi ya kuendesha app

Hii ni source code ya mradi wa SmartNekam (Next.js + React + Supabase). Faili `.env.local` lina URL na publishable/anon key ya upande wa browser. Usiongeze service-role/secret key kwenye faili hili.

## 1. Mahitaji
- Node.js inayotumia toleo la Next.js lililowekwa kwenye `package.json`.
- Akaunti/projekti ya Supabase.

## 2. Kuweka mazingira
1. Badili jina la `.env.example` kuwa `.env.local`.
2. Weka `NEXT_PUBLIC_SUPABASE_URL` na `NEXT_PUBLIC_SUPABASE_ANON_KEY` za Supabase yako.
3. Weka `NEXT_PUBLIC_SITE_URL=http://localhost:3000` unapojaribu kwenye kompyuta yako.
4. Usishiriki faili `.env.local` hadharani.

## 3. Kuendesha
Fungua terminal kwenye folda ya mradi kisha endesha:

```bash
npm install
npm run dev
```

Fungua `http://localhost:3000` kwenye browser.

## 4. Database
Mradi una faili za SQL na maelekezo ya Supabase. Soma kwanza `README.md`, `SQL-EDITOR-HOW-TO-RUN-SW.md`, na nyaraka husika kabla ya kuendesha SQL. Tengeneza backup ya database kabla ya mabadiliko.

## 5. Muhimu
- ZIP hii ina source code; haina `.env.local`, `node_modules`, wala credentials za Supabase.
- Build ya `npm run build` haijathibitishwa kwenye mazingira haya kwa kuwa dependencies hazikuwekwa.
- Features zinazotegemea Supabase haziwezi kufanya kazi mpaka URL, key, na schema inayolingana viwekwe.

## Picha za UI

- `public/images/admin-panel-banner.jpg` hutumika kama picha ya nyuma kwenye hero ya Admin Control Panel.
- NekamAI ya majaribio na assets zake zimeondolewa kwa sasa kwa sababu hazikuwa zimeunganishwa na app inayotumika.

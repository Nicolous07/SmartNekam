# SmartNekam — Kuingiza shule, high schools, colleges na universities za Tanzania

## Vitu vilivyoandaliwa

- SQL 023 inaongeza `source_code`, chanzo, tarehe ya uhakiki na aliases kwenye `schools`/`universities`, pamoja na RPC ya kutafuta taasisi kwa jina, msimbo au alias.
- SQL 023 pia huunda Official Community kwa kila shule/chuo kilichopo na kwa kila taasisi inayoingizwa baadaye; inaongeza RPC salama ya kujiunga kama mwanafunzi wa taasisi au visitor.
- `scripts/sync-tanzania-institutions.mjs` hukusanya rekodi kutoka NECTA CSEE 2025 na ACSEE 2025, rejista ya NACTVET na orodha ya TCU, huunganisha marudio, na kuziingiza Supabase kwa batches.
- Usajili na onboarding sasa hutafuta taasisi kwa jina badala ya kupakua taasisi 1,000 tu.
- Directory ya Jamii ina pagination na ukurasa wa taasisi wenye kitufe cha kujiunga na Official Community.
- Jamii → Shule na Vyuo Rasmi inatumia utafutaji na kurasa za matokeo badala ya kuonyesha taasisi 300 pekee.
- Importer haitafuta rekodi zilizopo. Ikitambua rekodi ya zamani yenye jina la kipekee na haina `source_code`, itajaribu kuiunganisha kwa ID ileile ili isivunje profiles zinazoi-refer.

## Hatua za kuweka

1. Hifadhi backup ya Supabase.
2. Hakikisha SQL 022 ilifanikiwa. Kwenye Supabase Dashboard → SQL Editor, endesha `SQL-023_smartnekam_tanzania_institution_registry.sql` yote.
3. Fungua `.env.local` kwenye kompyuta yako ya maendeleo na ongeza **key ya siri ya server** uliyopata Supabase → Project Settings → API Keys:

   ```env
   SUPABASE_SERVICE_ROLE_KEY=WEKA_KEY_YAKO_YA_SIRI_HAPA
   ```

   Usiiweke kwenye `NEXT_PUBLIC_*`, usiweke kwenye Git, na usinitumie key hiyo. `.env.local` tayari imewekwa kwenye `.gitignore`.

4. Kagua data itakayopatikana bila kuandika chochote kwenye database:

   ```bash
   npm run institutions:sync -- --dry-run
   ```

   Angalia `data/tanzania-institutions-preview.json`, `counts` na `notes` kwa source/page ambazo hazikupatikana. Kama source fulani imekosa data, usiendelee mpaka sababu ikaguliwe.

5. Ingiza/refresh katalogi:

   ```bash
   npm run institutions:sync
   ```

   Ripoti ya mwisho itakuwa `data/tanzania-institutions-sync-report.json`.

6. Restart app:

   ```bash
   npm run dev
   ```

## Vyanzo na mipaka ya data

- NECTA CSEE 2025 na ACSEE 2025: shule zilizoonekana kwenye indexes za mitihani ya CSEE/ACSEE.
- NACTVET: taasisi zilizo kwenye directory ya registered/accredited institutions.
- TCU: taasisi zilizoorodheshwa na Tanzania Commission for Universities.

Huu ni mkusanyiko wa rejista rasmi za umma, si ahadi kwamba kila shule iliyosajiliwa lakini haijawahi kuwa kwenye CSEE/ACSEE imejumuishwa. Wizara ya Elimu huchapisha takwimu za jumla za taasisi, lakini orodha moja ya umma inayopakuliwa yenye majina ya kila sekondari haikupatikana wakati wa maandalizi. Angalia ripoti baada ya sync na linganisha na rejista rasmi zinazosasishwa. Script haitoi majina ya kubuni na haitafuta taasisi zilizopo.

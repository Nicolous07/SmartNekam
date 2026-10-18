# SmartNekam — Admin button kwa akaunti maalum

Mabadiliko haya yanafanya icon ya **Admin Panel** ionekane kwenye navigation baada tu ya mtumiaji kuingia, na ni akaunti iliyoruhusiwa ndiyo itakayoiona. Kwenye simu itapatikana kwenye menyu ya `…`; kwenye desktop ni icon ya ngao kwenye navigation ya juu.

## Hatua za kuwezesha akaunti ya admin

1. Kwanza hakikisha akaunti `nicolousmunisi07@gmail.com` ipo kwenye **Supabase → Authentication → Users**. Usitume au kuhifadhi password ndani ya source code.
2. Kwenye `.env.local`, ongeza:

   ```env
   SMARTNEKAM_ADMIN_EMAILS=nicolousmunisi07@gmail.com
   ```

   Hii ni variable ya server; usiipe jina lenye `NEXT_PUBLIC_`. Anzisha upya Next.js baada ya kubadilisha `.env.local`.
3. Fungua **Supabase → SQL Editor**, bandika maudhui ya `SQL-027_smartnekam_admin_account_bootstrap.sql`, kisha Run. Hii inaweka `profiles.role = 'super_admin'` kwa akaunti hiyo tu. Iendeshe baada ya akaunti kuundwa.
4. Toka kwenye app kisha ingia tena kwa akaunti ya admin. Icon ya Admin Panel itatokea. Fungua `/admin` moja kwa moja pia ujaribu.

## Usalama

- Button inafichwa kwa akaunti nyingine; route ya `/admin` na `/admin/[module]` pia zinakagua ruhusa upande wa server.
- Ruhusa za kusoma/kubadilisha data bado zinategemea RLS/policies za Supabase. Usizime RLS ili kurekebisha error ya ruhusa.
- Kwa kuwa password iliandikwa kwenye mazungumzo, badilisha password hiyo ndani ya Supabase Auth kabla ya kutumia akaunti kama Super Admin kwenye production. Usiweke password kwenye `.env`, SQL au code.

## Mahali pa mafaili

- `src/lib/admin.ts` — ukaguzi wa ruhusa na email allowlist.
- `src/components/layout/AppNavbar.tsx` — icon ya desktop na link ya menu ya simu.
- `src/app/(app)/admin/[module]/page.tsx` — ulinzi wa route ya module.
- `SQL-027_smartnekam_admin_account_bootstrap.sql` — kuweka role ya akaunti kwenye Supabase.

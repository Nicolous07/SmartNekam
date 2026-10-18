# SmartNekam — Kutafuta shule/chuo wakati wa kujisajili

## Mabadiliko
- Kisanduku cha shule/chuo hutafuta moja kwa moja kwenye Supabase baada ya mtumiaji kuandika.
- Matokeo yanachujwa kwa nchi na kiwango cha elimu; huonyeshwa hadi matokeo 40 kwa ombi moja.
- UDSM/Ilboru na taasisi zilizoongezwa kwenye directory zinaweza kupatikana kwa sehemu ya jina.
- Fomu bado inahitaji mtumiaji kuchagua rekodi ya taasisi iliyopo, ili akaunti iunganishwe na taasisi halisi ya database.

## Hatua ya lazima ya Supabase
1. Fungua Supabase Dashboard ya SmartNekam.
2. Fungua **SQL Editor**.
3. Nakili na endesha `SMARTNEKAM-INSTITUTION-DIRECTORY.sql`.
4. Jaribu kwenye fomu: `Malampaka`, `Maswa Girls`, `Bariadi`, `Ilboru`, `UDSM`, `University of Dodoma`, `Mzumbe`, `Azania`, au `Tabora Boys`.

SQL hii ina vyuo vikuu na university colleges kutoka orodha ya TCU (26 Machi 2026) pamoja na orodha ya kuanzia ya shule za sekondari, ikianza na Malampaka Secondary School na shule nyingine za Simiyu. Si orodha kamili ya kila shule nchini; taasisi ambazo bado hazijaingizwa zinahitaji kuongezwa na msimamizi kwenye `public.institutions` kwa columns `name`, `city`, `country_code='TZ'`, na `type` (`secondary` au `university`; kwenye database ni enum `institution_type`).

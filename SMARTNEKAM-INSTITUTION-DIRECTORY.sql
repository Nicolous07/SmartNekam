-- SmartNekam: one-block SQL to avoid running partial UPDATE/CTE fragments separately.
-- SmartNekam: panua orodha ya shule/vyuo inayotumika wakati wa kujisajili.
-- Chanzo cha vyuo vikuu/vyuo washirika: TCU, "University Institutions Approved to operate in Tanzania as of March 26, 2026".
-- Shule za sekondari hapa ni orodha ya kuanzia; si orodha kamili ya shule zote Tanzania.
-- Inaingiza columns zinazohitajika na schema: name, slug, city, country_code, type.
-- Endesha kwenye Supabase SQL Editor. Taarifa za Ilboru na UDSM zilizokuwepo
-- zinaboreshwa kuwa majina yanayoweza kutafutwa kwa jina kamili au kifupisho.

DO $smartnekam$
BEGIN
update public.institutions
set name = 'Ilboru Secondary School', city = coalesce(city, 'Arusha')
where country_code = 'TZ' and type = 'secondary' and lower(trim(name)) like '%ilboru%';

update public.institutions
set name = 'University of Dar es Salaam (UDSM)', city = coalesce(city, 'Dar es Salaam')
where country_code = 'TZ' and type = 'university'
  and (upper(trim(name)) = 'UDSM' or lower(trim(name)) like '%university of dar es salaam%');

update public.institutions
set name = 'Malampaka Secondary School',
    city = coalesce(nullif(trim(city), ''), 'Maswa')
where country_code = 'TZ'
  and type = 'secondary'
  and lower(trim(name)) in (
    'malampaka sec', 'malampaka sec.', 'malampaka ss',
    'malampaka secondary', 'malampaka secondary school'
  );

with seed(name, city, type) as (
  values
  -- Vyuo vikuu vya umma vilivyo kwenye TCU
  ('University of Dar es Salaam (UDSM)', 'Dar es Salaam', 'university'),
  ('Sokoine University of Agriculture (SUA)', 'Morogoro', 'university'),
  ('Open University of Tanzania (OUT)', 'Dar es Salaam', 'university'),
  ('State University of Zanzibar (SUZA)', 'Zanzibar', 'university'),
  ('Mzumbe University (MU)', 'Morogoro', 'university'),
  ('Nelson Mandela African Institution of Science and Technology (NM-AIST)', 'Arusha', 'university'),
  ('Muhimbili University of Health and Allied Sciences (MUHAS)', 'Dar es Salaam', 'university'),
  ('Ardhi University (ARU)', 'Dar es Salaam', 'university'),
  ('University of Dodoma (UDOM)', 'Dodoma', 'university'),
  ('Mbeya University of Science and Technology (MUST)', 'Mbeya', 'university'),
  ('Moshi Cooperative University (MoCU)', 'Moshi', 'university'),
  ('Mwalimu Nyerere University of Agriculture and Technology (MNUAT)', 'Musoma', 'university'),
  -- Vyuo vikuu binafsi vilivyo kwenye orodha ya TCU
  ('Kairuki University (KU)', 'Dar es Salaam', 'university'),
  ('Abdulrahman Al-Sumait University (SUMAIT)', 'Zanzibar', 'university'),
  ('St. Augustine University of Tanzania (SAUT)', 'Mwanza', 'university'),
  ('Zanzibar University (ZU)', 'Zanzibar', 'university'),
  ('Tumaini University Makumira (TUMA)', 'Arusha', 'university'),
  ('Aga Khan University (AKU)', 'Dar es Salaam', 'university'),
  ('Catholic University of Health and Allied Sciences (CUHAS)', 'Mwanza', 'university'),
  ('University of Arusha (UoA)', 'Arusha', 'university'),
  ('St. Joseph University in Tanzania (SJUIT)', 'Dar es Salaam', 'university'),
  ('Teofilo Kisanji University (TEKU)', 'Mbeya', 'university'),
  ('Mwenge Catholic University (MWECAU)', 'Moshi', 'university'),
  ('Muslim University of Morogoro (MUM)', 'Morogoro', 'university'),
  ('University of Iringa (UoI)', 'Iringa', 'university'),
  ('St. John''s University of Tanzania (SJUT)', 'Dodoma', 'university'),
  ('Kampala International University in Tanzania (KIUT)', 'Dar es Salaam', 'university'),
  ('United African University of Tanzania (UAUT)', 'Dar es Salaam', 'university'),
  ('Ruaha Catholic University (RUCU)', 'Iringa', 'university'),
  ('Mwanza University (MzU)', 'Mwanza', 'university'),
  ('Catholic University of Mbeya (CUoM)', 'Mbeya', 'university'),
  ('Dar es Salaam Tumaini University (DarTU)', 'Dar es Salaam', 'university'),
  ('Rabininsia University (RU)', 'Dar es Salaam', 'university'),
  ('University of Medical Sciences and Technology (UMST)', 'Dar es Salaam', 'university'),
  ('Hikmah University of East Africa (HUEA)', 'Dar es Salaam', 'university'),
  ('KCMC University', 'Moshi', 'university'),
  -- University colleges na affiliated campuses vilivyo kwenye orodha ya TCU
  ('Dar es Salaam University College of Education (DUCE)', 'Dar es Salaam', 'university'),
  ('Mkwawa University College of Education (MUCE)', 'Iringa', 'university'),
  ('Mzumbe University - Dar es Salaam Campus College', 'Dar es Salaam', 'university'),
  ('Mzumbe University - Mbeya Campus College', 'Mbeya', 'university'),
  ('Mbeya College of Health and Allied Sciences (MCHAS)', 'Mbeya', 'university'),
  ('Mbeya University of Science and Technology - Rukwa Campus College (MUST-RC)', 'Rukwa', 'university'),
  ('Sokoine University of Agriculture - Mizengo Pinda Campus College (SUA-MPC)', 'Katavi', 'university'),
  ('Mbeya University of Science and Technology - Mtwara Campus College (MUST-MCCTE)', 'Mtwara', 'university'),
  ('Stefano Moshi Memorial University College (SMMUCo)', 'Moshi', 'university'),
  ('Archbishop Mihayo University College of Tabora (AMUCTA)', 'Tabora', 'university'),
  ('Jordan University College (JUCo)', 'Morogoro', 'university'),
  ('St. Francis University College of Health and Allied Sciences (SFUCHAS)', 'Morogoro', 'university'),
  ('Stella Maris Mtwara University College (STeMMUCo)', 'Mtwara', 'university'),
  ('Marian University College (MARUCo)', 'Bagamoyo', 'university'),
  ('St. Joseph University College of Health and Allied Sciences (SJCHAS)', 'Dar es Salaam', 'university'),
  ('Mwenge Catholic University - Hedaru Campus College (MWECAU-HCC)', 'Hedaru', 'university'),
  ('Institute of Marine Sciences (IMS)', 'Zanzibar', 'university'),
  ('Kizumbi Institute of Cooperative Business Education (KICoB)', 'Shinyanga', 'university'),
  -- Shule za sekondari za kuanzia; majina yanaweza kutafutwa kwa sehemu ya jina
  -- Shule za sekondari za Simiyu; Malampaka ndiyo ya kwanza kwa ombi hili
  ('Malampaka Secondary School', 'Maswa', 'secondary'),
  ('Maswa Girls Secondary School', 'Maswa', 'secondary'),
  ('Binza Secondary School', 'Maswa', 'secondary'),
  ('Nassa Secondary School', 'Busega', 'secondary'),
  ('Mwandoya Secondary School', 'Meatu', 'secondary'),
  ('Nyasosi Secondary School', 'Bariadi', 'secondary'),
  ('Nkololo Secondary School', 'Bariadi', 'secondary'),
  ('Bariadi Secondary School', 'Bariadi', 'secondary'),
  ('Ilboru Secondary School', 'Arusha', 'secondary'),
  ('Arusha Secondary School', 'Arusha', 'secondary'),
  ('Arusha School', 'Arusha', 'secondary'),
  ('Arusha Catholic Seminary', 'Arusha', 'secondary'),
  ('Arusha SOS Hermann Gmeiner Secondary School', 'Arusha', 'secondary'),
  ('Assalaf Islamic Seminary', 'Arusha', 'secondary'),
  ('Bangata Secondary School', 'Arusha', 'secondary'),
  ('Bishop Durning High School', 'Arusha', 'secondary'),
  ('D''Alzon Girls Secondary School', 'Arusha', 'secondary'),
  ('Enaboishu Secondary School', 'Arusha', 'secondary'),
  ('Ilkiidinga Secondary School', 'Arusha', 'secondary'),
  ('Kisimiri Secondary School', 'Arusha', 'secondary'),
  ('Korona Secondary School', 'Arusha', 'secondary'),
  ('Makiba Secondary School', 'Arusha', 'secondary'),
  ('Kilimanjaro Islamic Secondary School', 'Moshi', 'secondary'),
  ('Moshi Secondary School', 'Moshi', 'secondary'),
  ('Weruweru Secondary School', 'Moshi', 'secondary'),
  ('Machame Secondary School', 'Kilimanjaro', 'secondary'),
  ('Kibosho Secondary School', 'Kilimanjaro', 'secondary'),
  ('Galanos Secondary School', 'Tanga', 'secondary'),
  ('Usagara Secondary School', 'Tanga', 'secondary'),
  ('Tanga Technical Secondary School', 'Tanga', 'secondary'),
  ('Mkwakwani Secondary School', 'Tanga', 'secondary'),
  ('Azania Secondary School', 'Dar es Salaam', 'secondary'),
  ('Jangwani Secondary School', 'Dar es Salaam', 'secondary'),
  ('Zanaki Secondary School', 'Dar es Salaam', 'secondary'),
  ('Tambaza Secondary School', 'Dar es Salaam', 'secondary'),
  ('Kibasila Secondary School', 'Dar es Salaam', 'secondary'),
  ('Pugu Secondary School', 'Dar es Salaam', 'secondary'),
  ('Benjamin William Mkapa Secondary School', 'Dar es Salaam', 'secondary'),
  ('Feza Boys Secondary School', 'Dar es Salaam', 'secondary'),
  ('Feza Girls Secondary School', 'Dar es Salaam', 'secondary'),
  ('Loyola Secondary School', 'Dar es Salaam', 'secondary'),
  ('Canossa Secondary School', 'Dar es Salaam', 'secondary'),
  ('St. Anthony Secondary School', 'Dar es Salaam', 'secondary'),
  ('Minaki Secondary School', 'Pwani', 'secondary'),
  ('Kibaha Secondary School', 'Pwani', 'secondary'),
  ('Kibaha Girls Secondary School', 'Pwani', 'secondary'),
  ('Bagamoyo Secondary School', 'Pwani', 'secondary'),
  ('Mzumbe Secondary School', 'Morogoro', 'secondary'),
  ('Kilakala Secondary School', 'Morogoro', 'secondary'),
  ('Kigurunyembe Secondary School', 'Morogoro', 'secondary'),
  ('Ifakara Secondary School', 'Morogoro', 'secondary'),
  ('Morogoro Secondary School', 'Morogoro', 'secondary'),
  ('Dodoma Secondary School', 'Dodoma', 'secondary'),
  ('Msalato Secondary School', 'Dodoma', 'secondary'),
  ('Jamhuri Secondary School', 'Dodoma', 'secondary'),
  ('Mkwawa High School', 'Iringa', 'secondary'),
  ('Tosamaganga Secondary School', 'Iringa', 'secondary'),
  ('Lugalo Secondary School', 'Iringa', 'secondary'),
  ('Ifunda Technical Secondary School', 'Iringa', 'secondary'),
  ('Malangali Secondary School', 'Iringa', 'secondary'),
  ('Mbeya Secondary School', 'Mbeya', 'secondary'),
  ('Loleza Secondary School', 'Mbeya', 'secondary'),
  ('Tukuyu Secondary School', 'Mbeya', 'secondary'),
  ('Tabora Boys Secondary School', 'Tabora', 'secondary'),
  ('Tabora Girls Secondary School', 'Tabora', 'secondary'),
  ('Ihungo Secondary School', 'Bukoba', 'secondary'),
  ('Bukoba Secondary School', 'Bukoba', 'secondary'),
  ('Kahororo Secondary School', 'Bukoba', 'secondary'),
  ('Mwanza Secondary School', 'Mwanza', 'secondary'),
  ('Bwiru Boys Secondary School', 'Mwanza', 'secondary'),
  ('Bwiru Girls Secondary School', 'Mwanza', 'secondary'),
  ('Nyakato Secondary School', 'Mwanza', 'secondary'),
  ('Pamba Secondary School', 'Mwanza', 'secondary'),
  ('Songea Boys Secondary School', 'Songea', 'secondary'),
  ('Songea Girls Secondary School', 'Songea', 'secondary'),
  ('Ndanda Secondary School', 'Mtwara', 'secondary'),
  ('Mtwara Technical Secondary School', 'Mtwara', 'secondary'),
  ('Lindi Secondary School', 'Lindi', 'secondary'),
  ('Kibondo Secondary School', 'Kigoma', 'secondary'),
  ('Kigoma Secondary School', 'Kigoma', 'secondary'),
  ('Lumumba Secondary School', 'Zanzibar', 'secondary'),
  ('Ben Bella Secondary School', 'Zanzibar', 'secondary'),
  ('Haile Selassie Secondary School', 'Zanzibar', 'secondary')
)
-- slug ni NOT NULL kwenye schema ya SmartNekam, kwa hiyo tunaitengeneza wakati wa INSERT.
-- City + type + hash husaidia kuzuia migongano ya slug kwa majina yanayofanana.
insert into public.institutions (name, slug, city, country_code, type)
select
  s.name,
  trim(both '-' from regexp_replace(lower(s.name), '[^a-z0-9]+', '-', 'g'))
    || '-' || trim(both '-' from regexp_replace(lower(s.city), '[^a-z0-9]+', '-', 'g'))
    || '-' || s.type
    || '-' || substr(md5(lower(s.name || '|' || s.city || '|' || s.type)), 1, 6),
  s.city,
  'TZ',
  s.type::public.institution_type
from seed s
where not exists (
  select 1
  from public.institutions i
  where i.country_code = 'TZ'
    and i.type::text = s.type
    and (
      lower(trim(i.name)) = lower(trim(s.name))
      or (length(trim(i.name)) >= 4 and strpos(lower(s.name), lower(trim(i.name))) > 0)
      or (length(trim(s.name)) >= 4 and strpos(lower(i.name), lower(trim(s.name))) > 0)
    )
);
END;
$smartnekam$;

-- Angalia matokeo baada ya ku-run:
select type, count(*) as idadi
from public.institutions
where country_code = 'TZ'
  and type in ('secondary', 'university')
group by type
order by type;

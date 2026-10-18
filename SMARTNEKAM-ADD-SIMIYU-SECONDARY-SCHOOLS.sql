-- SmartNekam: ongeza shule za sekondari za Simiyu.
-- Malampaka Secondary School inawekwa ya kwanza, kama ilivyoombwa.
-- Orodha imethibitishwa kwa marejeo ya uteuzi wa TAMISEMI 2026; si orodha kamili ya Mkoa wa Simiyu.
-- Inaweza kuendeshwa tena bila kuingiza rekodi zinazofanana.

-- Sanifisha jina endapo database ina mojawapo ya vifupisho hivi.
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
  ('Malampaka Secondary School', 'Maswa', 'secondary'),
  ('Maswa Girls Secondary School', 'Maswa', 'secondary'),
  ('Binza Secondary School', 'Maswa', 'secondary'),
  ('Nassa Secondary School', 'Busega', 'secondary'),
  ('Mwandoya Secondary School', 'Meatu', 'secondary'),
  ('Nyasosi Secondary School', 'Bariadi', 'secondary'),
  ('Nkololo Secondary School', 'Bariadi', 'secondary'),
  ('Bariadi Secondary School', 'Bariadi', 'secondary')
)
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

-- Thibitisha rekodi za shule hizi baada ya kuendesha.
select name, city, type
from public.institutions
where country_code = 'TZ'
  and type = 'secondary'
  and lower(name) in (
    'malampaka secondary school', 'maswa girls secondary school',
    'binza secondary school', 'nassa secondary school',
    'mwandoya secondary school', 'nyasosi secondary school',
    'nkololo secondary school', 'bariadi secondary school'
  )
order by case when lower(name) = 'malampaka secondary school' then 0 else 1 end, name;

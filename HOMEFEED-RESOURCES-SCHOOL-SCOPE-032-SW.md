# SmartNekam v032 — Uploads, School Q&A, Home Feed na Navigation

Mwongozo huu unahusu marekebisho yaliyopo kwenye project hii. **SQL-032 ni lazima** kabla ya kutumia upload ya textbooks, somo la “Others”, au Q&A/study groups za taasisi.

## 1. Kabla ya kuanza

1. Tengeneza backup ya Supabase database yako (au tumia staging project kwanza).
2. Hakikisha migrations za awali zimeendeshwa: SQL 001A/001B, 002, 003, 007, 013, 016/018 na SQL-028. Kama mojawapo haipo kwenye project yako, usiruke hatua—kagua schema kwanza.
3. Fungua Supabase Dashboard → SQL Editor → New query.
4. Fungua `SQL-032_smartnekam_resource_catalog_institution_scope_feed_cycle.sql`, nakili script yote na uendeshe kama migration moja. SQL hii haijaendeshwa kwenye Supabase yako na inahitaji kuhakikiwa kwenye staging kabla ya production.

## 2. Upload ya Library

Nenda `/library/upload`. Fomu ina aina tatu:

- **Notes:** PDF, DOCX, PPTX, JPG/JPEG, PNG.
- **Vitabu:** PDF, EPUB, DOCX, PPTX, JPG/JPEG, PNG.
- **Mitihani:** PDF pekee, pamoja na aina ya mtihani na mwaka.

Kuna orodha ya masomo kwa O-Level, A-Level na University. Ukichagua **Others**, lazima uandike jina la somo. File limit ni 25 MB. Hakikisha unayo haki/ruhusa ya kushiriki faili. Upload huingia `pending`; moderator lazima aidhinishe kabla haijaonekana kwa wengine.

Admin anahitaji kuwa active moderator/super_admin na SQL-028 iwe imewekwa ili ku-review textbooks kwenye foleni ya moderation.

## 3. Vikundi na maswali ya shule/chuo

SQL-032 inaongeza `university_id` kwa study groups na `school_id`/`university_id` kwa questions, policies za RLS na RPC ya joining. Ukurasa wa taasisi unaonyesha makundi na maswali yanayolingana na taasisi ya profile ya mwanafunzi active. Q&A ya wazi na study groups za jumla zinachuja rekodi ambazo scope zake zote ni `NULL`. Migration pia inaimarisha ruhusa za posts, comments, messages, files, answers na votes za ndani ya vikundi/maswali ili ziangalie scope ya taasisi kwenye database, si ukurasa pekee.

Jaribu kwenye staging kwa akaunti mbili zenye taasisi tofauti:

1. Akaunti A iunde swali/group ndani ya taasisi yake.
2. Akaunti A ionekane rekodi hiyo kwenye ukurasa wa taasisi yake.
3. Akaunti B ya taasisi tofauti isiione, hata ikiweka URL ya moja kwa moja. SQL-032 pia husafisha membership za zamani kwenye vikundi vya shule/chuo pale profile haiendani tena na taasisi au haiko active; hii hufuta membership row tu, si kikundi wala posts zake.
4. Rekodi za scope ya taasisi zisionekane kwenye `/communities?tab=qa` ya jumla.
5. Akaunti isiyo na profile active isiruhusiwe kutuma nyenzo au kujiunga na group.

## 4. Home Feed

Feed huonyesha posts kwa mafungu ya takriban post 3, kisha hubadilishana sehemu za discovery:

1. Kadi za Library, Learn, Jamii na Fursa.
2. Wanafunzi/mentors wanaopendekezwa kwa kufuata mipangilio ya faragha na blocks.
3. Shule, vyuo na study groups za jumla.

Mzunguko huu hurudiwa kadiri posts zilivyo. Vitufe vya kuandika post vinafungua composer iliyopo.

## 5. Navigation na Fursa

- Simu: icons nne (Home, Library, Jamii, Learn) pamoja na kitufe cha `+`; Fursa, Profile, taarifa, Planner na admin (kwa staff waliothibitishwa) viko kwenye menyu ya More.
- Desktop: navigation iko juu.
- Fursa sasa inatumia blue/indigo-purple accents za Midnight Scholar. Badge ya “Imehakikiwa” bado ni teal kimakusudi kuonyesha hali ya verification.

## 6. Ukaguzi baada ya migration

Kutoka kwenye folda ya project:

```bash
npm ci
npm run build
npm run dev
```

Kagua routes hizi kwa akaunti active:

- `/dashboard` — feed interleaved.
- `/library` na `/library/upload` — Notes, Vitabu, Mitihani na Others.
- `/communities` — global Q&A/group list bila data ya taasisi.
- `/communities/institution/<id>?kind=school` au `?kind=tertiary` — Q&A na vikundi vya taasisi husika.
- `/opportunities` — theme inayolingana na Midnight Scholar.

**Hali ya uthibitisho:** mafaili ya TS/TSX yamepitishwa kwenye syntax parser. Build kamili na SQL execution dhidi ya Supabase haiwezi kudaiwa hapa: endesha `npm ci`/`npm run build` na migration kwenye staging ya project yako, kagua logs, kisha peleka production.

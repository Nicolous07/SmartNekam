# SmartNekam — Ufungaji wa mabadiliko ya 018

## Vipengele vilivyoboreshwa
- Ondoa NekamAI ya majaribio ambayo haikuwa imeunganishwa na app, pamoja na dependency yake ya modeli ya ndani. Pia nimeondoa components za zamani ambazo hazikuwa na import au matumizi ndani ya source ya sasa.
- Profile: kukata (crop), kuvuta/zoom na kupanga picha ya profile au cover kabla ya kupakia.
- Usajili: Display name na username ni lazima; username iwe ya kipekee, herufi ndogo/namba/underscore pekee, herufi 3–20 na tofauti na Display name. SQL 017 ndiyo inayohakikisha uniqueness upande wa database.
- Desktop: nafasi ya chini ya layout imepunguzwa; kitufe cha post kiko karibu na kona ya chini.
- Uchapishaji: hadi attachment 5 kwa post, kila moja hadi 10 MB (picha, PDF, Word, Excel, PowerPoint, TXT, CSV); mwonekano wa attachments huonekana kwenye feed.
- Hesabu: composer ina zana za fraction, power, square root, subscript, summation, integral, alama za kulinganisha, jedwali na preview ya KaTeX. Unaweza kutumia LaTeX/Markdown ndani ya maandishi.
- Ushauri: wanachuo wanaweza kutuma ombi la kuwa peer mentor; wanafunzi wanaomba kipindi cha bure; baada ya mentor kukubali, chat inaonekana kwenye Chats. Mentor card inaonekana baada ya uhakiki wa moderator.

## Hatua za database (Muhimu)
1. Fanya backup ya database kabla ya migration.
2. Hakikisha SQL 006 (mentors/sessions), SQL 013, SQL 016, na SQL 017 zilifanikiwa. Kama SQL 017 ndiyo iliyokwama, tumia toleo lililorekebishwa lililo kwenye `sql/017_smartnekam_profiles_chat_groups_message_controls.sql` na hakikisha transaction imekamilika.
3. Fungua Supabase → SQL Editor; copy/run `sql/018_smartnekam_post_attachments_peer_mentorship.sql` mara moja. Usirudie migrations 001–016.
4. Hakikisha migration inaisha na `COMMIT` bila error. Ikiwa kuna error, hifadhi ujumbe wote wa error kabla ya kuendelea.
5. Kwenye folder ya project, endesha `npm install`, kisha `npm run dev`, fungua `http://localhost:3000`.

## Kumbuka
- Mentorship hutegemea schema na RPC kutoka SQL 006; kama hiyo haijaendeshwa, lazima iendeshwe kwanza kwa mpangilio sahihi wa migrations.
- Storage ya attachments ni public feed media. Usipakie vyeti au nyaraka binafsi kwenye attachments za post. Kwa picha za profile, tumia cropper kwenye Profile.
- Nimefanya ukaguzi wa syntax wa TypeScript baada ya mabadiliko; build kamili na migration yenyewe bado zinahitaji kujaribiwa kwenye mazingira yako, kwa kuwa siwezi kuendesha SQL dhidi ya Supabase yako kutoka hapa.

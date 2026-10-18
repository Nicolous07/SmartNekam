# SmartNekam — SQL 017 na maboresho ya profile na chat

## Kwanza: hifadhi backup
Kabla ya migration, fungua Supabase Dashboard → Database → Backups (au tumia njia yako ya kawaida ya backup). SQL 017 haifuti posts au ujumbe, lakini inaongeza constraints, RPCs na group-chat tables.

## 1. Endesha SQL 017
1. Fungua `SQL-017_smartnekam_profiles_chat_groups_message_controls.sql`.
2. Nakili faili lote (`Ctrl+A`, `Ctrl+C`).
3. Supabase Dashboard → SQL Editor → New query.
4. Bandika na bonyeza Run.
5. Hakikisha hakuna error. Usikimbilie frontend kabla migration haijakamilika.

## 2. Hakiki functions na storage
Endesha:

```sql
SELECT
  to_regprocedure('public.is_smartnekam_username_available(text,text)') AS username_check,
  to_regprocedure('public.update_my_profile(text,text,text,text,boolean,text,boolean)') AS update_profile,
  to_regprocedure('public.create_smartnekam_chat_group(text,text,text)') AS create_group,
  to_regprocedure('public.discover_smartnekam_chat_groups(text)') AS discover_groups,
  to_regprocedure('public.join_smartnekam_public_chat_group(uuid)') AS join_public_group,
  to_regprocedure('public.join_smartnekam_private_chat_group(text)') AS join_private_group,
  to_regprocedure('public.edit_smartnekam_chat_message(uuid,text)') AS edit_message,
  to_regprocedure('public.delete_smartnekam_chat_message(uuid)') AS delete_message,
  to_regclass('public.chat_group_settings') AS chat_group_settings,
  to_regclass('public.chat_message_reactions') AS chat_message_reactions,
  EXISTS (SELECT 1 FROM storage.buckets WHERE id='profile-covers' AND public=TRUE) AS profile_covers_bucket;
```

Functions na majedwali zinapaswa kuonekana badala ya `NULL`, na `profile_covers_bucket` iwe `true`.

## 3. Anzisha frontend
Katika folder `SmartNekam_App_Source`:

```bash
npm install
npm run dev
```

Fungua `http://localhost:3000`.

## 4. Mabadiliko yaliyoongezwa
- Registration ya email/phone inahitaji display name na username. Username lazima iwe 3–20 lowercase letters/numbers/underscore, iwe unique na isifanane na display name.
- Google OAuth imeachwa kwenye login pekee ili isiruke fomu ya username wakati wa registration.
- Profile settings zinaweza kupakia avatar na cover picha (JPG/PNG/WEBP, hadi 8 MB) na kuhifadhi bio/username.
- Chat Groups ziko tofauti na Study Groups: public chat groups zinaweza kugunduliwa, private chat groups zinahitaji invite code.
- Chat message controls: reply, edit, soft-delete na reactions. Ujumbe unaweza kuhaririwa/kufutwa na mtumaji wake tu; deletion huonyesha `[Ujumbe umefutwa]` badala ya kufuta row kabisa.

## 5. Jaribio linalopendekezwa
Tumia akaunti mbili za majaribio:
1. Sajili akaunti yenye display name na username ya kipekee.
2. Jaribu username iliyotumika tayari na username inayofanana na display name; zote zinapaswa kukataliwa.
3. Weka avatar na cover kwenye Profile.
4. Unda private chat group na ujiunge kwa invite code kutoka akaunti ya pili.
5. Tuma ujumbe, reply, reaction, hariri na ufute ujumbe wako.
6. Unda public chat group na ujaribu kuipata/kujiunga kutoka akaunti ya pili.

## Muhimu
- Avatar na cover picha ni picha za public-facing. Usipakie vyeti, ID au nyaraka binafsi kwenye buckets hizi.
- Realtime inategemea kuwezeshwa kwa Supabase Realtime kwenye project.
- SQL 017 inaandaa database na UI integration; bado fanya majaribio kwa akaunti mbili kabla ya production.

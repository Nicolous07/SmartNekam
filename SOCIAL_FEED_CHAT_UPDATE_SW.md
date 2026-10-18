# SmartNekam — Home Feed na Direct Chat (Kiswahili)

## Vilivyoongezwa
- Home Feed kwenye dashboard yenye kuchapisha post za maandishi/picha, likes, share-link/native share, comments na threaded replies.
- Kwenye desktop (xl+), feed ya katikati na paneli ya profile/rank zina scroll maeneo yao tofauti.
- Kitufe cha (+) kinapatikana kwenye desktop; composer ya Home Feed inapatikana pia kupitia sehemu ya juu ya feed na Quick Create.
- Jamii > Chats: inbox ya mazungumzo binafsi, kutafuta watumiaji kwa username au jina, kuanza chat, kutuma ujumbe wa maandishi na kupokea updates za realtime.
- Fields za username, bio, avatar na cover kwenye profiles; migration inaongeza `username` kwa profaili za zamani.
- SQL 016 inaongeza tables/RLS/views za feed, Storage buckets za public images, na RPC za kutafuta username na inbox/messages.

## Kabla ya kutumia UI mpya
1. Chukua backup ya database yako kabla ya migration mpya.
2. Endesha faili lote `sql/016_smartnekam_social_feed_direct_messages.sql` kwenye Supabase SQL Editor (New query).
3. Thibitisha kuwa SQL imeisha bila error. Kisha jaribu login, kuchapisha post, like, comment/thread na kutuma chat kwa user wa pili.
4. Ruhusa za direct messages zinaheshimu `user_privacy_settings` na `user_blocks`. Kwa watumiaji ambao hawajachagua privacy rule, migration huweka default ya DM kuwa `everyone`; mipangilio iliyochaguliwa tayari (mfano `group_members` au `no_one`) haiandikwi upya.
5. Kwa picha za post/profile, bucket `post-images` na `avatars` ni public kwa sababu hizi ni picha zinazokusudiwa kuonekana kwenye feed/profile. Usipakie nyaraka binafsi kwenye buckets hizo.

## Kuendesha frontend
```bash
npm install
npm run dev
```
Fungua `http://localhost:3000`. Project hutumia `NEXT_PUBLIC_SUPABASE_URL` na `NEXT_PUBLIC_SUPABASE_ANON_KEY` kutoka `.env.local`.

## Mambo ya kuzingatia
- Chat hii ni direct messaging ya maandishi yenye realtime updates; si end-to-end encrypted, na haitoi bado media messages, voice/video calls au full delivery/read receipts.
- Picha za posts zina maximum 5 MB; profile avatars/covers zinatumia bucket `avatars`.
- Ikiwa database ya production iko kwenye branch/project tofauti, hakikisha migration inaendeshwa kwenye project sahihi.

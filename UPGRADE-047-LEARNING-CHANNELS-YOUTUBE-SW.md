# SmartNekam — SQL 047: Teaching Channels na YouTube ndani ya Learn

Mabadiliko haya yanaongeza:
- Mtumiaji kufungua channel yake ya kufundisha.
- Makundi: maisha, masomo, teknolojia/Programming/AI, career, biashara, afya na mengine.
- Creator kuongeza link ya YouTube kwenye channel yake.
- Video kucheza ndani ya SmartNekam kupitia embedded YouTube player; mtazamaji habanwi kuondoka kwenda YouTube.
- RLS ili mmiliki pekee aweze kuongeza/kubadilisha maudhui ya channel yake.

## Hatua za kuwasha backend
1. Fungua [Supabase Dashboard](https://supabase.com/dashboard) na uchague project ya SmartNekam.
2. Nenda **SQL Editor → New query**.
3. Fungua faili `sql/047_smartnekam_learning_channels_youtube.sql` kwenye GitHub, nakili SQL yote, ibandike kwenye SQL Editor na bonyeza **Run**.
4. Thibitisha kwa kuendesha:
   ```sql
   SELECT to_regclass('public.learning_channels'),
          to_regclass('public.learning_channel_videos');
   ```
   Zote mbili zinapaswa kurudisha majina ya table badala ya NULL.
5. Subiri Vercel deployment ya commit ya Learn Channels ikamilike.
6. Ingia SmartNekam → **Learn → Teaching Channels** → **Fungua channel**. Fungua channel yako na uongeze video kwa kuweka link ya YouTube.

## Link za YouTube zinazokubalika
- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/shorts/VIDEO_ID`
- `https://www.youtube.com/live/VIDEO_ID`

YouTube inaweza kuzuia embed kwa baadhi ya video kulingana na mipangilio ya mwenye video, haki za maudhui au vizuizi vya eneo. Katika hali hiyo, video hiyo haitacheza ndani ya app na kiungo cha kuifungua YouTube kinabaki chini yake.

**Muhimu:** Code kuwa GitHub haimaanishi migration tayari imeendeshwa kwenye Supabase au deployment imekamilika kwenye Vercel. Fanya hatua zote mbili kabla ya kujaribu kipengele.

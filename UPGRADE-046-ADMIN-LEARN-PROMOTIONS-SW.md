# SmartNekam SQL 046 — Admin Learn Studio & Pinned Posts

## Inayoongezwa

- Admin anaweza kuunda kozi mpya yenye module na lesson ya kwanza.
- Anaweza kuongeza modules/lessons nyingine kwenye kozi iliyopo.
- Kozi inaweza kuachwa `pending_review` au kuchapishwa moja kwa moja na moderator/Super Admin active.
- Admin anaweza kuchagua post ionekane juu ya Home Feed hata kama ni ya zamani, na baadaye kuiondoa.
- Matangazo yaliyolipiwa yana lebo inayoonekana, payment reference, uthibitisho wa Super Admin na tarehe ya mwisho. Promotion ikiisha, post haitarudi juu kupitia mfumo wa promotion.
- Supabase RPC zinafanya role checks upande wa database; kuficha buttons pekee hakutoshi.

## Kuwezesha kwenye Supabase

1. Fungua [Supabase Dashboard](https://supabase.com/dashboard) na chagua project inayotumiwa na SmartNekam.
2. Fungua **SQL Editor** na tengeneza query mpya.
3. Fungua [SQL 046 kwenye GitHub](https://github.com/Nicolous07/SmartNekam/blob/main/sql/046_smartnekam_admin_learning_promotions.sql), nakili SQL yote na ubandike kwenye SQL Editor.
4. Bonyeza **Run**. Endesha baada ya schema ya SmartNekam ya awali, ikiwemo tables `posts`, `posts_feed`, `courses`, `course_modules`, `course_lessons` na `profiles`, kuwa tayari.
5. Hakikisha query imekamilika bila error. Ikiwa inashindwa, nakili error nzima; usidhani feature imewezeshwa kwa kuwa SQL imehifadhiwa GitHub.

## Kutumia Admin Panel

- Fungua `/admin?section=learning` ili kuunda kozi, kuweka lesson ya kwanza, kuongeza modules/lessons kwenye kozi iliyopo, na kuchapisha Learn content.
- Fungua `/admin?section=promotions` ili kupin post au kuweka tangazo la chuo/taasisi.
- Pin ya kawaida inaweza kuwa bila tarehe ya mwisho mpaka admin aiondoe.
- Sponsored post inahitaji reference ya malipo, tarehe ya mwisho, na uthibitisho wa Super Admin.

## Mpaka wa malipo

Katika toleo hili, admin anaingiza payment reference na kuthibitisha malipo baada ya kuyakagua kwenye provider/risiti. Hii **si** uthibitisho wa malipo wa moja kwa moja wa webhook; integration ya payment-provider na campaign billing inapaswa kuongezwa kando. Usichague “Malipo yamehakikiwa” bila uthibitisho halisi.

SQL inaongeza columns na functions; haifuti posts, kozi au data za watumiaji zilizopo.

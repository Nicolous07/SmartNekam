# SmartNekam — Admin Panel Operations (028)

## Nini kimeunganishwa

Admin Panel imesasishwa ili sections ziwe na data kutoka Supabase badala ya takwimu za mfano. `overview`/`analytics` hutumia exact database counts na huonyesha error pale query imezuiwa au migration haipo.

- **Users:** search kwa jina/email/simu; kubadilisha status kupitia `admin_set_profile_status`; kubadilisha role kwa Super Admin pekee kupitia `admin_set_profile_role`.
- **Content:** approve/reject notes, past papers na fursa kupitia `review_library_content`.
- **Learning:** review ya courses na public flashcard decks kupitia RPC zilizopo.
- **Community & Q&A:** moderation ya study groups na questions, pamoja na review ya community events.
- **Opportunities:** kuongeza fursa kwenye `pending_review`; chanzo rasmi ni lazima; kuidhinisha/kukataa hutumia RPC ya moderation iliyopo.
- **Mentors:** approve/reject mentor profiles; suspend mentor active.
- **Institutions:** kuona schools/universities, kuongeza taasisi (Super Admin pekee), kuandika tangazo la shule kama draft au kulichapisha.
- **Payments:** kuona `payment_transactions` zilizohifadhiwa. Hakuna kitufe cha refund kilichowekwa kwa sababu provider workflow haitolewi na migration hii.
- **Notifications:** kutuma in-app notification kwa akaunti moja kupitia `admin_create_notification`.
- **Growth:** review ya referral na kutoa XP kupitia `review_referral_event`.
- **Support:** kubadilisha status na priority kwa `admin_update_support_ticket`.
- **Certificates:** kusoma vyeti na revoke kwa sababu kupitia SQL-028.
- **Security:** kusimamia status ya data requests. Kuweka status kuwa `completed` hakufanyi data export au account deletion yenyewe; operation hiyo lazima ifanyike na trusted backend/workflow.
- **Audit:** hutazama `admin_audit_log`; SQL-028 pia ina triggers zinazorekodi mabadiliko ya status/verified kwa mentors, courses, flashcard decks, community events, support tickets na data requests. Hali ya kihistoria kabla ya trigger kuwekwa haiwezi kujengwa upya kwa uhakika.

## Kuweka kwenye project

1. Hifadhi backup ya database kabla ya migration yoyote.
2. Fungua `SQL-028_smartnekam_admin_operations.sql` ndani ya project hii.
3. Kwenye Supabase Dashboard, fungua **SQL Editor → New query**, bandika faili lote na bonyeza **Run**.
4. Hakikisha migrations zilizotangulia ambazo functions hizi zinategemea zimekwishaendeshwa, hasa 003, 005, 006, 007, 010, 011 na 013 pamoja na role bootstrap ya admin.
5. SQL-028 inaongeza policies za SELECT kwa profiles, notes, past papers, study groups, Q&A na school announcements kwa moderator/super_admin active. Zinahitajika ili queues za moderation na joins za user zisionyeshe data pungufu; policies za wanafunzi wa kawaida zinaendelea kutumika kwao.
6. Hakikisha `.env.local` ina `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` na `SMARTNEKAM_ADMIN_EMAILS` yenye email ya Super Admin iliyoidhinishwa. Hii ni server-side allowlist, si nenosiri.
7. Run `npm ci`, kisha `npm run dev` au `npm run build` kwenye mashine yenye mtandao na dependencies zinazopatikana.
8. Ingia kwa Super Admin active na jaribu kila action kwenye test account/test records kwanza.

## Usalama na mapungufu

- Buttons hazifichwi kama “zimefanikiwa”; kila RPC inaonyesha error ya Supabase ikiwa database imekataa ombi.
- Actions muhimu hutumia RPC zenye uthibitishaji wa `auth.uid()` na role/status kwenye database. Kuficha UI pekee si security boundary.
- `super_admin` role pekee haitoshi katika project hii ikiwa `SMARTNEKAM_ADMIN_EMAILS` imewekwa: email lazima pia iwe kwenye allowlist.
- `service_role` key isiwekwe kwenye browser wala `.env` inayopakiwa kwa client.
- Provider payment refunds, SMS/email/push delivery, export/deletion ya data na analytics kama DAU/WAU/MAU zinahitaji workflows/events providers maalum. Panel haibuni matokeo hayo.
- Hakuna connection ya moja kwa moja kwa Supabase project ya mtumiaji katika hatua hii; migration lazima iendeshwe na kuthibitishwa kwenye project halisi.

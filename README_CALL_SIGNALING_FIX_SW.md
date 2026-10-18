# SmartNekam — marekebisho ya simu za sauti

SQL 035 ya awali ilijaribu kubadilisha `realtime.messages`, jedwali linalosimamiwa na Supabase. Toleo hili limebadilishwa kutumia `public.smartnekam_call_signals` na RLS, hivyo halibadilishi tena `realtime.messages`.

## Kwa database ambayo SQL 035 ya zamani ilishindwa
Endesha faili `SMARTNEKAM_SQL_036_CALL_SIGNALING_NO_REALTIME_MESSAGES.sql` iliyotolewa pamoja na majibu ya marekebisho. Kisha thibitisha `realtime_enabled = true`; ikiwa ni false, wezesha table kwenye Database → Publications → supabase_realtime.

## Code
`src/components/communities/DirectMessages.tsx` sasa inatumia Postgres Changes (`public.smartnekam_call_signals`) kwa signaling ya WebRTC.

## Kujaribu
1. Hakikisha SQL 006, 016, 017, 034 za msingi zipo tayari.
2. Run `npm install` na `npm run dev`.
3. Ingia kwa akaunti mbili zilizo kwenye direct chat na jaribu audio call. Ruhusu microphone.

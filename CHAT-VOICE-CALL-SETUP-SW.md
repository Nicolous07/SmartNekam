# SmartNekam Chat UI + Voice Messages + Audio Calls

Mabadiliko haya yanafanya sehemu ya Chat ifuate rejea za UI ulizotuma huku ikihifadhi rangi za SmartNekam (kijani, nyeusi na nyeupe).

## Kilichoongezwa

- Chat list yenye orodha ya mazungumzo ya karibuni inayoteleza kushoto/kulia.
- Chat bubbles, header na composer zimeboreshwa kwa simu na desktop.
- Kitufe cha microphone kurekodi voice note; mtumiaji anaweza kusikiliza sauti iliyorekodiwa kabla ya kuituma.
- Simu ya sauti ya moja kwa moja (voice call) kwa DM na mentorship chat, ikiwa browser imefunguliwa na pande zote mbili ziko kwenye conversation husika.
- Call controls za kupokea, kukataa, kumaliza na kunyamazisha microphone.
- Calls hutumia WebRTC; sauti haitunziwi kwenye Supabase Storage. Supabase Realtime hutumika kubadilishana offer/answer/ICE signaling.
- Ujumbe, attachment na sauti zilizotumwa huhifadhiwa kwa njia iliyokuwepo kwenye `DirectMessages.tsx`.

## Kuweka code

1. Badilisha `src/components/communities/DirectMessages.tsx` kwa toleo lililo ndani ya ZIP.
2. Hakikisha migrations za msingi 006, 016 na 017 pamoja na SQL 034 (chat media) tayari zimetekelezwa.
3. Kwenye Supabase Dashboard → SQL Editor, run faili `SQL-035_smartnekam_private_audio_call_signaling.sql`.
4. Restart Next.js: simamisha kwa `Ctrl+C`, kisha `npm run dev`.

## Muhimu

- Voice note na voice call zinahitaji HTTPS kwenye production; `localhost` inaruhusiwa kwa maendeleo.
- Kila mtumiaji lazima aruhusu matumizi ya microphone kwenye browser/device yake.
- Kwa voice call, pande zote zinahitaji kuwa zimeingia SmartNekam na kufungua conversation husika ili kuona call inayoingia.
- WebRTC hutumia STUN server ya Google kwa kuanza muunganisho. Baadhi ya mitandao yenye NAT/firewall kali inaweza kuhitaji TURN server kwa reliability zaidi.
- SQL 035 inazuia signaling ya channels binafsi kwa washiriki hai wa conversation. Usibadilishe channel ya call kuwa public.
- SQL 034 inahitajika kwa `message_type='audio'` na bucket `smartnekam-chat-attachments`.

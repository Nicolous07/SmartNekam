# SmartNekam — Kusimamisha mfumo wa malipo kwa muda

Mabadiliko ya app yanaficha sehemu za SmartNekam Pro, bei za kozi, kitufe cha kuanzisha malipo, Pro reward claims na Wallet kwa watumiaji. Ukurasa wa `/premium` unaelekeza mtumiaji kwenye Learn. API ya kuanzisha checkout na API ya kudai XP-to-Pro reward zinajibu `503` wakati feature switch imezimwa.

## Hatua ya ziada ya Supabase

Ikiwa SQL 048 tayari imeendeshwa kwenye Supabase, endesha faili hili mara moja kwenye **Supabase → SQL Editor**:

`sql/049_pause_pro_reward_claims.sql`

Linazuia watumiaji kuita moja kwa moja RPC ya `claim_xp_reward`, hata wakijaribu kuipita UI/API.

## Kurejesha baadaye

1. Katika `src/lib/payments/feature.ts`, badilisha `SMARTNEKAM_PAYMENTS_ENABLED = false` kuwa `true`.
2. Katika Supabase SQL Editor, rudisha ruhusa ya XP rewards kwa kuendesha:

```sql
GRANT EXECUTE ON FUNCTION public.claim_xp_reward(text) TO authenticated;
```

3. Hakikisha mipangilio ya Flutterwave na Vercel imekamilishwa na kuthibitishwa kabla ya kuwasha uzalishaji wa malipo tena.

Callback na webhook za Flutterwave zimeachwa ziweze kuthibitisha muamala wa zamani ambao tayari ulianzishwa; checkout mpya imefungwa. Hii inasaidia kutopoteza uthibitisho wa muamala uliokuwa unaendelea kabla ya kuzima.

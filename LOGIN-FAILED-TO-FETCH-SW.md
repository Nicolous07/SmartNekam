# SmartNekam: kurekebisha “Failed to fetch” wakati wa kuingia

Hitilafu hii mara nyingi humaanisha browser haijaweza kufikia Supabase. Code pekee haiwezi kurekebisha Project URL/key isiyo sahihi au intaneti iliyokatika.

## 1. Weka credentials sahihi
1. Fungua Supabase na uchague mradi unaotumia SmartNekam.
2. Nenda **Project Settings → API** (au sehemu ya API Keys kwenye dashboard mpya).
3. Nakili **Project URL** na **anon/public key** au **publishable key**.
4. Kwenye folda ileile yenye `package.json`, nakili `.env.example` na iite `.env.local`.
5. Jaza bila alama za nukuu, kwa mfano:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=WEKA_KEY_YAKO_HALISI_HAPA
```

`PROJECT-REF` na `WEKA_KEY...` ni mifano tu—badilisha kwa taarifa kutoka kwenye mradi wako. Usitumie service_role/secret key kwenye `NEXT_PUBLIC_`.

## 2. Anzisha upya Next.js
Simamisha server kwa `Ctrl+C`, kisha:

```bash
npm run dev
```

## 3. Ikiendelea
- Hakikisha intaneti inafanya kazi na hakuna VPN/proxy/firewall inayozuia Supabase.
- Hakikisha mradi wa Supabase haujasimamishwa/paused.
- Jaribu kufungua `https://PROJECT-REF.supabase.co/auth/v1/health` kwenye browser ukibadilisha PROJECT-REF kwa ref yako. URL isiyo sahihi au DNS/network inaweza kuonyesha hitilafu.
- Supabase → Authentication → URL Configuration: weka Site URL ya tovuti yako na Redirect URLs zinazolingana na domain yako, hasa `http://localhost:3000/**` kwa majaribio ya ndani. Hili huhusu redirect; si sababu ya kawaida ya “Failed to fetch” ya password login.
- Fungua DevTools → Network/Console ili kuona URL iitwayo; usishare anon key au cookies hapa.

Toleo hili la code linaonyesha maelekezo yanayoeleweka iwapo env values hazijawekwa, na ujumbe mahsusi kwa hitilafu ya mtandao.

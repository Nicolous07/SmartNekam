# SmartNekam — Marekebisho ya kuingia

Marekebisho haya yana:
- Redirect ya login ya barua pepe/nywila kwenda kwenye ukurasa mpya, ili cookie mpya za Supabase zisikwame kwenye App Router navigation ya awali.
- Callback inayokagua `code`, kushughulikia errors zinazotumwa na OAuth provider, na kupeleka sababu maalum kwenye ukurasa wa auth badala ya ujumbe uleule wa jumla.
- Logging salama ya aina/status ya error bila kurekodi auth code, access token au refresh token.
- Ujumbe unaoeleweka kwa mtumiaji kwenye `/auth`.

## Mipangilio inayohitajika kwenye Supabase

1. Nenda **Authentication → URL Configuration**.
2. Weka **Site URL** kuwa origin halisi unayotumia, kwa mfano `http://localhost:3000` kwa local development.
3. Chini ya **Redirect URLs**, ongeza `http://localhost:3000/auth/callback`. Kwa production ongeza pia `https://DOMAIN-YAKO/auth/callback` na tumia domain hiyo halisi kwenye app.
4. Kama unatumia Google, fungua **Authentication → Providers → Google** na hakikisha provider imewezeshwa na Client ID/Secret ni sahihi. Kwenye Google Cloud, Authorized redirect URI lazima iwe callback URL ya Supabase inayoonyeshwa na Supabase, si `/auth/callback` ya SmartNekam.
5. Hakikisha `.env.local` ina `NEXT_PUBLIC_SUPABASE_URL` na `NEXT_PUBLIC_SUPABASE_ANON_KEY` kutoka Supabase project ile ile. Usishiriki faili yenye siri hizi hadharani.

## Kupima

```bash
npm ci
npm run build
npm run dev
```

Jaribu login ya barua pepe/nywila na Google kwa kila njia kivyake. Kama bado inashindwa, angalia terminal log inayoanza na `[SmartNekam auth callback]` na ujumbe ulioonyeshwa kwenye `/auth`. Error code peke yake haiwezi kuthibitisha mipangilio ya dashboard au provider; hizo zinapaswa kulinganishwa na project yako ya Supabase.

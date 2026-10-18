# SmartNekam — AUTH-025: Kurekebisha Phone OTP na Google Login

Mwongozo huu una sehemu mbili: (1) marekebisho ya frontend yaliyo kwenye project, na (2) mipangilio ya lazima kwenye Supabase/Google. Sehemu ya pili haiwezi kufanywa na code ya frontend pekee.

## 1. Kuweka Phone Number + OTP

### A. Ruhusu usajili kwa namba za simu

1. Fungua **Supabase Dashboard** na uchague project inayotumiwa na SmartNekam (`NEXT_PUBLIC_SUPABASE_URL`).
2. Nenda **Authentication → Sign In / Providers** (au **Authentication → Providers**, kutegemea muonekano wa Dashboard).
3. Fungua **Phone** na uiwashe.
4. Hakikisha mipangilio ya project inaruhusu kuunda watumiaji wapya (**Allow new users / Enable signups**). Kosa `Signups not allowed for otp` humaanisha Supabase imekataa ombi la OTP linalohitaji kuunda akaunti, au namba mpya imejaribu kuingia badala ya kujisajili.
5. Bonyeza **Save**.

### B. Sanidi SMS provider — hili ni la lazima kwa SMS halisi

Kwenye mipangilio ya **Phone**, chagua mtoa huduma wa SMS anayeungwa mkono, kama **Twilio** au **Vonage**, kisha weka credentials zinazotakiwa na provider huyo (kwa mfano Account SID, Auth Token, na sender/number kulingana na provider). Hifadhi mipangilio.

> Kuwasha Phone pekee hakumaanishi SMS zinaweza kutumwa. Supabase inahitaji SMS provider halali. Ujumbe huenda ukawa na gharama; weka rate limits na ulinzi wa abuse kabla ya kuachia public signup.

### C. Jaribu kwa mpangilio sahihi

- Mwanafunzi mpya: fungua **Jisajili**, jaza jina, username na shule/chuo, chagua **Simu + OTP**, tumia namba ya kimataifa kama `+255712345678`, kisha bonyeza **Tuma OTP**.
- Mwanafunzi mwenye akaunti: tumia **Ingia**. Namba mpya isiyokuwa na akaunti inapaswa kuanza kwenye **Jisajili**.
- OTP inaweza kuwa na rate limit; usibonyeze tuma mara nyingi mfululizo.

## 2. Kuweka “Endelea na Google”

### A. Sanidi Google OAuth credentials

1. Fungua [Google Cloud Console](https://console.cloud.google.com/) na uchague/tengeneza project.
2. Kwenye **Google Auth Platform / OAuth**, tengeneza **OAuth Client ID** ya aina **Web application**.
3. Kwenye **Authorized JavaScript origins**, ongeza origin za app unazotumia, kwa mfano:
   - `http://localhost:3000` kwa local development.
   - `https://DOMAIN-YAKO` kwa app iliyowekwa online.
4. Kwenye **Authorized redirect URIs**, ongeza callback ya Supabase iliyoonyeshwa kwenye ukurasa wa Google provider wa Supabase. Kwa kawaida ina muundo huu:
   - `https://PROJECT-REF.supabase.co/auth/v1/callback`
   - Tumia thamani halisi iliyotolewa na Supabase, si mfano huu.
5. Hifadhi na nakili **Client ID** na **Client Secret**.

### B. Washa Google ndani ya Supabase

1. Supabase Dashboard → **Authentication → Sign In / Providers → Google**.
2. Washa Google provider na uweke **Client ID** pamoja na **Client Secret** kutoka Google Cloud.
3. Hifadhi mipangilio.

### C. Weka URL ya kurudi kwenye app (tofauti na Google callback hapo juu)

Supabase Dashboard → **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` ukiwa local; kwenye production iwe URL kuu ya SmartNekam.
- **Redirect URLs** ongeza kila callback ya app inayotumika, angalau:
  - `http://localhost:3000/auth/callback`
  - `https://DOMAIN-YAKO/auth/callback` (badilisha na domain halisi ya production).

Usiweke `https://PROJECT-REF.supabase.co/auth/v1/callback` kama callback ya app hapa; hiyo ni **Authorized redirect URI ya Google OAuth**. Callback ya app ni `/auth/callback`.

### D. Environment variables

Project ina `.env.local` yenye variable hizi:

```env
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Hakikisha URL na key ni za project ileile. Kwenye hosting, weka variables hizo kwenye Environment Variables za hosting, tumia URL ya production kwa `NEXT_PUBLIC_SITE_URL`, kisha fanya redeploy. Usishiriki `service_role` key kwenye frontend; haitakiwi kwa login page.

## 3. Kujaribu mwisho hadi mwisho

1. Anzisha app kwa `npm run dev` kisha fungua `http://localhost:3000/auth`.
2. Jaribu Google: inapaswa kwenda Google consent screen na kurudi kwenye `/auth/callback`; kwa akaunti mpya, onboarding inaweza kuonekana ili kujaza taarifa za mwanafunzi.
3. Jaribu OTP kwa namba halisi yenye country code baada ya SMS provider kuthibitishwa.
4. Kama bado inashindikana, rekodi ujumbe mpya wa kosa na uangalie Supabase **Authentication → Logs**. Usitume Client Secret, Auth Token, anon key, OTP, au access token kwenye chat.

Marejeo rasmi:
- Supabase Phone Login: https://supabase.com/docs/guides/auth/phone-login
- Supabase Sign in with Google: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase Redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls

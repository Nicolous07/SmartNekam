# SmartNekam SQL 048 — SmartNekam Pro, Flutterwave na zawadi za XP

Hii upgrade inaongeza sehemu ya kwanza ya monetization inayoweza kuunganishwa kwenye app iliyopo. Haibadilishi theme wala kuanzisha project upya.

## Kinachoongezwa

- Mipango ya Pro: TZS 500 kwa siku, 1,500 kwa wiki, 3,000 kwa mwezi, 8,000 kwa miezi 3 na 25,000 kwa mwaka.
- Ukurasa wa \`/premium\` unaoonekana kutoka Learn.
- Checkout ya server kupitia Flutterwave Standard.
- Callback na webhook hukagua transaction kwenye API ya Flutterwave kabla ya kufungua muda wa Pro.
- SQL function inalinda dhidi ya webhook/callback kuhesabu malipo yale yale mara mbili.
- XP reward milestones: 250 XP = siku 3, 1,000 XP = siku 7, 2,000 XP = siku 30, 5,000 XP = siku 90 za Pro. Kila milestone inadaiwe mara moja na muda huongezwa juu ya subscription iliyopo.

## Hatua A — Supabase

1. Fungua Supabase project inayotumiwa na SmartNekam.
2. Nenda **SQL Editor → New query**.
3. Fungua [SQL 048](https://github.com/Nicolous07/SmartNekam/blob/main/sql/048_smartnekam_pro_flutterwave_xp_rewards.sql), nakili SQL yote na ubandike kwenye SQL Editor.
4. Bonyeza **Run** na hakikisha hakuna error.
5. Hakiki plans:

\`\`\`sql
SELECT slug, price, currency, billing_interval, is_active
FROM public.subscription_plans
ORDER BY display_order;
\`\`\`

Unapaswa kuona mipango mitano ya \`smartnekam-pro-...\`.

Ikiwa SQL inatoa error, usiendelee na checkout bado. Hifadhi error nzima ili migration irekebishwe; usidhani table imeundwa kwa sababu file ipo GitHub.

## Hatua B — Vercel environment variables

Katika Vercel → SmartNekam → Settings → Environment Variables, hakikisha variable zifuatazo zimewekwa. Weka secrets kwenye Vercel tu, si kwenye source code.

| Variable | Inatumika kwa |
|---|---|
| \`NEXT_PUBLIC_SITE_URL\` | \`https://smartnekam.vercel.app\` |
| \`NEXT_PUBLIC_SUPABASE_URL\` | URL ya Supabase project |
| \`SUPABASE_SERVICE_ROLE_KEY\` | Server-only DB operations; usiweke kwenye browser |
| \`FLW_SECRET_KEY\` | API calls za Flutterwave |
| \`FLW_SECRET_HASH\` | Uthibitisho wa webhook ya Flutterwave |

Weka values kwenye Production, na Preview kama unafanya majaribio. Usibandike hapa secret key au secret hash.

## Hatua C — Flutterwave dashboard

1. Hakikisha akaunti yako ya biashara imewezeshwa kupokea malipo ya TZS na payment methods unazotaka. Flutterwave inaelekeza kutumia Standard checkout API kwa hosted payment page; payment methods halisi hutegemea nchi, currency na mipangilio ya merchant.
2. Tumia test credentials na mazingira ya test kwanza; usianze na malipo halisi kabla ya kujaribu flow yote.
3. Kwenye mipangilio ya Webhooks, weka URL hii:

\`https://smartnekam.vercel.app/api/webhooks/flutterwave\`

4. Weka webhook secret hash inayolingana na \`FLW_SECRET_HASH\` kwenye Vercel. Kwa integration hii ya v3, endpoint hukagua header \`verif-hash\`.
5. Deploy upya SmartNekam baada ya kuongeza environment variables.

Marejeo rasmi: [Flutterwave Standard checkout](https://developer.flutterwave.com/docs/flutterwave-standard-1), [API ya kuunda checkout](https://developer.flutterwave.com/reference/checkout), [Webhooks](https://developer.flutterwave.com/docs/webhooks), [Tanzania mobile money](https://developer.flutterwave.com/docs/tanzania).

## Hatua D — Majaribio

1. Fungua \`https://smartnekam.vercel.app/premium\` ukiwa umeingia.
2. Hakiki bei na duration.
3. Chagua plan ukitumia test mode; usitumie pesa halisi wakati wa test.
4. Hakiki kuwa transaction ina status \`successful\` tu baada ya provider kuithibitisha na kuwa \`user_subscriptions\` ina period end inayofaa.
5. Jaribu kurudia callback/webhook ya transaction ileile; subscription haipaswi kuongezwa mara ya pili kwa transaction hiyo.
6. Kwa XP, tumia akaunti ya test yenye XP ya milestone husika, fungua Premium page, kisha dai zawadi. Hakiki \`xp_reward_claims\` na \`user_subscriptions\`.

Queries za ukaguzi:

\`\`\`sql
SELECT profile_id, provider, provider_reference, status, amount, currency, paid_at
FROM public.payment_transactions
ORDER BY created_at DESC
LIMIT 20;

SELECT profile_id, status, source, current_period_start, current_period_end
FROM public.user_subscriptions
ORDER BY created_at DESC
LIMIT 20;

SELECT profile_id, reward_code, xp_required, reward_days, created_at
FROM public.xp_reward_claims
ORDER BY created_at DESC
LIMIT 20;
\`\`\`

## Mipaka inayopaswa kujulikana

- Code na SQL zimehifadhiwa GitHub, lakini hazithibitishi kwamba SQL tayari imeendeshwa Supabase au kwamba deployment ya Vercel imefanikiwa.
- Pro checkout hii inafunika subscriptions za SmartNekam Pro. Digital pack checkout, tutor escrow/payouts, creator course revenue share, school B2B invoicing, sponsor billing na event tickets ni modules tofauti na bado hazijaunganishwa na payment provider katika upgrade hii.
- Zawadi za XP zinazotolewa moja kwa moja kwa sasa ni muda wa Pro. Streak freeze, discount ya packs, badge entitlement na priority mentor zinahitaji entitlement na UI zinazozitumia kabla hazijaahidiwa kama zawadi inayofanya kazi.
- Usionyeshe payment secrets au service role key kwenye frontend, GitHub, screenshots au chat.
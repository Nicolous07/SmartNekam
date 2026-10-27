import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Crown, Gift, ShieldCheck, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import PremiumPlanButton from '@/components/payments/PremiumPlanButton'
import XPRewardClaimButton from '@/components/payments/XPRewardClaimButton'

type Plan = {
  id: string
  name: string
  slug: string
  price: number
  currency: string
  billing_interval: string
  description: string | null
}

const XP_REWARDS = [
  { code: 'pro_notes_3_days', xp: 250, days: 3, title: 'Premium access — siku 3', description: 'Tumia XP kufungua muda wa Pro wa siku tatu.' },
  { code: 'pro_week_7_days', xp: 1000, days: 7, title: 'SmartNekam Pro — wiki 1', description: 'Tumia XP kufungua Pro kwa siku saba.' },
  { code: 'pro_month_30_days', xp: 2000, days: 30, title: 'SmartNekam Pro — siku 30', description: 'Tumia XP kufungua Pro kwa siku 30.' },
  { code: 'pro_3_months_90_days', xp: 5000, days: 90, title: 'SmartNekam Pro — siku 90', description: 'Tumia XP kufungua Pro kwa siku 90.' },
]

const INTERVAL_LABELS: Record<string, string> = {
  daily: 'siku 1',
  weekly: 'wiki 1',
  monthly: 'mwezi 1',
  quarterly: 'miezi 3',
  annual: 'mwaka 1',
  yearly: 'mwaka 1',
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Tarehe haijawekwa'
  return new Date(value).toLocaleDateString('sw-TZ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Africa/Dar_es_Salaam',
  })
}

export default async function PremiumPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string; reward?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const [profileResult, plansResult, subscriptionResult, claimsResult] = await Promise.all([
    supabase.from('profiles').select('xp,status').eq('id', user.id).maybeSingle(),
    supabase.from('subscription_plans')
      .select('id,name,slug,price,currency,billing_interval,description')
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabase.from('user_subscriptions')
      .select('id,plan_id,status,current_period_end,source')
      .eq('profile_id', user.id)
      .eq('status', 'active')
      .gt('current_period_end', new Date().toISOString())
      .order('current_period_end', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('xp_reward_claims').select('reward_code,created_at').eq('profile_id', user.id),
  ])

  const xp = Number(profileResult.data?.xp ?? 0)
  const plans = (plansResult.data ?? []) as Plan[]
  const current = subscriptionResult.data
  const claimedCodes = new Set((claimsResult.data ?? []).map(row => row.reward_code as string))
  const migrationMissing = Boolean(plansResult.error || subscriptionResult.error || claimsResult.error)

  return (
    <div className="stagger mx-auto max-w-6xl space-y-5 pb-10">
      <div>
        <Link href="/learn" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-600 dark:text-emerald-300">
          <ArrowLeft className="h-4 w-4" /> Rudi Learn
        </Link>
      </div>

      <section className="geometric-hero isolate relative overflow-hidden rounded-3xl p-5 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-16 h-64 w-64 rounded-full border-[36px] border-white/10" />
        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200/30 bg-amber-300/10 px-3 py-1.5 text-xs font-extrabold text-amber-100">
            <Crown className="h-4 w-4" /> SMARTNEKAM PRO
          </span>
          <h1 className="mt-4 text-3xl font-black sm:text-4xl">Pata muda zaidi wa kujifunza.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-100">
            Chagua muda wa Pro unaokufaa au tumia XP yako kudai zawadi za muda wa premium.
            Malipo huthibitishwa upande wa server kabla subscription haijafunguliwa.
          </p>
          {current && (
            <div className="mt-5 inline-flex items-start gap-2 rounded-xl border border-emerald-200/30 bg-emerald-400/10 px-4 py-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" />
              <span><strong>Pro yako iko active.</strong><br />Inaisha {formatDate(current.current_period_end)}.</span>
            </div>
          )}
        </div>
      </section>

      {params.payment === 'success' && <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">Malipo yamethibitishwa na Pro imefunguliwa. Refresh ukurasa wa maudhui kama bado hujaona ufikiaji mpya.</div>}
      {params.payment === 'pending_review' && <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Malipo yanaweza kuwa yamepokelewa lakini uthibitisho haujakamilika. Usilipe tena kwa haraka; angalia hali baada ya muda au wasiliana na support.</div>}
      {params.payment === 'not_verified' && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">Hatukuweza kuthibitisha transaction. Pro haijafunguliwa. Ikiwa umetozwa, wasiliana na support ukiwa na risiti ya mtoa huduma.</div>}
      {params.reward === 'claimed' && <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">Zawadi ya XP imeongezwa kwenye muda wa Pro wa akaunti yako.</div>}

      {migrationMissing && (
        <section className="geometric-card p-5">
          <h2 className="font-extrabold text-slate-950 dark:text-white">Malizia setup ya Supabase</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Schema ya Pro/rewards haijapatikana kikamilifu. Admin anapaswa kuendesha SQL 048 kwenye Supabase SQL Editor kabla ya matumizi.
          </p>
          <Link href="https://github.com/Nicolous07/SmartNekam/blob/main/sql/048_smartnekam_pro_flutterwave_xp_rewards.sql" className="mt-3 inline-flex rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white">Fungua SQL 048</Link>
        </section>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-black text-slate-950 dark:text-white">Chagua mpango wa Pro</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Bei za kuanzia kwa TZS. Malipo yanaanzishwa kupitia checkout ya Flutterwave.</p>
        </div>
        {plans.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan, index) => (
              <article key={plan.id} className={'geometric-card flex flex-col p-5 ' + (plan.slug === 'smartnekam-pro-monthly' ? 'ring-2 ring-emerald-500' : '')}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold text-slate-950 dark:text-white">{plan.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">{plan.description || 'Ufikiaji wa maudhui yaliyowekwa premium.'}</p>
                  </div>
                  {plan.slug === 'smartnekam-pro-monthly' && <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Maarufu</span>}
                </div>
                <p className="mt-5 text-3xl font-black text-slate-950 dark:text-white">
                  {Number(plan.price).toLocaleString('en-US')} <span className="text-sm font-bold text-slate-500">{plan.currency}</span>
                </p>
                <p className="mt-1 text-xs text-slate-500">Kwa {INTERVAL_LABELS[plan.billing_interval] || plan.billing_interval}</p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Kozi za Premium na marking schemes</li>
                  <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Uthibitisho wa malipo upande wa server</li>
                </ul>
                <PremiumPlanButton planSlug={plan.slug} />
              </article>
            ))}
          </div>
        ) : !migrationMissing ? (
          <div className="geometric-card p-6 text-sm text-slate-500">Hakuna plan iliyo active kwa sasa.</div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200"><Gift className="h-5 w-5" /></span>
          <div>
            <h2 className="text-xl font-black text-slate-950 dark:text-white">Badilisha XP kuwa muda wa Pro</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">XP hubaki kwenye akaunti yako. Kila milestone inaweza kudaiwa mara moja; muda wa zawadi unaongezwa juu ya Pro uliyonayo.</p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-extrabold text-amber-900 dark:bg-amber-950 dark:text-amber-200"><Sparkles className="h-3.5 w-3.5" /> XP yako: {xp.toLocaleString()}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {XP_REWARDS.map(reward => {
            const alreadyClaimed = claimedCodes.has(reward.code)
            const eligible = xp >= reward.xp
            return (
              <article key={reward.code} className="geometric-card flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold text-slate-950 dark:text-white">{reward.title}</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{reward.description}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-extrabold text-violet-800 dark:bg-violet-950 dark:text-violet-200">{reward.xp.toLocaleString()} XP</span>
                </div>
                {alreadyClaimed ? (
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Tayari umedai milestone hii</span>
                ) : eligible ? (
                  <XPRewardClaimButton rewardCode={reward.code} />
                ) : (
                  <p className="text-xs text-slate-500">Unahitaji XP {Math.max(0, reward.xp - xp).toLocaleString()} zaidi.</p>
                )}
              </article>
            )
          })}
        </div>
        <p className="text-xs leading-5 text-slate-500">
          Kwa sasa zawadi zinazoweza kudaiwa moja kwa moja ni za muda wa Pro. Streak freeze, discount za packs na priority mentor zitaunganishwa pale vipengele hivyo vitakapokuwa na entitlement na ukaguzi wake.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 p-4 text-xs leading-5 text-slate-500 dark:border-slate-800">
        Malipo hufanywa kwenye checkout ya Flutterwave. Usishiriki PIN ya mobile money, password, API key au taarifa za siri na mtu mwingine. Hakiki kiasi kabla ya kuidhinisha malipo.
      </section>
    </div>
  )
}

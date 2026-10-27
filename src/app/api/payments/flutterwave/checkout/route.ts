import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createPaymentsAdminClient } from '@/lib/payments/flutterwave'

export const runtime = 'nodejs'

const ALLOWED_PLAN_SLUGS = new Set([
  'smartnekam-pro-daily',
  'smartnekam-pro-weekly',
  'smartnekam-pro-monthly',
  'smartnekam-pro-quarterly',
  'smartnekam-pro-yearly',
])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Ingia kwenye SmartNekam kwanza.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null) as { planSlug?: unknown } | null
  const planSlug = typeof body?.planSlug === 'string' ? body.planSlug : ''

  if (!ALLOWED_PLAN_SLUGS.has(planSlug)) {
    return NextResponse.json({ error: 'Chagua mpango halali wa SmartNekam Pro.' }, { status: 400 })
  }

  if (!user.email) {
    return NextResponse.json({
      error: 'Akaunti yako haina email. Ongeza email kwenye akaunti kabla ya kuanzisha checkout.',
    }, { status: 400 })
  }

  const missingSettings = [
    !process.env.NEXT_PUBLIC_SITE_URL ? 'NEXT_PUBLIC_SITE_URL' : null,
    !process.env.NEXT_PUBLIC_SUPABASE_URL ? 'NEXT_PUBLIC_SUPABASE_URL' : null,
    !process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
    !process.env.FLW_SECRET_KEY ? 'FLW_SECRET_KEY' : null,
    !process.env.FLW_SECRET_HASH ? 'FLW_SECRET_HASH' : null,
  ].filter((item): item is string => Boolean(item))

  if (missingSettings.length) {
    return NextResponse.json({
      error: 'Malipo bado hayajawezeshwa kwenye server. Environment variables hazipo: ' + missingSettings.join(', ') + '. Admin aweke majina haya kwenye Vercel bila kuonyesha secret values.',
    }, { status: 503 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL!.replace(/\/+$/, '')

  try {
    const admin = createPaymentsAdminClient()
    const [profileResult, planResult] = await Promise.all([
      admin.from('profiles').select('full_name,phone,status').eq('id', user.id).maybeSingle(),
      admin.from('subscription_plans')
        .select('id,name,slug,price,currency,billing_interval,is_active')
        .eq('slug', planSlug)
        .eq('is_active', true)
        .maybeSingle(),
    ])

    if (profileResult.error || !profileResult.data || profileResult.data.status !== 'active') {
      return NextResponse.json({ error: 'Akaunti active inahitajika kuendelea na malipo.' }, { status: 403 })
    }

    const plan = planResult.data
    if (planResult.error || !plan || Number(plan.price) <= 0 || plan.currency !== 'TZS') {
      return NextResponse.json({ error: 'Mpango huu haupatikani kwa sasa.' }, { status: 404 })
    }

    const txRef = 'SN-' + randomUUID()
    const { error: insertError } = await admin.from('payment_transactions').insert({
      profile_id: user.id,
      transaction_type: 'subscription',
      provider: 'flutterwave',
      status: 'pending',
      amount: Number(plan.price),
      currency: plan.currency,
      provider_reference: txRef,
      idempotency_key: randomUUID(),
      subscription_plan_id: plan.id,
      description: plan.name,
    })

    if (insertError) {
      return NextResponse.json({ error: 'Hatukuweza kuanzisha rekodi ya malipo. Jaribu tena baadaye.' }, { status: 500 })
    }

    const customerName = profileResult.data.full_name || user.email.split('@')[0] || 'SmartNekam learner'
    const providerResponse = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.FLW_SECRET_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: Number(plan.price),
        currency: 'TZS',
        redirect_url: baseUrl + '/api/payments/flutterwave/callback',
        customer: {
          email: user.email,
          name: customerName,
          ...(profileResult.data.phone ? { phonenumber: profileResult.data.phone } : {}),
        },
        customizations: {
          title: 'SmartNekam Pro',
          description: plan.name,
        },
        // Let the verified merchant's Flutterwave dashboard choose from the methods
        // enabled for the account, country, and TZS currency. Availability is provider-controlled.
        meta: {
          profile_id: user.id,
          plan_id: plan.id,
          purchase_type: 'subscription',
        },
      }),
      cache: 'no-store',
    })

    const result = await providerResponse.json().catch(() => null) as {
      status?: string
      data?: { link?: string }
    } | null

    const checkoutUrl = result?.data?.link
    if (!providerResponse.ok || result?.status !== 'success' || !checkoutUrl) {
      await admin.from('payment_transactions')
        .update({ status: 'failed' })
        .eq('provider_reference', txRef)
        .eq('provider', 'flutterwave')

      return NextResponse.json({
        error: 'Mtoa huduma hakuweza kutengeneza checkout. Hakuna Pro iliyofunguliwa; jaribu tena baadaye.',
      }, { status: 502 })
    }

    const checkoutHost = new URL(checkoutUrl).hostname
    if (checkoutHost !== 'checkout.flutterwave.com') {
      await admin.from('payment_transactions')
        .update({ status: 'failed' })
        .eq('provider_reference', txRef)
        .eq('provider', 'flutterwave')
      return NextResponse.json({ error: 'Checkout link haijapita ukaguzi wa usalama.' }, { status: 502 })
    }

    return NextResponse.json({ checkoutUrl })
  } catch {
    return NextResponse.json({
      error: 'Malipo hayakuanzishwa. Hakiki mipangilio ya Supabase na Flutterwave upande wa server.',
    }, { status: 500 })
  }
}

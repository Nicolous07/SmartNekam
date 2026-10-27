import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SMARTNEKAM_PAYMENTS_ENABLED } from '@/lib/payments/feature'

export async function POST(request: Request) {
  if (!SMARTNEKAM_PAYMENTS_ENABLED) {
    return NextResponse.json({ error: 'Zawadi za Pro zimezimwa kwa muda.' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Ingia kwanza ili kudai zawadi.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null) as { rewardCode?: unknown } | null
  const rewardCode = typeof body?.rewardCode === 'string' ? body.rewardCode : ''
  const allowed = new Set([
    'pro_notes_3_days',
    'pro_week_7_days',
    'pro_month_30_days',
    'pro_3_months_90_days',
  ])

  if (!allowed.has(rewardCode)) {
    return NextResponse.json({ error: 'Zawadi hii haipatikani.' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('claim_xp_reward', { p_reward_code: rewardCode })
  if (error) {
    const msg = error.message || ''
    const status = msg.includes('XP zinazohitajika') ? 400 : 409
    return NextResponse.json({ error: msg || 'Zawadi haikuweza kudaiwa.' }, { status })
  }

  if (data?.already_claimed) {
    return NextResponse.json({ error: 'Tayari umedai zawadi hii.' }, { status: 409 })
  }

  return NextResponse.json({ success: true, reward: data })
}

import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import {
  confirmVerifiedSubscriptionPayment,
  createPaymentsAdminClient,
  verifyFlutterwaveTransaction,
} from '@/lib/payments/flutterwave'

export const runtime = 'nodejs'

function secureEquals(left: string, right: string) {
  const a = Buffer.from(left, 'utf8')
  const b = Buffer.from(right, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  const secretHash = process.env.FLW_SECRET_HASH
  if (!secretHash) {
    return NextResponse.json({ error: 'Webhook secret hash is not configured.' }, { status: 503 })
  }

  const suppliedHash = request.headers.get('verif-hash') || ''
  if (!suppliedHash || !secureEquals(suppliedHash, secretHash)) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null) as {
    event?: string
    data?: { id?: number | string; tx_ref?: string; status?: string }
  } | null

  const transactionId = body?.data?.id
  const txRef = body?.data?.tx_ref

  if (!transactionId || !txRef) {
    return NextResponse.json({ received: true, ignored: true })
  }

  // Failed/pending events do not unlock Pro. Successful states are verified
  // against Flutterwave's API before the database is changed.
  if (body?.data?.status !== 'successful' && body?.event !== 'charge.completed') {
    return NextResponse.json({ received: true, ignored: true })
  }

  try {
    const admin = createPaymentsAdminClient()
    const { data: transaction, error } = await admin
      .from('payment_transactions')
      .select('provider_reference,provider,status,amount,currency,subscription_plan_id')
      .eq('provider', 'flutterwave')
      .eq('provider_reference', txRef)
      .maybeSingle()

    if (error || !transaction || !transaction.subscription_plan_id) {
      // Unknown references are not granted access. A 200 avoids repeated
      // retries for a webhook that is unrelated to a SmartNekam order.
      return NextResponse.json({ received: true, ignored: true })
    }

    if (transaction.status === 'successful') {
      return NextResponse.json({ received: true, already_processed: true })
    }

    const verified = await verifyFlutterwaveTransaction(String(transactionId))
    if (
      verified.tx_ref !== txRef ||
      verified.status !== 'successful' ||
      Number(verified.amount) !== Number(transaction.amount) ||
      String(verified.currency || '').toUpperCase() !== String(transaction.currency).toUpperCase()
    ) {
      return NextResponse.json({ error: 'Provider verification did not match the order.' }, { status: 400 })
    }

    const confirmation = await confirmVerifiedSubscriptionPayment({
      txRef,
      providerTransactionId: String(verified.id || transactionId),
      amount: Number(verified.amount),
      currency: String(verified.currency),
    })

    return NextResponse.json({ received: true, success: Boolean(confirmation?.success) })
  } catch {
    // Non-2xx allows the provider to retry if server/provider verification is
    // temporarily unavailable. The SQL function safely ignores duplicates.
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 })
  }
}

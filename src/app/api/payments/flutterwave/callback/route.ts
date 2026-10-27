import { NextResponse } from 'next/server'
import {
  confirmVerifiedSubscriptionPayment,
  createPaymentsAdminClient,
  verifyFlutterwaveTransaction,
} from '@/lib/payments/flutterwave'

export const runtime = 'nodejs'

function resultRedirect(requestUrl: string, result: string) {
  const url = new URL('/premium', requestUrl)
  url.searchParams.set('payment', result)
  return NextResponse.redirect(url)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const txRef = url.searchParams.get('tx_ref') || ''
  const transactionId = url.searchParams.get('transaction_id') || ''

  if (!txRef || !transactionId) {
    return resultRedirect(url.origin, 'not_verified')
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
      return resultRedirect(url.origin, 'not_verified')
    }

    if (transaction.status === 'succeeded') {
      return resultRedirect(url.origin, 'success')
    }

    const verified = await verifyFlutterwaveTransaction(transactionId)
    if (
      verified.tx_ref !== txRef ||
      verified.status !== 'successful' ||
      Number(verified.amount) !== Number(transaction.amount) ||
      String(verified.currency || '').toUpperCase() !== String(transaction.currency).toUpperCase()
    ) {
      return resultRedirect(url.origin, 'not_verified')
    }

    const confirmation = await confirmVerifiedSubscriptionPayment({
      txRef,
      providerTransactionId: String(verified.id || transactionId),
      amount: Number(verified.amount),
      currency: String(verified.currency),
    })

    if (!confirmation?.success) {
      return resultRedirect(url.origin, 'pending_review')
    }

    return resultRedirect(url.origin, 'success')
  } catch {
    // Keep the transaction pending if verification cannot be completed.
    // The signed provider webhook can retry confirmation later.
    return resultRedirect(url.origin, 'pending_review')
  }
}

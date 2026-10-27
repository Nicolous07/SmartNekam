import { createClient } from '@supabase/supabase-js'

type FlutterwaveVerification = {
  id?: number | string
  tx_ref?: string
  status?: string
  amount?: number | string
  currency?: string
  [key: string]: unknown
}

export function createPaymentsAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase server credentials are not configured.')
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function verifyFlutterwaveTransaction(transactionId: string): Promise<FlutterwaveVerification> {
  const secretKey = process.env.FLW_SECRET_KEY
  if (!secretKey) throw new Error('Flutterwave secret key is not configured.')

  const response = await fetch(
    'https://api.flutterwave.com/v3/transactions/' + encodeURIComponent(transactionId) + '/verify',
    {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + secretKey,
        Accept: 'application/json',
      },
      cache: 'no-store',
    },
  )

  const payload = await response.json().catch(() => null) as {
    status?: string
    message?: string
    data?: FlutterwaveVerification
  } | null

  if (!response.ok || payload?.status !== 'success' || !payload.data) {
    throw new Error('Flutterwave transaction verification failed.')
  }

  return payload.data
}

export async function confirmVerifiedSubscriptionPayment(args: {
  txRef: string
  providerTransactionId: string
  amount: number
  currency: string
}) {
  const admin = createPaymentsAdminClient()
  const { data, error } = await admin.rpc('confirm_flutterwave_subscription_payment', {
    p_tx_ref: args.txRef,
    p_provider_transaction_id: args.providerTransactionId,
    p_paid_amount: args.amount,
    p_paid_currency: args.currency,
  })

  if (error) throw new Error('Supabase could not confirm the verified transaction.')
  return data as { success?: boolean; already_processed?: boolean; period_end?: string } | null
}

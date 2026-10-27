import { redirect } from 'next/navigation'
import { SMARTNEKAM_PAYMENTS_ENABLED } from '@/lib/payments/feature'

// Wallet sasa iko ndani ya ukurasa wa Profile
export default function WalletPage() {
  redirect(SMARTNEKAM_PAYMENTS_ENABLED ? '/profile#wallet' : '/profile')
}

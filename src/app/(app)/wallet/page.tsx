import { redirect } from 'next/navigation'

// Wallet sasa iko ndani ya ukurasa wa Profile
export default function WalletPage() {
  redirect('/profile#wallet')
}

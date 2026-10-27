'use client'

import { useState } from 'react'
import { Gift, LoaderCircle } from 'lucide-react'

export default function XPRewardClaimButton({ rewardCode }: { rewardCode: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function claimReward() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/rewards/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardCode }),
      })
      const result = await response.json().catch(() => null) as {
        error?: string
        success?: boolean
      } | null

      if (!response.ok || !result?.success) {
        setError(result?.error || 'Zawadi haikudaiwa. Jaribu tena.')
        setBusy(false)
        return
      }

      window.location.assign('/premium?reward=claimed')
    } catch {
      setError('Mtandao umeshindwa kudai zawadi. Jaribu tena.')
      setBusy(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={claimReward}
        disabled={busy}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
      >
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
        {busy ? 'Inadai zawadi…' : 'Dai Pro reward'}
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-300">{error}</p>}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { ArrowUpRight, LoaderCircle } from 'lucide-react'

export default function PremiumPlanButton({ planSlug }: { planSlug: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function startCheckout() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/payments/flutterwave/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planSlug }),
      })
      const result = await response.json().catch(() => null) as {
        error?: string
        checkoutUrl?: string
      } | null

      if (!response.ok || !result?.checkoutUrl) {
        setError(result?.error || 'Checkout haikuanzishwa. Jaribu tena baadaye.')
        setBusy(false)
        return
      }

      window.location.assign(result.checkoutUrl)
    } catch {
      setError('Mtandao umeshindwa kufungua checkout. Angalia internet kisha jaribu tena.')
      setBusy(false)
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={startCheckout}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-60"
      >
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
        {busy ? 'Tunaandaa checkout…' : 'Chagua mpango'}
      </button>
      {error && <p role="alert" className="mt-2 text-xs leading-5 text-rose-600 dark:text-rose-300">{error}</p>}
    </div>
  )
}

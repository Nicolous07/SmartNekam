'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Loader2, Check } from 'lucide-react'
import { getDownloadUrl } from '@/app/(app)/library/actions'

export default function DownloadButton({
  itemId,
  cost,
  purchased,
}: {
  itemId: string
  cost: number
  purchased: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const needsPay = cost > 0 && !purchased

  async function onClick() {
    if (busy) return
    if (needsPay && !window.confirm(`Kupakua kunagharimu EduPoints ${cost}. Endelea?`)) return
    setBusy(true)
    setError('')
    const res = await getDownloadUrl(itemId)
    setBusy(false)
    if (res.error || !res.url) {
      setError(res.error ?? 'Imeshindikana kupakua.')
      return
    }
    setDone(true)
    window.location.assign(res.url)
    router.refresh()
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500 active:scale-95 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : done ? (
          <Check className="h-4 w-4" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {needsPay ? `Pakua (${cost} EduPoints)` : 'Pakua (Offline)'}
      </button>
      {cost > 0 && purchased && (
        <p className="mt-1 text-[11px] text-slate-500">Umeshalipia, kupakua tena ni bure.</p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ban, CheckCircle2, Loader2, ShieldOff, VolumeX } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ModerationActions({
  reportId,
  userId,
  isSanctioned,
}: {
  reportId: string
  userId: string
  isSanctioned: boolean
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function run(key: string, fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(key)
    setError('')
    const { error: rpcErr } = await fn()
    setBusy(null)
    if (rpcErr) {
      setError(rpcErr.message)
      return
    }
    router.refresh()
  }

  const btn =
    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-95 disabled:opacity-50'

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy !== null}
        onClick={() =>
          run('mute', () =>
            supabase.rpc('moderate_user', {
              p_user: userId,
              p_action: 'mute',
              p_hours: 24,
              p_reason: 'Ripoti ya jamii',
            })
          )
        }
        className={`${btn} bg-amber-500 text-white hover:bg-amber-400`}
      >
        {busy === 'mute' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <VolumeX className="h-3.5 w-3.5" />}
        Nyamazisha saa 24
      </button>

      <button
        type="button"
        disabled={busy !== null}
        onClick={() => {
          if (!window.confirm('Kumzuia mtumiaji huyu kuandika kabisa?')) return
          void run('ban', () =>
            supabase.rpc('moderate_user', {
              p_user: userId,
              p_action: 'ban',
              p_reason: 'Ripoti ya jamii',
            })
          )
        }}
        className={`${btn} bg-red-600 text-white hover:bg-red-500`}
      >
        {busy === 'ban' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
        Zuia kabisa
      </button>

      {isSanctioned && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run('unmute', () => supabase.rpc('moderate_user', { p_user: userId, p_action: 'unmute' }))}
          className={`${btn} border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800`}
        >
          {busy === 'unmute' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldOff className="h-3.5 w-3.5" />}
          Ondoa kizuizi
        </button>
      )}

      <button
        type="button"
        disabled={busy !== null}
        onClick={() => run('resolve', () => supabase.rpc('resolve_report', { p_report: reportId }))}
        className={`${btn} border border-emerald-500 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950`}
      >
        {busy === 'resolve' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        Funga ripoti
      </button>

      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  )
}

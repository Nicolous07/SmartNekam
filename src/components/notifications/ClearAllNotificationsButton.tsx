'use client'

import { useState } from 'react'
import { Loader2, Trash2, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ClearAllNotificationsButton({ hasNotifications }: { hasNotifications: boolean }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  async function clearAll() {
    if (!hasNotifications || busy) return

    const confirmed = window.confirm(
      'Una uhakika unataka kufuta taarifa ZOTE za akaunti yako? Hatua hii haiwezi kurejeshwa.'
    )
    if (!confirmed) return

    setBusy(true)
    setError('')
    setMessage('')

    try {
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('Kikao chako kimeisha. Ingia tena kisha ujaribu.')

      const { count, error: deleteError } = await supabase
        .from('notifications')
        .delete({ count: 'exact' })
        .eq('user_id', user.id)

      if (deleteError) throw deleteError

      setMessage(`${count ?? 0} taarifa zimefutwa.`)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Imeshindikana kufuta taarifa. Jaribu tena.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2" aria-live="polite">
      {message && (
        <p role="status" className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> {message}
        </p>
      )}
      {error && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{error}</p>}
      {hasNotifications && (
        <button
          type="button"
          onClick={() => void clearAll()}
          disabled={busy}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-extrabold text-rose-700 transition hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {busy ? 'Inafuta taarifa…' : 'Futa taarifa zote'}
        </button>
      )}
    </div>
  )
}

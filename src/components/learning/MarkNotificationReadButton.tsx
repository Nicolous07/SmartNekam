'use client'
import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function MarkNotificationReadButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function markRead() {
    if (busy || done) return
    setBusy(true)
    setError('')
    try {
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('Ingia tena kwenye akaunti yako kisha ujaribu tena.')
      const { data, error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)
        .select('id')
        .maybeSingle()
      if (updateError) throw updateError
      if (!data) throw new Error('Taarifa haikuweza kuwekwa kuwa imesomwa. Jaribu tena.')
      setDone(true)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Imeshindikana kuweka taarifa kuwa imesomwa.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button type="button" onClick={() => void markRead()} disabled={busy || done} aria-label="Weka taarifa kuwa imesomwa" title="Weka kuwa imesomwa" className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-100 px-2.5 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60 dark:border-slate-700 dark:text-emerald-300">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        {done ? 'Imesomwa' : busy ? 'Inahifadhi…' : 'Weka imesomwa'}
      </button>
      {error && <p role="alert" className="max-w-40 text-right text-[10px] text-rose-700 dark:text-rose-300">{error}</p>}
    </div>
  )
}

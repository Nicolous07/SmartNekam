'use client'
import { useState } from 'react'
import { Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
export default function MarkNotificationReadButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  async function markRead() {
    setBusy(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id)
    router.refresh(); setBusy(false)
  }
  return <button type="button" onClick={() => void markRead()} disabled={busy} aria-label="Weka taarifa kuwa imesomwa" title="Weka kuwa imesomwa" className="rounded-lg border border-emerald-100 p-2 text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50 dark:border-slate-700 dark:text-emerald-300"><Check className="h-4 w-4"/></button>
}

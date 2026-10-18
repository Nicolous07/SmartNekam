'use client'

import { useState } from 'react'
import { Bookmark, Check, ClipboardList, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function OpportunityActions({ opportunityId, deadline, saved = false }: { opportunityId: string; deadline: string | null; saved?: boolean }) {
  const [isSaved, setIsSaved] = useState(saved)
  const [busy, setBusy] = useState<'save' | 'apply' | null>(null)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function save() {
    setBusy('save'); setMessage('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setMessage('Ingia tena ili kuhifadhi fursa.'); setBusy(null); return }
    if (isSaved) {
      const { error } = await supabase.from('saved_opportunities').delete().eq('user_id', user.id).eq('opportunity_id', opportunityId)
      if (error) setMessage(error.message); else setIsSaved(false)
    } else {
      const { error } = await supabase.from('saved_opportunities').insert({ user_id: user.id, opportunity_id: opportunityId })
      if (error && error.code !== '23505') setMessage(error.message); else setIsSaved(true)
    }
    setBusy(null); router.refresh()
  }

  async function startApplication() {
    setBusy('apply'); setMessage('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setMessage('Ingia tena ili kuanza ombi.'); setBusy(null); return }
    const { error } = await supabase.from('applications').insert({ user_id: user.id, opportunity_id: opportunityId, deadline, status: 'not_started', checklist: [] })
    if (error?.code === '23505') setMessage('Fursa hii tayari ipo kwenye maombi yako.')
    else if (error) setMessage(error.message)
    else { setMessage('Ombi limeongezwa kwenye Application Tracker.'); router.refresh() }
    setBusy(null)
  }

  return <div className="mt-4 space-y-2">
    <div className="flex gap-2">
      <button type="button" onClick={() => void save()} disabled={busy !== null} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-teal-200 px-3 py-2.5 text-xs font-extrabold text-teal-800 transition hover:bg-teal-50 disabled:opacity-60 dark:border-teal-900 dark:text-teal-200 dark:hover:bg-teal-950/40">{busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin"/> : isSaved ? <Check className="h-4 w-4"/> : <Bookmark className="h-4 w-4"/>}{isSaved ? 'Imehifadhiwa' : 'Hifadhi'}</button>
      <button type="button" onClick={() => void startApplication()} disabled={busy !== null} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-600 px-3 py-2.5 text-xs font-extrabold text-white transition hover:bg-teal-500 disabled:opacity-60">{busy === 'apply' ? <Loader2 className="h-4 w-4 animate-spin"/> : <ClipboardList className="h-4 w-4"/>}Fuata ombi</button>
    </div>
    {message && <p role="status" className="text-xs leading-5 text-slate-600 dark:text-slate-300">{message}</p>}
  </div>
}

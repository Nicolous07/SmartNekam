'use client'

import { useState } from 'react'
import { Check, Loader2, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type ContentType = 'note'|'past_paper'|'textbook'|'opportunity'
export function ReviewContentActions({ id, type }: { id:string; type:ContentType }) {
  const supabase=createClient(); const router=useRouter()
  const [busy,setBusy]=useState(false); const [error,setError]=useState('')
  async function review(decision:'approve'|'reject') {
    const reason=decision==='reject'?window.prompt('Sababu ya kukataa (inaonekana kwa uploader):')?.trim()??'':' '
    if(decision==='reject'&&!reason.trim()) return
    setBusy(true);setError('')
    const {error:rpcError}=await supabase.rpc('review_library_content',{p_content_type:type,p_content_id:id,p_decision:decision,p_reason:decision==='reject'?reason:null})
    if(rpcError)setError(rpcError.message);else router.refresh()
    setBusy(false)
  }
  return <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={()=>void review('approve')} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50">{busy?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Check className="h-3.5 w-3.5"/>} Approve</button><button type="button" onClick={()=>void review('reject')} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-extrabold text-red-700 disabled:opacity-50 dark:border-red-900 dark:text-red-300"><X className="h-3.5 w-3.5"/> Reject</button>{error&&<p role="alert" className="basis-full text-xs text-red-700">{error}</p>}</div>
}
export function ReviewReportActions({ id }: {id:string}) {
  const supabase=createClient(); const router=useRouter(); const [busy,setBusy]=useState(false); const [error,setError]=useState('')
  async function review(decision:'investigating'|'resolved'|'dismissed') {
    setBusy(true);setError('')
    const note=window.prompt('Maelezo ya moderator (hiari):') ?? ''
    const {error:rpcError}=await supabase.rpc('review_content_report',{p_report_id:id,p_decision:decision,p_moderator_note:note})
    if(rpcError)setError(rpcError.message);else router.refresh()
    setBusy(false)
  }
  return <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={()=>void review('investigating')} className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-bold text-amber-800 disabled:opacity-50 dark:border-amber-900 dark:text-amber-200">Chunguza</button><button type="button" disabled={busy} onClick={()=>void review('resolved')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Tatuliwa</button><button type="button" disabled={busy} onClick={()=>void review('dismissed')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">Dismiss</button>{error&&<p role="alert" className="basis-full text-xs text-red-700">{error}</p>}</div>
}


export function AdminFeedPostActions({ postId, status }: { postId: string; status: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function removePost() {
    if (busy || status === 'removed') return
    if (!window.confirm('Una uhakika unataka kuondoa post hii kwenye Home Feed?')) return
    setBusy(true)
    setError('')
    try {
      const { data, error: updateError } = await supabase
        .from('posts')
        .update({ status: 'removed' })
        .eq('id', postId)
        .in('status', ['published', 'hidden'])
        .select('id')
        .maybeSingle()
      if (updateError) throw updateError
      if (!data) throw new Error('Post haijaondolewa. Hakikisha una ruhusa ya moderator na post bado ipo kwenye feed.')
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Imeshindikana kuondoa post.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => void removePost()} disabled={busy || status === 'removed'} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-extrabold text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        Ondoa post kwenye feed
      </button>
      {error && <p role="alert" className="basis-full text-xs text-red-700">{error}</p>}
    </div>
  )
}

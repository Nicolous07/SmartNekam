'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Plus, Send, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const field =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'

// ---------- Fomu: "Post My Skills" / "Find Team Members" ----------
export function TeamPostForm() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<'looking_for_members' | 'looking_for_team'>('looking_for_members')
  const [event, setEvent] = useState('')
  const [mySkills, setMySkills] = useState('')
  const [seeking, setSeeking] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (event.trim().length < 3) return setError('Andika jina la hackathon / mashindano.')
    if (mySkills.trim().length < 2) return setError('Andika ujuzi wako.')
    setBusy(true)
    setError('')
    const { error: err } = await supabase.from('opp_team_posts').insert({
      kind,
      event_title: event.trim(),
      my_skills: mySkills.trim(),
      seeking_skills: seeking.trim() || null,
      message: message.trim() || null,
    })
    setBusy(false)
    if (err) return setError('Imeshindikana kuchapisha. Jaribu tena.')
    setEvent('')
    setMySkills('')
    setSeeking('')
    setMessage('')
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500 active:scale-95"
      >
        <Plus className="h-4 w-4" /> Find Team Members / Post My Skills
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="geometric-card space-y-3 p-4">
      <div className="flex gap-2">
        {(
          [
            ['looking_for_members', 'Natafuta wanatimu'],
            ['looking_for_team', 'Natafuta timu ya kujiunga'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
              kind === k
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <input value={event} onChange={(e) => setEvent(e.target.value.slice(0, 140))} placeholder="Hackathon / mashindano (mf. Tanzania Innovation Challenge)" className={field} />
      <input value={mySkills} onChange={(e) => setMySkills(e.target.value.slice(0, 300))} placeholder="Ujuzi wangu (mf. Computer Science, Python)" className={field} />
      <input value={seeking} onChange={(e) => setSeeking(e.target.value.slice(0, 300))} placeholder="Ujuzi ninaotafuta (mf. Business, UI/UX Design)" className={field} />
      <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 600))} rows={3} placeholder="Ujumbe mfupi (hiari)" className={`${field} resize-none`} />
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          Ghairi
        </button>
        <button type="submit" disabled={busy} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Chapisha
        </button>
      </div>
    </form>
  )
}

// ---------- Vitendo kwenye kadi ya post ----------
export function TeamCardActions({
  postId,
  mine,
  myRequestStatus,
}: {
  postId: string
  mine: boolean
  myRequestStatus: 'pending' | 'accepted' | 'declined' | null
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function closePost() {
    if (!window.confirm('Funga post hii?')) return
    setBusy(true)
    await supabase.from('opp_team_posts').update({ status: 'closed' }).eq('id', postId)
    setBusy(false)
    router.refresh()
  }

  async function sendRequest() {
    if (busy) return
    setBusy(true)
    setError('')
    const { error: err } = await supabase
      .from('opp_team_requests')
      .insert({ post_id: postId, message: text.trim() || null })
    setBusy(false)
    if (err) {
      setError(err.code === '23505' ? 'Tayari umeshatuma ombi.' : 'Imeshindikana kutuma ombi.')
      return
    }
    setOpen(false)
    router.refresh()
  }

  if (mine) {
    return (
      <button type="button" onClick={closePost} disabled={busy} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
        Funga post
      </button>
    )
  }

  if (myRequestStatus) {
    const map = {
      pending: ['Ombi linasubiri jibu', 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'],
      accepted: ['Ombi limekubaliwa', 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'],
      declined: ['Ombi halikukubaliwa', 'bg-slate-100 text-slate-500 dark:bg-slate-800'],
    } as const
    const [label, cls] = map[myRequestStatus]
    return <span className={`rounded-full px-3 py-1 text-xs font-bold ${cls}`}>{label}</span>
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500">
        <Send className="h-3.5 w-3.5" /> Tuma ombi
      </button>
    )
  }

  return (
    <div className="w-full space-y-2">
      <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 500))} rows={2} placeholder="Jitambulishe kwa ufupi na ujuzi wako..." className={`${field} resize-none`} />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={sendRequest} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Tuma
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          Ghairi
        </button>
      </div>
    </div>
  )
}

// ---------- Maombi yaliyoingia kwenye post zangu ----------
export type IncomingRequest = {
  id: string
  eventTitle: string
  requesterName: string
  message: string | null
  status: 'pending' | 'accepted' | 'declined'
}

export function IncomingRequests({ items }: { items: IncomingRequest[] }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [busyId, setBusyId] = useState<string | null>(null)

  async function decide(id: string, status: 'accepted' | 'declined') {
    setBusyId(id)
    await supabase.from('opp_team_requests').update({ status }).eq('id', id)
    setBusyId(null)
    router.refresh()
  }

  if (items.length === 0) return null

  return (
    <section className="geometric-card space-y-3 p-4">
      <h3 className="font-heading text-base font-bold text-slate-900 dark:text-slate-100">Maombi kwenye post zako</h3>
      <ul className="space-y-2">
        {items.map((r) => (
          <li key={r.id} className="rounded-lg bg-emerald-50 p-3 dark:bg-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {r.requesterName} <span className="font-normal text-slate-500">· {r.eventTitle}</span>
            </p>
            {r.message && <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{r.message}</p>}
            {r.status === 'pending' ? (
              <div className="mt-2 flex gap-2">
                <button type="button" disabled={busyId === r.id} onClick={() => decide(r.id, 'accepted')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">
                  <Check className="h-3.5 w-3.5" /> Kubali
                </button>
                <button type="button" disabled={busyId === r.id} onClick={() => decide(r.id, 'declined')} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 disabled:opacity-60 dark:bg-red-950 dark:text-red-300">
                  <X className="h-3.5 w-3.5" /> Kataa
                </button>
              </div>
            ) : (
              <p className={`mt-1 text-xs font-bold ${r.status === 'accepted' ? 'text-emerald-600' : 'text-slate-400'}`}>
                {r.status === 'accepted' ? 'Umekubali' : 'Umekataa'}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Globe2, Loader2, Lock, Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function CreateGroupButton() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function create() {
    const clean = name.trim()
    if (clean.length < 3) {
      setError('Jina la kikundi liwe na angalau herufi 3.')
      return
    }
    setBusy(true)
    setError('')
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError('Tafadhali ingia tena.')
      setBusy(false)
      return
    }
    // Tunaunda id upande wa app ili tuweze kwenda kwenye chumba mara moja
    const id = crypto.randomUUID()
    const { error: insErr } = await supabase.from('chat_rooms').insert({
      id,
      kind: 'group',
      name: clean,
      description: description.trim() || null,
      visibility,
      created_by: user.id,
    })
    setBusy(false)
    if (insErr) {
      setError(
        insErr.message.includes('group_limit')
          ? 'Umefikia kikomo cha vikundi 10. Futa kimoja kwanza.'
          : 'Imeshindikana kuunda kikundi. Jaribu tena.'
      )
      return
    }
    setOpen(false)
    router.push(`/communities/room/${id}`)
  }

  const modal = (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="anim-fade-in absolute inset-0 bg-black/60" onClick={() => !busy && setOpen(false)} />
      <div className="geometric-card anim-sheet-up relative z-10 w-full max-w-md rounded-b-none sm:rounded-b-2xl">
        <div className="flex items-center justify-between border-b border-emerald-100 px-4 py-3 dark:border-slate-800">
          <h2 className="font-extrabold text-slate-900 dark:text-white">Unda kikundi cha masomo</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Funga"
            className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
              Jina la kikundi
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 60))}
              placeholder="Mfano: Form 6 PCB NECTA 2027 Revision"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
              Maelezo (si lazima)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 280))}
              rows={2}
              placeholder="Kikundi hiki kinahusu nini?"
              className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { v: 'public', label: 'Wazi', hint: 'Yeyote anaweza kujiunga', icon: Globe2 },
                { v: 'private', label: 'Siri', hint: 'Kwa kiungo cha mwaliko pekee', icon: Lock },
              ] as const
            ).map(({ v, label, hint, icon: Icon }) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className={`rounded-xl border-2 p-3 text-left transition active:scale-[0.98] ${
                  visibility === v
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50'
                    : 'border-slate-200 hover:border-emerald-300 dark:border-slate-700'
                }`}
              >
                <Icon className="h-4 w-4 text-emerald-600" />
                <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">{label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
              </button>
            ))}
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 p-2.5 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={create}
            disabled={busy || name.trim().length < 3}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? 'Inaunda...' : 'Unda kikundi'}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500 active:scale-95"
      >
        <Plus className="h-4 w-4" /> Unda kikundi
      </button>
      {open && createPortal(modal, document.body)}
    </>
  )
}

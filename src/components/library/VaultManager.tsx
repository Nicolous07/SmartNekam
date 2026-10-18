'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Loader2, Lock, Plus, Trash2, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export type VaultDoc = { id: string; title: string; file_path: string; mime: string; created_at: string }

const MAX_MB = 10
const field =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'

export default function VaultManager({ docs }: { docs: VaultDoc[] }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const fileRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [openingId, setOpeningId] = useState<string | null>(null)

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.type !== 'application/pdf' && !f.type.startsWith('image/')) {
      setError('Chagua PDF au picha.')
      return
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`Faili liwe chini ya ${MAX_MB}MB.`)
      return
    }
    setError('')
    setFile(f)
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, '').slice(0, 120))
  }

  async function add() {
    if (busy) return
    const t = title.trim()
    if (t.length < 2) return setError('Andika jina la nyaraka.')
    if (!file) return setError('Chagua faili.')
    setBusy(true)
    setError('')
    let uploaded: string | null = null
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Tafadhali ingia tena.')
      const ext = (file.name.split('.').pop() || 'pdf').toLowerCase()
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from('vault').upload(path, file, { contentType: file.type })
      if (upErr) throw upErr
      uploaded = path
      const { error: insErr } = await supabase
        .from('vault_documents')
        .insert({ user_id: user.id, title: t, file_path: path, mime: file.type })
      if (insErr) throw insErr
      setTitle('')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    } catch (e) {
      if (uploaded) await supabase.storage.from('vault').remove([uploaded])
      setError(e instanceof Error ? e.message : 'Imeshindikana kuhifadhi.')
    } finally {
      setBusy(false)
    }
  }

  async function open(doc: VaultDoc) {
    setOpeningId(doc.id)
    setError('')
    // Fungua dirisha mara moja (ili kivinjari kisilizuie), kisha weka kiungo cha muda mfupi
    const w = window.open('', '_blank')
    const { data, error: e } = await supabase.storage.from('vault').createSignedUrl(doc.file_path, 60)
    setOpeningId(null)
    if (e || !data) {
      w?.close()
      setError('Imeshindikana kufungua nyaraka.')
      return
    }
    if (w) {
      w.opener = null
      w.location.href = data.signedUrl
    }
  }

  async function remove(doc: VaultDoc) {
    if (!window.confirm(`Futa "${doc.title}" kabisa?`)) return
    await supabase.storage.from('vault').remove([doc.file_path])
    await supabase.from('vault_documents').delete().eq('id', doc.id)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <section className="geometric-card space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-heading text-base font-bold text-slate-900 dark:text-slate-100">
          <Plus className="h-4 w-4 text-emerald-600" /> Hifadhi nyaraka mpya
        </h2>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 120))}
          placeholder="mf. Cheti cha Form 4"
          className={field}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="min-w-0 flex-1 truncate rounded-lg border border-dashed border-slate-300 px-3 py-2 text-left text-sm text-slate-600 hover:bg-emerald-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {file ? file.name : `Chagua faili (PDF/picha, hadi ${MAX_MB}MB)`}
          </button>
          <button
            type="button"
            onClick={add}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Hifadhi
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/pdf,image/*" onChange={onPick} className="hidden" />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">{error}</p>}
      </section>

      {docs.length === 0 ? (
        <div className="geometric-card p-6 text-center text-sm text-slate-500 dark:text-slate-400">
          <Lock className="mx-auto mb-2 h-6 w-6 text-emerald-600" />
          Kabati lako ni tupu. Hifadhi vyeti vyako hapa ili uvitumie unapoomba vyuo au scholarships.
        </div>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="geometric-card flex items-center gap-3 p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <FileText className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{d.title}</p>
                <p className="text-xs text-slate-500">
                  {new Date(d.created_at).toLocaleDateString('sw-TZ', { dateStyle: 'medium' })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => open(d)}
                disabled={openingId === d.id}
                aria-label="Fungua"
                className="rounded-full p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-slate-800"
              >
                {openingId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => remove(d)}
                aria-label="Futa"
                className="rounded-full p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-slate-800"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

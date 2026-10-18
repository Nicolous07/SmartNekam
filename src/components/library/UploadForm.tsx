'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, UploadCloud, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  CATEGORIES,
  COUNTRIES,
  LEVELS,
  SUBJECTS,
  MAX_IMAGE_MB,
  MAX_PDF_MB,
  UPLOAD_REWARD_POINTS,
} from '@/lib/library'

const field =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
const label = 'block text-xs font-semibold uppercase tracking-wide text-slate-500'

export default function UploadForm({ defaultCountry }: { defaultCountry: string }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const fileRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<string>('notes')
  const [country, setCountry] = useState(defaultCountry)
  const [level, setLevel] = useState<string>('a_level')
  const [subject, setSubject] = useState('')
  const [year, setYear] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const isPdf = f.type === 'application/pdf'
    const isImg = f.type.startsWith('image/')
    if (!isPdf && !isImg) {
      setError('Chagua PDF au picha ya maandishi safi.')
      return
    }
    const max = (isPdf ? MAX_PDF_MB : MAX_IMAGE_MB) * 1024 * 1024
    if (f.size > max) {
      setError(`Faili liwe chini ya ${isPdf ? MAX_PDF_MB : MAX_IMAGE_MB}MB.`)
      return
    }
    setError('')
    setFile(f)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const t = title.trim()
    if (t.length < 3) return setError('Andika jina la nyenzo (angalau herufi 3).')
    if (!file) return setError('Chagua faili la kupakia.')

    const yearNum = year ? parseInt(year, 10) : null
    if (yearNum !== null && (!Number.isFinite(yearNum) || yearNum < 1980 || yearNum > new Date().getFullYear() + 1)) {
      return setError('Mwaka si sahihi.')
    }

    setBusy(true)
    setError('')
    let uploadedPath: string | null = null
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Tafadhali ingia tena.')

      const ext = (file.name.split('.').pop() || (file.type === 'application/pdf' ? 'pdf' : 'jpg')).toLowerCase()
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('library-files')
        .upload(path, file, { contentType: file.type })
      if (upErr) throw upErr
      uploadedPath = path

      const { error: insErr } = await supabase.from('library_items').insert({
        title: t,
        description: description.trim() || null,
        category,
        country_code: category === 'stem' ? 'GLOBAL' : country,
        level,
        subject: subject || null,
        year: yearNum,
        file_path: path,
        mime: file.type,
        uploaded_by: user.id,
      })
      if (insErr) throw insErr

      setSent(true)
      router.refresh()
    } catch (err) {
      if (uploadedPath) await supabase.storage.from('library-files').remove([uploadedPath])
      setError(err instanceof Error ? err.message : 'Imeshindikana kutuma. Jaribu tena.')
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="geometric-card space-y-3 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <h2 className="font-heading text-lg font-bold text-slate-900 dark:text-white">Asante kwa kushare!</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Nyenzo yako imetumwa kwa uhakiki. Ikithibitishwa itaonekana kwenye Library ya umma na utapata{' '}
          <b>{UPLOAD_REWARD_POINTS} EduPoints</b> za zawadi.
        </p>
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSent(false)
              setTitle('')
              setDescription('')
              setFile(null)
              if (fileRef.current) fileRef.current.value = ''
            }}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Weka nyingine
          </button>
          <button
            type="button"
            onClick={() => router.push('/library')}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500"
          >
            Rudi Library
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="geometric-card space-y-4 p-4 sm:p-6">
      <div>
        <label className={label} htmlFor="t">Jina la kitabu / notisi</label>
        <input
          id="t"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 160))}
          placeholder="mf. Advanced Physics Mechanics Summary Notes"
          className={`${field} mt-1`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="c">Aina</label>
          <select id="c" value={category} onChange={(e) => setCategory(e.target.value)} className={`${field} mt-1`}>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.long}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="n">Nchi na Mtaala</label>
          <select
            id="n"
            value={category === 'stem' ? 'GLOBAL' : country}
            disabled={category === 'stem'}
            onChange={(e) => setCountry(e.target.value)}
            className={`${field} mt-1 disabled:opacity-60`}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label} ({c.exam})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="l">Kiwango</label>
          <select id="l" value={level} onChange={(e) => setLevel(e.target.value)} className={`${field} mt-1`}>
            {LEVELS.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="s">Somo</label>
          <select id="s" value={subject} onChange={(e) => setSubject(e.target.value)} className={`${field} mt-1`}>
            <option value="">Chagua somo</option>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="y">Mwaka (hiari, kwa past papers)</label>
          <input
            id="y"
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="mf. 2023"
            className={`${field} mt-1`}
          />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="d">Maelezo mafupi (hiari)</label>
        <textarea
          id="d"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
          className={`${field} mt-1 resize-none`}
        />
      </div>

      <div>
        <p className={label}>Faili (PDF au picha ya maandishi safi)</p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-1 flex w-full items-center gap-3 rounded-lg border border-dashed border-slate-300 px-4 py-4 text-left text-sm text-slate-600 transition hover:bg-emerald-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <UploadCloud className="h-5 w-5 shrink-0 text-emerald-600" />
          <span className="min-w-0 flex-1 truncate">
            {file ? file.name : `Bofya kuchagua faili (PDF hadi ${MAX_PDF_MB}MB)`}
          </span>
        </button>
        <input ref={fileRef} type="file" accept="application/pdf,image/*" onChange={onPick} className="hidden" />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">{error}</p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {busy ? 'Inatuma...' : 'Tuma kwa uhakiki'}
      </button>
      <p className="text-center text-[11px] text-slate-400">
        Admin atakagua kabla ya kuonekana kwa umma. Ukithibitishwa unapata {UPLOAD_REWARD_POINTS} EduPoints.
      </p>
    </form>
  )
}

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, X, ImagePlus, Loader2, Table2, Eye, Pencil, EyeOff,
  Paperclip, FileText, FileImage, Video as VideoIcon, File as FileIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import RichContent from '@/components/posts/RichContent'

type SelectedAttachment = { file: File; previewUrl: string | null }
type UploadedAttachment = { url: string; name: string; mime_type: string; size_bytes: number }

const TABLE_TEMPLATE = '\n| Kipengele | Hatua | Jibu |\n|---|---|---|\n| | | |\n| | | |\n'
const CATEGORIES = [
  { value: 'academics', label: 'Masomo' },
  { value: 'guidance', label: 'Ushauri' },
  { value: 'campus_life', label: 'Maisha ya chuo' },
] as const
const SUBJECTS = [
  'Mathematics', 'Biology', 'Physics', 'Chemistry', 'General Studies', 'English',
  'Kiswahili', 'History', 'Geography', 'Computer Science', 'Nyingine',
]
const MAX_CHARS = 5000
const MAX_FILES = 5
const MAX_FILE_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/3gpp', 'video/x-m4v',
  'application/pdf',
  'text/plain', 'text/csv', 'application/msword', 'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
])

function formatBytes(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export default function CreatePostButton() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const fileRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const attachmentsRef = useRef<SelectedAttachment[]>([])

  const [showPreview, setShowPreview] = useState(false)
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['value']>('academics')
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [attachments, setAttachments] = useState<SelectedAttachment[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  attachmentsRef.current = attachments
  useEffect(() => {
    const openComposer = () => { setOpen(true); setError('') }
    window.addEventListener('smartnekam:create-post', openComposer)
    return () => window.removeEventListener('smartnekam:create-post', openComposer)
  }, [])
  useEffect(() => () => {
    attachmentsRef.current.forEach(({ previewUrl }) => { if (previewUrl) URL.revokeObjectURL(previewUrl) })
  }, [])

  // Jedwali bado linaweza kuingizwa kwa urahisi; alama ghafi za fomula zimeondolewa.
  function insertSnippet(snippet: string) {
    const el = textRef.current
    const start = el?.selectionStart ?? content.length
    const end = el?.selectionEnd ?? content.length
    const selected = content.slice(start, end)
    const hasCursorMarker = snippet.includes('|') && !snippet.startsWith('\n|')
    const inserted = hasCursorMarker ? snippet.replace('|', selected) : snippet
    const next = (content.slice(0, start) + inserted + content.slice(end)).slice(0, MAX_CHARS)
    setContent(next)
    setShowPreview(false)
    const caret = Math.min(next.length, start + snippet.length)
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(caret, caret) })
  }

  function reset() {
    attachments.forEach(({ previewUrl }) => { if (previewUrl) URL.revokeObjectURL(previewUrl) })
    setShowPreview(false); setCategory('academics'); setSubject('')
    setContent(''); setAnonymous(false); setAttachments([]); setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  function close() {
    if (busy) return
    setOpen(false)
  }

  function onPickAttachments(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setError('')
    const accepted: SelectedAttachment[] = []
    for (const file of files) {
      if (!ALLOWED_TYPES.has(file.type)) {
        setError(`${file.name}: aina hii ya faili hairuhusiwi. Tumia picha, video fupi (MP4/WebM/MOV), PDF, Word, Excel, PowerPoint, TXT au CSV.`)
        continue
      }
      if (file.size > MAX_FILE_BYTES) {
        setError(`${file.name}: faili lisizidi 10 MB.`)
        continue
      }
      if (attachments.length + accepted.length >= MAX_FILES) {
        setError(`Unaweza kuambatisha faili zisizozidi ${MAX_FILES} kwa post moja.`)
        break
      }
      if (attachments.some((item) => item.file.name === file.name && item.file.size === file.size) || accepted.some((item) => item.file.name === file.name && item.file.size === file.size)) continue
      accepted.push({ file, previewUrl: file.type.startsWith('image/') || file.type.startsWith('video/') ? URL.createObjectURL(file) : null })
    }
    if (accepted.length) setAttachments((current) => [...current, ...accepted].slice(0, MAX_FILES))
    e.target.value = ''
  }

  function removeAttachment(index: number) {
    const item = attachments[index]
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
    setAttachments((current) => current.filter((_, i) => i !== index))
    if (fileRef.current) fileRef.current.value = ''
  }

  async function submit() {
    const text = content.trim()
    if (text.length < 3) { setError('Andika angalau herufi 3 ili wanafunzi waelewe unachoshiriki.'); return }
    setBusy(true); setError('')
    const uploadedPaths: string[] = []
    let postInserted = false
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Tafadhali ingia tena.')

      const uploaded: UploadedAttachment[] = []
      for (const item of attachments) {
        const file = item.file
        const ext = (file.name.split('.').pop() || 'file').toLowerCase().replace(/[^a-z0-9]/g, '') || 'file'
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage.from('post-attachments').upload(path, file, {
          cacheControl: '3600', upsert: false, contentType: file.type,
        })
        if (uploadError) throw new Error(`Faili “${file.name}” halikupakiwa. Hakikisha SQL 018 imeendeshwa. ${uploadError.message}`)
        uploadedPaths.push(path)
        const url = supabase.storage.from('post-attachments').getPublicUrl(path).data.publicUrl
        uploaded.push({ url, name: file.name, mime_type: file.type, size_bytes: file.size })
      }
      const firstImage = uploaded.find((file) => file.mime_type.startsWith('image/'))
      const { error: insertError } = await supabase.from('posts').insert({
        author_id: user.id,
        category,
        subject: category === 'academics' && subject ? subject : null,
        content: text,
        image_url: firstImage?.url ?? null,
        attachments: uploaded,
        is_anonymous: anonymous,
      })
      if (insertError) throw new Error(insertError.message.includes('attachments')
        ? 'Sehemu ya attachments haipo bado kwenye database. Endesha SQL 018 kisha ujaribu tena.'
        : insertError.message)
      postInserted = true
      reset(); setOpen(false); router.refresh()
    } catch (e) {
      if (!postInserted && uploadedPaths.length) {
        const { error: cleanupError } = await supabase.storage.from('post-attachments').remove(uploadedPaths)
        if (cleanupError) console.warn('SmartNekam attachment cleanup:', cleanupError.message)
      }
      setError(e instanceof Error ? e.message : 'Imeshindikana kuchapisha. Jaribu tena.')
    } finally { setBusy(false) }
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label="Chapisha kitu kipya" className="anim-scale-in anim-delay-3 fixed bottom-24 right-4 z-[45] hidden h-14 w-14 touch-manipulation items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-900/30 transition-all duration-300 hover:scale-105 hover:bg-emerald-500 active:scale-95 lg:bottom-6 lg:right-6 lg:flex"><Plus className="h-7 w-7"/></button>
    {open && <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Funga dirisha la post" onClick={close} className="anim-fade-in absolute inset-0 bg-black/60" />
      <section role="dialog" aria-modal="true" aria-labelledby="create-post-heading" className="geometric-card anim-sheet-up relative z-10 flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl sm:max-w-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-emerald-100 px-4 py-3.5 dark:border-slate-800 sm:px-5"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-700 dark:text-emerald-300">SmartNekam community</p><h2 id="create-post-heading" className="mt-0.5 font-heading text-lg font-black text-slate-950 dark:text-white">Andaa post yako</h2></div><button type="button" onClick={close} disabled={busy} aria-label="Funga" className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5"/></button></div>

        <div className="space-y-4 overflow-y-auto p-4 sm:p-5">
          <div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Aina ya post</p><div className="flex flex-wrap gap-2">{CATEGORIES.map((item) => <button key={item.value} type="button" onClick={() => setCategory(item.value)} className={`rounded-full border px-3.5 py-2 text-sm font-bold transition ${category === item.value ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}>{item.label}</button>)}</div></div>

          {category === 'academics' && <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">Somo (hiari)</span><select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="">Chagua somo</option>{SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>}

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-3 transition hover:border-emerald-300 dark:border-slate-700"><input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="mt-1 h-4 w-4 accent-emerald-600"/><span><span className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900 dark:text-white"><EyeOff className="h-4 w-4 text-emerald-600"/> Chapisha bila kuonyesha jina</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">Jina halitaonekana kwa wanafunzi wengine kwenye post hii.</span></span></label>

          <div><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><label htmlFor="post-content" className="text-xs font-bold uppercase tracking-wide text-slate-500">Maandishi ya post</label><div className="flex flex-wrap gap-1.5"><button type="button" onClick={() => insertSnippet(TABLE_TEMPLATE)} title="Ingiza jedwali" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><Table2 className="h-4 w-4"/> Jedwali</button><button type="button" onClick={() => setShowPreview((v) => !v)} aria-pressed={showPreview} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${showPreview ? 'bg-emerald-600 text-white' : 'border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200'}`}>{showPreview ? <Pencil className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}{showPreview ? 'Hariri' : 'Hakiki'}</button></div></div>

            {showPreview ? <div className="min-h-40 rounded-2xl border border-emerald-200 bg-white p-4 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">{content.trim() ? <RichContent text={content} className="leading-7"/> : <p className="text-slate-400">Hakuna maandishi ya kuhakiki bado.</p>}</div> : <textarea id="post-content" ref={textRef} value={content} onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))} rows={7} placeholder={'Andika swali, ufafanuzi, ushauri au mafanikio yako kwa lugha rahisi. Unaweza kutumia maandishi ya kawaida, mistari na jedwali.'} className="min-h-40 w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm leading-7 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-emerald-900/30"/>}
            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-400"><span>Tumia maandishi rahisi, mistari au jedwali ili ujumbe wako ueleweke kwa urahisi.</span><span className="shrink-0">{content.length}/{MAX_CHARS}</span></div>
          </div>

          <section className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/50 p-3 dark:border-emerald-900 dark:bg-emerald-950/20"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-start gap-2.5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"><Paperclip className="h-5 w-5"/></span><div><p className="text-sm font-extrabold text-slate-900 dark:text-white">Attachments / Viambatisho</p><p className="mt-0.5 text-xs leading-5 text-slate-500">Picha na video fupi (MP4, WebM, MOV), PDF, Word, Excel, PowerPoint, TXT au CSV · hadi faili 5, 10 MB kila moja.</p></div></div><button type="button" onClick={() => fileRef.current?.click()} disabled={attachments.length >= MAX_FILES || busy} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-extrabold text-emerald-800 shadow-sm ring-1 ring-emerald-200 transition hover:bg-emerald-100 disabled:opacity-50 dark:bg-slate-900 dark:text-emerald-200 dark:ring-emerald-900"><Plus className="h-4 w-4"/> Ambatisha faili</button></div>
            <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,video/3gpp,video/x-m4v,application/pdf,text/plain,text/csv,application/msword,application/vnd.ms-excel,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange={onPickAttachments} className="hidden"/>
            {attachments.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{attachments.map((item, index) => <div key={`${item.file.name}-${item.file.size}-${index}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-emerald-100 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">{item.file.type.startsWith('image/') && item.previewUrl ? <img src={item.previewUrl} alt={`Preview ${item.file.name}`} className="h-12 w-12 shrink-0 rounded-lg object-cover"/> : item.file.type.startsWith('video/') && item.previewUrl ? <video src={item.previewUrl} aria-label={`Preview ${item.file.name}`} muted playsInline preload="metadata" controls className="h-12 w-16 shrink-0 rounded-lg bg-black object-cover"/> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-emerald-700 dark:bg-slate-800 dark:text-emerald-200">{item.file.type.startsWith('video/') ? <VideoIcon className="h-5 w-5"/> : item.file.type.startsWith('image/') ? <FileImage className="h-5 w-5"/> : item.file.type === 'application/pdf' ? <FileText className="h-5 w-5"/> : <FileIcon className="h-5 w-5"/>}</span>}<span className="min-w-0 flex-1"><span className="block truncate text-xs font-extrabold text-slate-900 dark:text-white">{item.file.name}</span><span className="mt-1 block text-[10px] text-slate-500">{formatBytes(item.file.size)}</span></span><button type="button" onClick={() => removeAttachment(index)} disabled={busy} aria-label={`Ondoa ${item.file.name}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"><X className="h-4 w-4"/></button></div>)}</div>}
          </section>

          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-emerald-100 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/80 sm:px-5"><p className="hidden text-xs text-slate-500 sm:block">Andika kwa lugha iliyo wazi ili kila mwanafunzi aelewe.</p><div className="ml-auto flex gap-2"><button type="button" onClick={close} disabled={busy} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">Ghairi</button><button type="button" onClick={() => void submit()} disabled={busy || content.trim().length < 3} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-emerald-500 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <Plus className="h-4 w-4"/>}{busy ? 'Inapakia na kuchapisha...' : 'Chapisha post'}</button></div></div>
      </section>
    </div>}
  </>
}

'use client'

import { FormEvent, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookMarked, FileUp, Loader2, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Subject = { id: string; name: string; level: string }
type ResourceKind = 'notes' | 'past_papers' | 'textbooks'

export default function SmartNekamUploadForm({ subjects, initialType = 'notes' }: { subjects: Subject[]; initialType?: string }) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [kind, setKind] = useState<ResourceKind>(initialType === 'past_papers' ? 'past_papers' : initialType === 'textbooks' ? 'textbooks' : 'notes')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [level, setLevel] = useState('O_LEVEL')
  const [subjectId, setSubjectId] = useState('')
  const [customSubject, setCustomSubject] = useState('')
  const [examType, setExamType] = useState('NECTA')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [author, setAuthor] = useState('')
  const [publisher, setPublisher] = useState('')
  const [publicationYear, setPublicationYear] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const filteredSubjects = subjects.filter((s) => s.level === level)
  const selectedSubject = filteredSubjects.find((s) => s.id === subjectId)
  const needsCustomSubject = selectedSubject?.name.trim().toLowerCase() === 'others' || selectedSubject?.name.trim().toLowerCase() === 'other' || selectedSubject?.name.trim().toLowerCase() === 'masomo mengine'

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null); setSuccess(false)
    if (!subjectId) { setError('Chagua somo kwanza.'); return }
    if (needsCustomSubject && !customSubject.trim()) { setError('Andika jina la somo kwenye sehemu ya Others.'); return }
    if (!file) { setError('Chagua faili la kupakia.'); return }
    if (file.size > 25 * 1024 * 1024) { setError('Faili lisizidi MB 25.'); return }
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const common = ['pdf', 'docx', 'pptx', 'jpg', 'jpeg', 'png']
    const allowed = kind === 'textbooks' ? [...common, 'epub'] : common
    if (!allowed.includes(ext)) { setError(kind === 'textbooks' ? 'Aina zinazokubalika: PDF, EPUB, DOCX, PPTX, JPG au PNG.' : 'Aina zinazokubalika: PDF, DOCX, PPTX, JPG au PNG.'); return }
    if (kind === 'past_papers' && ext !== 'pdf') { setError('Past papers zinapaswa kuwa PDF.'); return }
    if (kind !== 'past_papers' && !description.trim()) { setError('Andika maelezo mafupi ya nyenzo.'); return }
    if (kind === 'textbooks' && publicationYear.trim() && (!Number.isInteger(Number(publicationYear)) || Number(publicationYear) < 1450 || Number(publicationYear) > 2200)) { setError('Weka mwaka wa kuchapishwa ulio sahihi.'); return }
    setBusy(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Ingia tena kabla ya kupakia.')
      const path = `${user.id}/${kind}/${crypto.randomUUID()}.${ext}`
      const mimeFallback = ext === 'epub' ? 'application/epub+zip' : 'application/octet-stream'
      const { error: uploadError } = await supabase.storage.from('learning-resources').upload(path, file, { contentType: file.type || mimeFallback, upsert: false })
      if (uploadError) throw uploadError
      const metadata = { uploader_id: user.id, subject_id: subjectId, custom_subject: needsCustomSubject ? customSubject.trim().slice(0, 100) : null, level, title: title.trim(), description: description.trim(), storage_path: path, file_type: ext, file_size_bytes: file.size, status: 'pending' }
      let insertError: { message: string } | null = null
      if (kind === 'notes') {
        const result = await supabase.from('notes').insert(metadata)
        insertError = result.error
      } else if (kind === 'past_papers') {
        const result = await supabase.from('past_papers').insert({
          uploader_id: user.id,
          subject_id: subjectId,
          custom_subject: needsCustomSubject ? customSubject.trim().slice(0, 100) : null,
          level,
          exam_type: examType,
          year: Number(year),
          title: title.trim(),
          storage_path: path,
          file_type: ext,
          file_size_bytes: file.size,
          status: 'pending',
        })
        insertError = result.error
      } else {
        const result = await supabase.from('textbooks').insert({
          ...metadata,
          author: author.trim() || null,
          publisher: publisher.trim() || null,
          publication_year: publicationYear ? Number(publicationYear) : null,
        })
        insertError = result.error
      }
      if (insertError) {
        await supabase.storage.from('learning-resources').remove([path])
        throw insertError
      }
      setSuccess(true)
      setTitle(''); setDescription(''); setCustomSubject(''); setAuthor(''); setPublisher(''); setPublicationYear(''); setFile(null)
      const input = document.getElementById('resource-file') as HTMLInputElement | null
      if (input) input.value = ''
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Imeshindikana kupakia nyenzo. Jaribu tena.')
    } finally { setBusy(false) }
  }

  const tabClass = (selected: boolean) => `rounded-xl px-2 py-2.5 text-xs font-extrabold transition sm:px-3 sm:text-sm ${selected ? 'sn-primary-gradient text-white shadow' : 'text-slate-600 dark:text-slate-300'}`

  return <form onSubmit={submit} className="geometric-card space-y-5 p-4 sm:p-6">
    <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-900">
      <button type="button" onClick={() => { setKind('notes'); setSuccess(false); setError(null) }} className={tabClass(kind === 'notes')}>Notes</button>
      <button type="button" onClick={() => { setKind('textbooks'); setSuccess(false); setError(null) }} className={tabClass(kind === 'textbooks')}><BookMarked className="mr-1 inline h-4 w-4" />Vitabu</button>
      <button type="button" onClick={() => { setKind('past_papers'); setSuccess(false); setError(null) }} className={tabClass(kind === 'past_papers')}>Mitihani</button>
    </div>
    <div><label className="mb-1.5 block text-sm font-bold text-slate-800 dark:text-slate-200">Kichwa cha nyenzo</label><input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} placeholder={kind === 'notes' ? 'Mfano: Biology — Cell Division Notes' : kind === 'textbooks' ? 'Mfano: Advanced Mathematics Textbook' : 'Mfano: NECTA Biology Paper 2024'} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></div>
    {kind !== 'past_papers' && <div><label className="mb-1.5 block text-sm font-bold text-slate-800 dark:text-slate-200">Maelezo</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={3} maxLength={3000} placeholder={kind === 'textbooks' ? 'Eleza kitabu, mada zinazofundishwa na toleo lake.' : 'Eleza mada zinazopatikana na namna nyenzo itakavyosaidia.'} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></div>}
    {kind === 'past_papers' ? <div className="grid gap-3 sm:grid-cols-2"><div><label className="mb-1.5 block text-sm font-bold text-slate-800 dark:text-slate-200">Aina ya mtihani</label><select value={examType} onChange={(e) => setExamType(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="NECTA">NECTA</option><option value="MOCK">Mock exam</option><option value="UNIVERSITY">University</option><option value="OTHER">Nyingine</option></select></div><div><label className="mb-1.5 block text-sm font-bold text-slate-800 dark:text-slate-200">Mwaka</label><input type="number" min="1950" max="2200" value={year} onChange={(e) => setYear(e.target.value)} required className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></div></div> : kind === 'textbooks' ? <div className="grid gap-3 sm:grid-cols-3"><div><label className="mb-1.5 block text-sm font-bold text-slate-800 dark:text-slate-200">Mwandishi (hiari)</label><input value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={180} placeholder="Jina la mwandishi" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></div><div><label className="mb-1.5 block text-sm font-bold text-slate-800 dark:text-slate-200">Mchapishaji (hiari)</label><input value={publisher} onChange={(e) => setPublisher(e.target.value)} maxLength={180} placeholder="Publisher" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></div><div><label className="mb-1.5 block text-sm font-bold text-slate-800 dark:text-slate-200">Mwaka (hiari)</label><input type="number" min="1450" max="2200" value={publicationYear} onChange={(e) => setPublicationYear(e.target.value)} placeholder="2025" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></div></div> : null}
    <div className="grid gap-3 sm:grid-cols-2"><div><label className="mb-1.5 block text-sm font-bold text-slate-800 dark:text-slate-200">Kiwango</label><select value={level} onChange={(e) => { setLevel(e.target.value); setSubjectId(''); setCustomSubject('') }} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="O_LEVEL">O-Level</option><option value="A_LEVEL">A-Level</option><option value="UNIVERSITY">University</option></select></div><div><label className="mb-1.5 block text-sm font-bold text-slate-800 dark:text-slate-200">Somo</label><select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setCustomSubject('') }} required className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="">Chagua somo</option>{filteredSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>{filteredSubjects.length === 0 && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Hakuna masomo kwa kiwango hiki. Endesha SQL-032 kuongeza katalogi.</p>}</div></div>
    {needsCustomSubject && <div className="anim-fade-up"><label className="mb-1.5 block text-sm font-bold text-slate-800 dark:text-slate-200">Taja somo (Others)</label><input value={customSubject} onChange={(e) => setCustomSubject(e.target.value)} maxLength={100} required placeholder="Mfano: Environmental Management" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" /><p className="mt-1 text-xs text-slate-500">Somo hili litahifadhiwa kwenye rekodi ya nyenzo yako kama somo maalumu.</p></div>}
    <div><label className="mb-1.5 block text-sm font-bold text-slate-800 dark:text-slate-200">Faili (max 25 MB)</label><label htmlFor="resource-file" className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4 transition hover:border-indigo-400 dark:border-indigo-900 dark:bg-indigo-950/20"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"><FileUp className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-900 dark:text-white">{file?.name ?? (kind === 'textbooks' ? 'Chagua kitabu cha kupakia' : 'Chagua faili la kupakia')}</span><span className="mt-1 block text-xs text-slate-500">{kind === 'textbooks' ? 'PDF, EPUB, DOCX, PPTX, JPG au PNG' : kind === 'past_papers' ? 'PDF pekee kwa past papers' : 'PDF, DOCX, PPTX, JPG au PNG'}</span></span></label><input id="resource-file" type="file" accept={kind === 'textbooks' ? '.pdf,.epub,.docx,.pptx,.jpg,.jpeg,.png' : kind === 'past_papers' ? '.pdf' : '.pdf,.docx,.pptx,.jpg,.jpeg,.png'} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="sr-only" /></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-200">{error}</p>}
    {success && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">Nyenzo imepakiwa na inasubiri ukaguzi wa moderator kabla haijaonekana kwa wanafunzi wengine.</p>}
    <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600 dark:bg-slate-900 dark:text-slate-300"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" /><span>Faili litahifadhiwa kwenye private Storage. Usipakie nyenzo yenye hakimiliki bila ruhusa.</span></div>
    <button type="submit" disabled={busy || filteredSubjects.length === 0} className="flex w-full items-center justify-center gap-2 rounded-xl sn-primary-gradient px-4 py-3 text-sm font-extrabold text-white transition disabled:cursor-not-allowed disabled:opacity-60">{busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Inapakia...</> : <><FileUp className="h-4 w-4" /> Pakia na tuma kwa ukaguzi</>}</button>
  </form>
}

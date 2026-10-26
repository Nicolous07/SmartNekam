'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Layers3, Loader2, Plus, Video } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type CourseOption = { id: string; title: string; status: string; level: string }

const fieldClass = 'mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white'

export default function AdminLearningManager({ courses }: { courses: CourseOption[] }) {
  const supabase = createClient()
  const router = useRouter()
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [existingCourseId, setExistingCourseId] = useState(courses[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [level, setLevel] = useState('O_LEVEL')
  const [language, setLanguage] = useState('sw')
  const [accessType, setAccessType] = useState('free')
  const [price, setPrice] = useState('10000')
  const [currency, setCurrency] = useState('TZS')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [estimatedMinutes, setEstimatedMinutes] = useState('30')
  const [moduleTitle, setModuleTitle] = useState('Utangulizi')
  const [moduleDescription, setModuleDescription] = useState('')
  const [lessonTitle, setLessonTitle] = useState('')
  const [lessonDescription, setLessonDescription] = useState('')
  const [lessonType, setLessonType] = useState<'text' | 'video'>('text')
  const [lessonContent, setLessonContent] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [durationSeconds, setDurationSeconds] = useState('600')
  const [isPreview, setIsPreview] = useState(true)
  const [publishNow, setPublishNow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')

    if (mode === 'existing' && !existingCourseId) {
      setError('Chagua kozi unayotaka kuongeza module/lesson.')
      setBusy(false)
      return
    }
    if (lessonType === 'text' && !lessonContent.trim()) {
      setError('Weka maudhui ya lesson ya maandishi.')
      setBusy(false)
      return
    }
    if (lessonType === 'video' && !videoUrl.trim()) {
      setError('Weka kiungo cha video.')
      setBusy(false)
      return
    }
    if (mode === 'new' && accessType === 'premium' && Number(price) <= 0) {
      setError('Kozi ya premium lazima iwe na bei inayozidi sifuri.')
      setBusy(false)
      return
    }

    const { data, error: rpcError } = await supabase.rpc('admin_create_learning_content', {
      p_existing_course_id: mode === 'existing' ? existingCourseId : null,
      p_title: mode === 'new' ? title.trim() : '',
      p_description: mode === 'new' ? description.trim() || null : null,
      p_level: level,
      p_language: language,
      p_access_type: accessType,
      p_price: accessType === 'premium' ? Number(price) : 0,
      p_currency: currency,
      p_thumbnail_url: thumbnailUrl.trim() || null,
      p_estimated_minutes: Math.max(0, Number(estimatedMinutes) || 0),
      p_module_title: moduleTitle.trim(),
      p_module_description: moduleDescription.trim() || null,
      p_lesson_title: lessonTitle.trim(),
      p_lesson_description: lessonDescription.trim() || null,
      p_lesson_type: lessonType,
      p_lesson_content: lessonType === 'text' ? lessonContent.trim() : '',
      p_video_url: lessonType === 'video' ? videoUrl.trim() : null,
      p_duration_seconds: Math.max(0, Number(durationSeconds) || 0),
      p_is_preview: isPreview,
      p_publish_now: publishNow,
    })

    setBusy(false)
    if (rpcError) {
      setError(rpcError.message.includes('admin_create_learning_content')
        ? 'SQL 046 haijaendeshwa kwenye Supabase, au function haipatikani. Endesha migration 046 kisha ujaribu tena.'
        : rpcError.message)
      return
    }

    const row = Array.isArray(data) ? data[0] : data
    const status = row?.result_course_status ?? (publishNow ? 'published' : 'pending_review')
    setSuccess(mode === 'new'
      ? `Kozi imehifadhiwa. Status: ${status}. Module na lesson ya kwanza zimeongezwa.`
      : `Module na lesson zimeongezwa kwenye kozi. Status ya kozi: ${status}.`)
    setTitle('')
    setDescription('')
    setThumbnailUrl('')
    setModuleTitle('Module mpya')
    setModuleDescription('')
    setLessonTitle('')
    setLessonDescription('')
    setLessonContent('')
    setVideoUrl('')
    router.refresh()
  }

  return (
    <section className="space-y-4 rounded-2xl border border-emerald-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"><BookOpen className="h-5 w-5" /></span>
        <div>
          <h3 className="font-extrabold text-slate-950 dark:text-white">Learn Content Studio</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Tengeneza kozi, ongeza modules na lessons. Kozi mpya inaweza kusubiri review au kuchapishwa moja kwa moja. Premium enrollment bado inatumia mfumo wa malipo uliopo.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setMode('new')} className={`rounded-xl px-3 py-2 text-sm font-extrabold ${mode === 'new' ? 'bg-emerald-600 text-white' : 'geometric-card text-slate-700 dark:text-slate-200'}`}>Kozi mpya</button>
        <button type="button" onClick={() => setMode('existing')} disabled={!courses.length} className={`rounded-xl px-3 py-2 text-sm font-extrabold disabled:opacity-50 ${mode === 'existing' ? 'bg-emerald-600 text-white' : 'geometric-card text-slate-700 dark:text-slate-200'}`}>Ongeza module/lesson kwenye kozi</button>
      </div>

      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        {mode === 'existing' ? (
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Kozi
            <select required value={existingCourseId} onChange={(event) => setExistingCourseId(event.target.value)} className={fieldClass}>
              <option value="">Chagua kozi</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.title} · {course.status}</option>)}
            </select>
          </label>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 sm:col-span-2">Jina la kozi
                <input required maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} className={fieldClass} placeholder="mf. Biology: Cell Structure" />
              </label>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 sm:col-span-2">Maelezo ya kozi
                <textarea rows={3} maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} className={fieldClass} placeholder="Kozi itafundisha nini?" />
              </label>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Kiwango
                <select value={level} onChange={(event) => setLevel(event.target.value)} className={fieldClass}><option value="O_LEVEL">O-Level</option><option value="A_LEVEL">A-Level</option><option value="UNIVERSITY">University</option><option value="ALL">Viwango vyote</option></select>
              </label>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Lugha
                <select value={language} onChange={(event) => setLanguage(event.target.value)} className={fieldClass}><option value="sw">Kiswahili</option><option value="en">English</option></select>
              </label>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Aina ya upatikanaji
                <select value={accessType} onChange={(event) => setAccessType(event.target.value)} className={fieldClass}><option value="free">Bure</option><option value="premium">Premium / Malipo</option></select>
              </label>
              {accessType === 'premium' && <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Bei
                <input required type="number" min="1" step="1" value={price} onChange={(event) => setPrice(event.target.value)} className={fieldClass} />
              </label>}
              {accessType === 'premium' && <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Sarafu
                <select value={currency} onChange={(event) => setCurrency(event.target.value)} className={fieldClass}><option value="TZS">TZS</option><option value="USD">USD</option><option value="KES">KES</option><option value="UGX">UGX</option></select>
              </label>}
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Muda wa kozi (dakika)
                <input type="number" min="0" value={estimatedMinutes} onChange={(event) => setEstimatedMinutes(event.target.value)} className={fieldClass} />
              </label>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Picha ya kozi (URL, hiari)
                <input type="url" value={thumbnailUrl} onChange={(event) => setThumbnailUrl(event.target.value)} className={fieldClass} placeholder="https://..." />
              </label>
            </div>
          </>
        )}

        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800 sm:p-4">
          <div className="mb-3 flex items-center gap-2"><Layers3 className="h-4 w-4 text-emerald-600" /><h4 className="font-extrabold text-slate-950 dark:text-white">Module ya kwanza / inayofuata</h4></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Jina la module
              <input required maxLength={180} value={moduleTitle} onChange={(event) => setModuleTitle(event.target.value)} className={fieldClass} />
            </label>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Maelezo ya module (hiari)
              <input maxLength={500} value={moduleDescription} onChange={(event) => setModuleDescription(event.target.value)} className={fieldClass} />
            </label>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Jina la lesson
              <input required maxLength={180} value={lessonTitle} onChange={(event) => setLessonTitle(event.target.value)} className={fieldClass} />
            </label>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Maelezo ya lesson (hiari)
              <input maxLength={1000} value={lessonDescription} onChange={(event) => setLessonDescription(event.target.value)} className={fieldClass} />
            </label>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Aina ya lesson
              <select value={lessonType} onChange={(event) => setLessonType(event.target.value as 'text' | 'video')} className={fieldClass}><option value="text">Maandishi</option><option value="video">Video link</option></select>
            </label>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Muda wa lesson (sekunde)
              <input type="number" min="0" value={durationSeconds} onChange={(event) => setDurationSeconds(event.target.value)} className={fieldClass} />
            </label>
            {lessonType === 'text' ? <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 sm:col-span-2">Maudhui ya lesson
              <textarea required rows={7} maxLength={30000} value={lessonContent} onChange={(event) => setLessonContent(event.target.value)} className={fieldClass} placeholder="Andika somo hapa. Unaweza kuweka headings, mifano na hatua za ufumbuzi." />
            </label> : <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 sm:col-span-2">Video URL
              <input required type="url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} className={fieldClass} placeholder="https://..." />
            </label>}
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300"><input type="checkbox" checked={isPreview} onChange={(event) => setIsPreview(event.target.checked)} className="h-4 w-4 accent-emerald-600" />Lesson hii ionekane kama preview bila kulipia kozi</label>
        </div>

        {mode === 'new' && <label className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"><input type="checkbox" checked={publishNow} onChange={(event) => setPublishNow(event.target.checked)} className="mt-1 h-4 w-4 accent-emerald-600" /><span><b>Chapisha kozi mara moja</b><span className="mt-1 block text-xs leading-5">Usipochagua, kozi itaingia pending review. Chaguo hili linaweka kozi moja kwa moja kwenye Learn.</span></span></label>}
        {mode === 'existing' && <label className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"><input type="checkbox" checked={publishNow} onChange={(event) => setPublishNow(event.target.checked)} className="mt-1 h-4 w-4 accent-emerald-600" /><span><b>Chapisha kozi iliyochaguliwa</b><span className="mt-1 block text-xs leading-5">Tumia baada ya kukagua content yote ya kozi.</span></span></label>}

        <button type="submit" disabled={busy} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-emerald-500 disabled:opacity-50">{busy ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : lessonType === 'video' ? <Video className="mr-2 inline h-4 w-4" /> : <Plus className="mr-2 inline h-4 w-4" />}{mode === 'new' ? 'Hifadhi Learn content' : 'Ongeza module na lesson'}</button>
      </form>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{error}</p>}
      {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{success}</p>}
    </section>
  )
}

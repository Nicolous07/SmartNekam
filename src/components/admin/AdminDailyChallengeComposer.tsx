"use client"

import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CalendarClock, CheckCircle2, Loader2, Send, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type CorrectOption = 'A' | 'B' | 'C' | 'D'
type QuestionDraft = {
  question_text: string
  A: string
  B: string
  C: string
  D: string
  correct_option: CorrectOption
  explanation: string
}
type CreateResult = { quiz_id?: string; challenge_date?: string; notifications_sent?: number }

function darToday() {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Africa/Dar_es_Salaam', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}
function emptyQuestions(): QuestionDraft[] {
  return Array.from({ length: 5 }, () => ({
    question_text: '', A: '', B: '', C: '', D: '', correct_option: 'A' as CorrectOption, explanation: '',
  }))
}
const options: CorrectOption[] = ['A', 'B', 'C', 'D']
const fieldClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-white'

export default function AdminDailyChallengeComposer() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [level, setLevel] = useState('')
  const [challengeDate, setChallengeDate] = useState(darToday)
  const [questions, setQuestions] = useState<QuestionDraft[]>(emptyQuestions)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<CreateResult | null>(null)

  const updateQuestion = (index: number, patch: Partial<QuestionDraft>) => {
    setQuestions(current => current.map((question, i) => i === index ? { ...question, ...patch } : question))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess(null)
    if (!title.trim()) return setError('Weka kichwa cha Daily Challenge.')
    if (!challengeDate) return setError('Chagua tarehe ya Daily Challenge.')
    if (challengeDate < darToday()) return setError('Tarehe haiwezi kuwa ya zamani kwa saa za Tanzania.')
    const invalidIndex = questions.findIndex(q => !q.question_text.trim() || options.some(key => !q[key].trim()))
    if (invalidIndex >= 0) return setError(`Jaza swali la ${invalidIndex + 1} na machaguo yote manne (A–D).`)

    setBusy(true)
    try {
      const payload = questions.map((q, index) => ({
        question_number: index + 1,
        question_text: q.question_text.trim(),
        options: { A: q.A.trim(), B: q.B.trim(), C: q.C.trim(), D: q.D.trim() },
        correct_option: q.correct_option,
        explanation: q.explanation.trim() || null,
        marks: 1,
      }))
      const { data, error: rpcError } = await supabase.rpc('admin_create_daily_challenge', {
        p_title: title.trim(),
        p_description: description.trim() || null,
        p_level: level || null,
        p_challenge_date: challengeDate,
        p_questions: payload,
      })
      if (rpcError) throw new Error(rpcError.message)
      const result = (data ?? {}) as CreateResult
      setSuccess(result)
      setTitle('')
      setDescription('')
      setLevel('')
      setQuestions(emptyQuestions())
      router.refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Imeshindikana kutengeneza Daily Challenge. Jaribu tena.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="space-y-5">
    <section className="geometric-card overflow-hidden">
      <div className="flex items-start gap-3 border-b border-slate-100 bg-emerald-50/70 p-4 dark:border-slate-800 dark:bg-emerald-950/25 sm:p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white"><Sparkles className="h-5 w-5"/></span>
        <div className="min-w-0"><h3 className="font-extrabold text-slate-950 dark:text-white">Tengeneza Daily Challenge mpya</h3><p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">Weka maswali 5, chagua majibu sahihi na tarehe. Mfumo utahifadhi, utachapisha, utapanga changamoto na kutuma notification kwa watumiaji active.</p></div>
      </div>
      <form onSubmit={submit} className="space-y-5 p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">Kichwa cha challenge<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={200} required placeholder="Mf. Biology Daily Challenge" className={fieldClass}/></label>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">Tarehe ya kutolewa<input type="date" value={challengeDate} min={darToday()} onChange={e=>setChallengeDate(e.target.value)} required className={fieldClass}/><span className="mt-1 block text-xs font-normal text-slate-500">Saa za Tanzania (Africa/Dar_es_Salaam).</span></label>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">Kiwango cha maudhui (hiari)<select value={level} onChange={e=>setLevel(e.target.value)} className={fieldClass}><option value="">Viwango vyote</option><option value="O_LEVEL">O-Level</option><option value="A_LEVEL">A-Level</option><option value="UNIVERSITY">Chuo Kikuu</option></select><span className="mt-1 block text-xs font-normal text-slate-500">Kiwango ni lebo ya maudhui; changamoto ya tarehe moja huonekana kwa watumiaji wote.</span></label>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">Maelezo (hiari)<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={2} maxLength={2000} placeholder="Maelekezo mafupi kwa washiriki…" className={fieldClass}/></label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="font-extrabold text-slate-950 dark:text-white">Maswali ya changamoto</h4><p className="mt-1 text-xs text-slate-500">Daily Challenge inahitaji maswali 5. Kila swali lina machaguo A, B, C, D na alama 1.</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Maswali 5 / 5</span></div>
        <div className="space-y-4">
          {questions.map((q, index) => <fieldset key={index} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <legend className="px-2 text-sm font-extrabold text-emerald-700 dark:text-emerald-300">Swali {index + 1}</legend>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Maandishi ya swali<textarea value={q.question_text} onChange={e=>updateQuestion(index,{question_text:e.target.value})} rows={2} required placeholder={`Andika swali la ${index + 1}…`} className={fieldClass}/></label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {options.map(key => <label key={key} className="block text-xs font-bold text-slate-600 dark:text-slate-300">Chaguo {key}<input value={q[key]} onChange={e=>updateQuestion(index,{[key]:e.target.value} as Partial<QuestionDraft>)} required placeholder={`Jibu ${key}`} className={fieldClass}/></label>)}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">Jibu sahihi<select value={q.correct_option} onChange={e=>updateQuestion(index,{correct_option:e.target.value as CorrectOption})} className={fieldClass}>{options.map(key=><option key={key} value={key}>{key}</option>)}</select></label>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">Maelezo ya jibu (hiari)<input value={q.explanation} onChange={e=>updateQuestion(index,{explanation:e.target.value})} placeholder="Kwa nini jibu hili ni sahihi?" className={fieldClass}/></label>
            </div>
          </fieldset>)}
        </div>
        {error && <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/><span>{error}</span></div>}
        {success && <div role="status" className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0"/><div><p className="font-extrabold">Daily Challenge imechapishwa na kupangiwa tarehe {success.challenge_date || challengeDate}.</p><p className="mt-1">Notification imetengenezwa kwa watumiaji active {typeof success.notifications_sent === 'number' ? `(${success.notifications_sent} akaunti)` : ''}. Watumiaji wataifungua kupitia Learn → Daily Challenge.</p></div></div>}
        <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-xs leading-5 text-slate-500"><CalendarClock className="mt-0.5 h-4 w-4 shrink-0"/>Muda wa kufanya changamoto ni dakika 5. Tarehe ikiwa imekwishapangiwa challenge nyingine, mfumo utazuia kuibadilisha kimakosa.</p>
          <button type="submit" disabled={busy} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60">{busy?<><Loader2 className="h-4 w-4 animate-spin"/> Inatengeneza…</>:<>Tengeneza na Tuma <Send className="h-4 w-4"/></>}</button>
        </div>
      </form>
    </section>
  </div>
}

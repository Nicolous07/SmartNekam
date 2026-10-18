'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlarmClock, ArrowLeft, CheckCircle2, Flame, Loader2, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type QuizQuestion = { id: string; question_number: number; question_text: string; options: Record<string,string>; marks: number }
type Attempt = { attempt_id: string; quiz_id: string; quiz_title: string; quiz_type: string; status: 'in_progress'|'submitted'|'expired'; deadline_at: string; questions: QuizQuestion[] }
type Result = { status: string; score?: number; total_marks?: number; correct_count?: number; total_questions?: number; xp_awarded?: number }
function fmtSeconds(n:number){return `${Math.floor(n/60).toString().padStart(2,'0')}:${(n%60).toString().padStart(2,'0')}`}

export default function DailyChallenge() {
  const supabase = useMemo(()=>createClient(),[])
  const [attempt,setAttempt] = useState<Attempt|null>(null)
  const [answers,setAnswers] = useState<Record<string,string>>({})
  const [result,setResult] = useState<Result|null>(null)
  const [seconds,setSeconds] = useState(300)
  const [loading,setLoading] = useState(true)
  const [submitting,setSubmitting] = useState(false)
  const [error,setError] = useState('')

  const load = useCallback(async()=>{
    setLoading(true);setError('')
    const {data,error:rpcError}=await supabase.rpc('start_daily_challenge')
    if(rpcError){setError(rpcError.message.includes('No Daily Challenge')?'Daily Challenge ya leo bado haijapangiwa na moderator. Rudi baadaye.':rpcError.message);setAttempt(null);setLoading(false);return}
    const payload=data as Attempt
    setAttempt(payload)
    if(payload.status==='submitted'||payload.status==='expired'){
      const {data:existing}=await supabase.from('quiz_attempts').select('status,score,total_marks,correct_count,total_questions,xp_awarded').eq('id',payload.attempt_id).maybeSingle()
      if(existing)setResult(existing as Result)
    }
    const deadline=payload.deadline_at?new Date(payload.deadline_at).getTime():Date.now()+300000
    setSeconds(Math.max(0,Math.ceil((deadline-Date.now())/1000)))
    setLoading(false)
  },[supabase])
  useEffect(()=>{void load()},[load])

  const submit = useCallback(async()=>{
    if(!attempt||submitting||result||attempt.status!=='in_progress')return
    setSubmitting(true);setError('')
    const payload=Object.entries(answers).map(([question_id,selected_option])=>({question_id,selected_option}))
    const {data,error:submitError}=await supabase.rpc('submit_quiz_attempt',{p_attempt_id:attempt.attempt_id,p_answers:payload})
    if(submitError)setError(submitError.message)
    else setResult(data as Result)
    setSubmitting(false)
  },[answers,attempt,result,submitting,supabase])
  useEffect(()=>{if(!attempt||result||attempt.status!=='in_progress')return;const timer=window.setInterval(()=>setSeconds(s=>{if(s<=1){window.clearInterval(timer);void submit();return 0}return s-1}),1000);return()=>window.clearInterval(timer)},[attempt,result,submit])

  const questions=attempt?.questions??[]
  const completed=Boolean(result)||attempt?.status==='submitted'||attempt?.status==='expired'
  return <div className="mx-auto max-w-3xl space-y-5">
    <Link href="/learn" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-700 dark:text-slate-300"><ArrowLeft className="h-4 w-4"/> Rudi Learn</Link>
    <section className="geometric-hero relative overflow-hidden rounded-3xl p-6 text-white sm:p-8"><div className="pointer-events-none absolute -right-8 -top-10 h-44 w-44 rounded-full border-[26px] border-white/10"/><div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">CHANGAMOTO YA LEO</span><h1 className="mt-3 text-3xl font-black sm:text-4xl">Daily Challenge</h1><p className="mt-2 max-w-lg text-sm text-emerald-50">Jibu maswali yaliyopangwa na SmartNekam. Alama na XP hukokotolewa na database baada ya kuwasilisha.</p></div><div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-black/15 px-4 py-3"><AlarmClock className="h-5 w-5"/><div><p className="text-[10px] uppercase tracking-widest text-emerald-100">Muda uliobaki</p><p className="font-mono text-2xl font-black">{completed?'DONE':fmtSeconds(seconds)}</p></div></div></div><div className="relative mt-6 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-teal-400 transition-all" style={{width:`${questions.length?Object.keys(answers).length/questions.length*100:0}%`}}/></div><p className="relative mt-2 text-xs text-emerald-100">{Object.keys(answers).length} kati ya {questions.length} maswali yamejibiwa</p></section>
    {error&&<p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100">{error}</p>}
    {loading&&<div className="geometric-card flex items-center gap-3 p-5 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin text-emerald-600"/> Inapakia changamoto ya leo…</div>}
    {!loading&&!attempt&&!error&&<div className="geometric-card p-8 text-center"><Flame className="mx-auto h-9 w-9 text-orange-500"/><h2 className="mt-3 font-extrabold text-slate-950 dark:text-white">Changamoto haipo kwa sasa</h2><p className="mt-1 text-sm text-slate-500">Moderator akipanga quiz ya leo itaonekana hapa.</p></div>}
    {attempt&&questions.map((q,i)=><section key={q.id} className="geometric-card p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Swali {q.question_number||i+1}</span><span className="text-xs font-semibold text-slate-500">{q.marks} alama</span></div><h2 className="mt-3 text-base font-bold leading-7 text-slate-950 dark:text-white">{q.question_text}</h2><div className="mt-4 grid gap-2 sm:grid-cols-2">{Object.entries(q.options??{}).map(([key,value])=><button key={key} type="button" disabled={completed||submitting||seconds===0} onClick={()=>setAnswers(old=>({...old,[q.id]:key}))} className={`rounded-xl border p-3 text-left text-sm transition ${answers[q.id]===key?'border-teal-500 bg-teal-50 text-teal-950 dark:bg-teal-950/60 dark:text-teal-100':'border-slate-200 text-slate-700 hover:border-emerald-300 dark:border-slate-700 dark:text-slate-200'} disabled:cursor-not-allowed disabled:opacity-80`}><span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-xs font-black dark:bg-slate-800">{key}</span>{value}</button>)}</div></section>)}
    {attempt&&attempt.status==='in_progress'&&!result&&<button type="button" onClick={()=>void submit()} disabled={submitting||seconds===0||questions.length===0} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-extrabold text-white hover:bg-emerald-500 disabled:opacity-60">{submitting?<><Loader2 className="h-4 w-4 animate-spin"/> Inatuma majibu…</>:<>Wasilisha changamoto <Trophy className="h-4 w-4"/></>}</button>}
    {result&&<section className="geometric-card p-6 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-200"><CheckCircle2 className="h-7 w-7"/></span><h2 className="mt-3 text-xl font-black text-slate-950 dark:text-white">{result.status==='expired'?'Muda umeisha': 'Changamoto imekamilika!'}</h2><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Alama: {result.score??0}/{result.total_marks??0} · Majibu sahihi: {result.correct_count??0}/{result.total_questions??questions.length}</p><p className="mt-1 text-sm font-extrabold text-teal-700 dark:text-teal-300">+{result.xp_awarded??0} XP</p><Link href="/learn" className="mt-5 inline-flex rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white">Endelea Learn</Link></section>}
    {attempt?.status==='in_progress'&&!completed&&<p className="text-xs leading-5 text-slate-400">Majibu sahihi hayafichuliwi kabla ya kuwasilisha. Mfumo wa Supabase unahesabu alama na XP kwenye server.</p>}
  </div>
}

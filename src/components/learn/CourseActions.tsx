'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, PlayCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function CourseEnrollmentAction({ courseId, accessType, enrolled, hasProAccess = false }: { courseId:string; accessType:string; enrolled:boolean; hasProAccess?:boolean }) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [busy,setBusy] = useState(false)
  const [message,setMessage] = useState('')

  async function enroll() {
    setBusy(true)
    setMessage('')
    if (accessType !== 'free' && !hasProAccess) {
      router.push('/premium')
      setBusy(false)
      return
    }

    const { error } = accessType === 'free'
      ? await supabase.rpc('enroll_in_course',{p_course_id:courseId})
      : await supabase.rpc('enroll_in_course_with_pro',{p_course_id:courseId})

    if (error) setMessage(error.message)
    else {
      setMessage(accessType === 'free' ? 'Umejiandikisha kwenye kozi.' : 'SmartNekam Pro imethibitishwa; kozi imefunguliwa.')
      router.refresh()
    }
    setBusy(false)
  }

  return <div className="space-y-2">
    <button type="button" disabled={busy || enrolled} onClick={()=>void enroll()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60">
      {busy?<Loader2 className="h-4 w-4 animate-spin"/>:enrolled?<CheckCircle2 className="h-4 w-4"/>:<PlayCircle className="h-4 w-4"/>}
      {enrolled?'Umefungua kozi':accessType==='free'?'Jiandikishe bure':hasProAccess?'Fungua kozi kwa Pro':'Angalia mipango ya Pro'}
    </button>
    {message&&<p role="status" className="text-xs leading-5 text-slate-500">{message}</p>}
  </div>
}

export function CourseLessonComplete({ lessonId, watchedSeconds, completed }: { lessonId:string; watchedSeconds:number; completed:boolean }) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [busy,setBusy] = useState(false)
  const [message,setMessage] = useState('')
  async function mark() {
    setBusy(true); setMessage('')
    const { error } = await supabase.rpc('record_course_lesson_progress',{p_lesson_id:lessonId,p_watched_seconds:Math.max(0,watchedSeconds),p_completed:true})
    if (error) setMessage(error.message)
    else { setMessage('Somo limetiwa alama ya kukamilika.'); router.refresh() }
    setBusy(false)
  }
  return <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" onClick={()=>void mark()} disabled={busy||completed} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white disabled:opacity-60">{busy?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:completed?<CheckCircle2 className="h-3.5 w-3.5"/>:<CheckCircle2 className="h-3.5 w-3.5"/>}{completed?'Imekamilika':'Mark complete'}</button>{message&&<span role="status" className="text-xs text-slate-500">{message}</span>}</div>
}

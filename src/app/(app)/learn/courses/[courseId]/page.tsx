import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, BookOpen, Clock3, FileText, GraduationCap, LockKeyhole, PlayCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { CourseEnrollmentAction, CourseLessonComplete } from '@/components/learn/CourseActions'

type Course = { id:string; title:string; description:string; level:string; language:string; access_type:string; price:number; currency:string; thumbnail_url:string|null; estimated_minutes:number; subject_id:string|null; status:string }
type Lesson = { id:string; module_id:string; title:string; description:string; lesson_type:string; content:string; video_url:string|null; resource_path:string|null; duration_seconds:number; position:number; is_preview:boolean; status:string }

export default async function CourseDetailPage({ params }: { params:Promise<{courseId:string}> }) {
  const { courseId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')
  const { data: course } = await supabase.from('courses').select('id,title,description,level,language,access_type,price,currency,thumbnail_url,estimated_minutes,subject_id,status').eq('id',courseId).eq('status','published').maybeSingle()
  if (!course) notFound()

  // Pro access is verified in Supabase, not inferred from the browser or a payment redirect.
  const { data: proEntitlement } = await supabase.rpc('has_active_smartnekam_pro')
  const hasProAccess = proEntitlement === true

  // A verified Pro subscription automatically enrolls the learner in published Premium courses.
  if (course.access_type !== 'free' && hasProAccess) {
    await supabase.rpc('enroll_in_course_with_pro', { p_course_id: courseId })
  }

  const [{data:subject},{data:enrollment},{data:modules},{data:lessons},{data:progress}] = await Promise.all([
    course.subject_id ? supabase.from('subjects').select('name').eq('id',course.subject_id).maybeSingle() : Promise.resolve({data:null}),
    supabase.from('course_enrollments').select('id,status').eq('course_id',courseId).eq('student_id',user.id).maybeSingle(),
    supabase.from('course_modules').select('id,title,description,position').eq('course_id',courseId).order('position'),
    supabase.from('course_lessons').select('id,module_id,title,description,lesson_type,content,video_url,resource_path,duration_seconds,position,is_preview,status').eq('course_id',courseId).eq('status','published').order('position'),
    supabase.from('course_lesson_progress').select('lesson_id,completed_at,watched_seconds').eq('student_id',user.id).eq('course_id',courseId),
  ])
  const enrolled = enrollment?.status === 'active'
  const lessonRows = (lessons ?? []) as Lesson[]
  const modulesList = (modules ?? []) as {id:string;title:string;description:string;position:number}[]
  const done = new Set((progress ?? []).filter((p) => p.completed_at).map((p) => p.lesson_id as string))
  const visibleLessons = lessonRows.filter((l) => enrolled || l.is_preview)
  const lessonsByModule = new Map<string,Lesson[]>()
  for (const lesson of visibleLessons) lessonsByModule.set(lesson.module_id,[...(lessonsByModule.get(lesson.module_id)??[]),lesson])
  return <main className="mx-auto max-w-5xl space-y-5 pb-8"><Link href="/learn?tab=courses" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300"><ArrowLeft className="h-4 w-4"/> Rudi kwenye Learn</Link>
    <section className="geometric-card overflow-hidden">{course.thumbnail_url ? <div className="h-48 bg-emerald-50 sm:h-64"><img src={course.thumbnail_url} alt="" className="h-full w-full object-cover"/></div> : <div className="geometric-hero flex h-44 items-center justify-center text-white sm:h-56"><GraduationCap className="h-16 w-16 text-white/70"/></div>}<div className="p-5 sm:p-7"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{course.level.replace('_','-')}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{course.language==='sw'?'Kiswahili':'English'}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{course.access_type==='free'?'Bure':'Premium'}</span></div><h1 className="mt-3 text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">{course.title}</h1><p className="mt-2 text-sm text-slate-500">{subject?.name ?? 'Kozi ya SmartNekam'} · {course.estimated_minutes?`${course.estimated_minutes} dakika`:'Muda haujawekwa'}</p><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-200">{course.description || 'Kozi hii imeandaliwa kusaidia kujifunza hatua kwa hatua.'}</p><div className="mt-5"><CourseEnrollmentAction courseId={course.id} accessType={course.access_type} enrolled={Boolean(enrolled)} hasProAccess={hasProAccess}/></div></div></section>
    {!enrolled && course.access_type==='premium' && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"><LockKeyhole className="mr-2 inline h-4 w-4"/>Unaweza kuona preview lesson zilizo wazi. Kozi za premium zinahitaji malipo yaliyoidhinishwa na backend kabla ya enrollment.</section>}
    <section className="space-y-3"><div><h2 className="text-xl font-black text-slate-950 dark:text-white">Modules na lessons</h2><p className="mt-1 text-sm text-slate-500">{visibleLessons.length} lessons zinapatikana kwako · {done.size} zimekamilika</p></div>{modulesList.length ? modulesList.map((m)=>{const mLessons=lessonsByModule.get(m.id)??[];return <article key={m.id} className="geometric-card p-4 sm:p-5"><div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"><BookOpen className="h-5 w-5"/></span><div><h3 className="font-extrabold text-slate-950 dark:text-white">{m.title}</h3>{m.description&&<p className="mt-1 text-sm text-slate-500">{m.description}</p>}</div></div><div className="mt-4 space-y-3">{mLessons.length ? mLessons.map((l)=>{const complete=done.has(l.id);return <div key={l.id} className="rounded-xl border border-emerald-100 p-3 dark:border-slate-800"><div className="flex items-start gap-3"><span className="mt-0.5 text-emerald-600">{l.lesson_type==='video'?<PlayCircle className="h-5 w-5"/>:<FileText className="h-5 w-5"/>}</span><div className="min-w-0 flex-1"><p className="font-bold text-slate-900 dark:text-white">{l.title}</p><p className="mt-1 text-xs text-slate-500">{l.duration_seconds?`${Math.ceil(l.duration_seconds/60)} min · `:''}{l.is_preview?'Preview':'Lesson'}{complete?' · Imekamilika':''}</p>{l.description&&<p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{l.description}</p>}{l.content&&<p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">{l.content}</p>}{l.video_url&&<a href={l.video_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 underline dark:text-emerald-300">Fungua video <PlayCircle className="h-4 w-4"/></a>}{enrolled&&<CourseLessonComplete lessonId={l.id} watchedSeconds={l.duration_seconds} completed={complete}/>}</div></div></div>}) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-900">{enrolled?'Hakuna lessons zilizochapishwa katika module hii.':'Lessons zaidi zitafunguka baada ya enrollment; preview haijaongezwa kwa sasa.'}</p>}</div></article>}) : <div className="geometric-card p-8 text-center"><BookOpen className="mx-auto h-10 w-10 text-emerald-600"/><p className="mt-3 font-bold text-slate-900 dark:text-white">Modules bado hazijaongezwa</p><p className="mt-1 text-sm text-slate-500">Msimamizi wa kozi anahitaji kuunda modules na lessons na kuzichapisha kabla ya wanafunzi kujifunza.</p></div>}</section>
  </main>
}

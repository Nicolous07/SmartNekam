import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, CheckCircle2, MessageCircleQuestion } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import QuestionActions from '@/components/community/QuestionActions'

export default async function QuestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')
  const { data: question } = await supabase.from('questions')
    .select('id,user_id,subject_id,title,body,attachments,status,upvotes,best_answer_id,created_at')
    .eq('id', id).maybeSingle()
  if (!question) notFound()
  const [{ data: subject }, { data: answers }] = await Promise.all([
    supabase.from('subjects').select('name,level').eq('id', question.subject_id).maybeSingle(),
    supabase.from('answers').select('id,user_id,body,upvotes,is_best_answer,created_at').eq('question_id', id).order('created_at', { ascending: true }),
  ])
  const answerRows = answers ?? []
  const participantIds = [...new Set([question.user_id, ...answerRows.map(answer => answer.user_id)])]
  const { data: participants } = await supabase.from('community_profiles').select('id,full_name').in('id', participantIds)
  const participantMap = new Map((participants ?? []).map(profile => [profile.id, profile]))
  const questionAuthor = participantMap.get(question.user_id)
  const questionAuthorName = questionAuthor?.full_name || 'Mwanafunzi'
  const answersWithAuthors = answerRows.map(answer => {
    const author = participantMap.get(answer.user_id)
    return { ...answer, author_name: author?.full_name ?? null, author_username: null }
  })
  const attachmentPaths = (question.attachments ?? []) as string[]
  const questionAttachments = await Promise.all(attachmentPaths.map(async path => {
    const { data } = await supabase.storage.from('community-attachments').createSignedUrl(path, 60 * 60)
    return data?.signedUrl ? { path, url: data.signedUrl, name: path.split('/').pop() ?? 'Kiambatisho' } : null
  }))
  return (
    <main className="mx-auto max-w-4xl space-y-5 pb-8">
      <Link href="/communities?tab=qa" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300"><ArrowLeft className="h-4 w-4" /> Rudi kwenye Q&A</Link>
      <article className="geometric-card p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"><MessageCircleQuestion className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{subject?.name ?? 'Somo'}{subject?.level ? ' · ' + subject.level.replace('_', '-') : ''}</span>{question.status === 'resolved' && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100"><CheckCircle2 className="h-3 w-3" /> Limetatuliwa</span>}</div>
            <h1 className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{question.title || 'Swali la kitaaluma'}</h1>
            <p className="mt-2 text-xs font-extrabold text-violet-700 dark:text-violet-300">Aliuliza: {questionAuthorName}</p>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-200">{question.body}</p>
            {questionAttachments.filter((item): item is {path:string;url:string;name:string} => Boolean(item)).length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2">{questionAttachments.filter((item): item is {path:string;url:string;name:string} => Boolean(item)).map(file=>{const isImage=/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);return <div key={file.path} className="overflow-hidden rounded-2xl border border-emerald-100 dark:border-slate-700">{isImage?<a href={file.url} target="_blank" rel="noreferrer"><img src={file.url} alt="Picha ya swali" className="max-h-[500px] w-full bg-slate-50 object-contain dark:bg-slate-900"/></a>:<div className="p-4 text-sm font-bold text-slate-700 dark:text-slate-200">{file.name}</div>}<a href={file.url} download={file.name} className="block border-t border-emerald-100 px-3 py-2 text-xs font-extrabold text-emerald-700 hover:bg-emerald-50 dark:border-slate-700 dark:text-emerald-300 dark:hover:bg-slate-800">Pakua kiambatisho ↓</a></div>})}</div>}
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500"><span>{question.upvotes} kura</span><span>{new Date(question.created_at).toLocaleString('sw-TZ')}</span><span>{question.status}</span></div>
          </div>
        </div>
      </article>
      <QuestionActions questionId={question.id} questionOwnerId={question.user_id} currentUserId={user.id} initialAnswers={answersWithAuthors as {id:string;user_id:string;body:string;upvotes:number;is_best_answer:boolean;created_at:string;author_name:string|null;author_username:string|null}[]} status={question.status}/>
    </main>
  )
}

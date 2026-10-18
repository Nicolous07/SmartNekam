import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, BookMarked, BookOpen, FileText, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import SmartNekamDownloadButton from '@/components/library/SmartNekamDownloadButton'
import SmartNekamResourceReader from '@/components/library/SmartNekamResourceReader'

type ResourceRow = {
  id: string
  title: string
  description?: string | null
  level: string
  file_type: string
  file_size_bytes: number
  downloads: number
  created_at: string
  subject_id: string
  custom_subject?: string | null
  storage_path: string
  status: string
  tags?: string[] | null
  exam_type?: string | null
  year?: number | null
  marking_scheme_path?: string | null
  author?: string | null
  publisher?: string | null
  publication_year?: number | null
}

const levelName: Record<string, string> = { O_LEVEL: 'O-Level', A_LEVEL: 'A-Level', UNIVERSITY: 'University' }

export default async function LibraryDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ type?: string }> }) {
  const { id } = await params
  const { type } = await searchParams
  const kind: 'notes' | 'past_papers' | 'textbooks' = type === 'past_papers' ? 'past_papers' : type === 'textbooks' ? 'textbooks' : 'notes'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  let row: ResourceRow | null = null
  if (kind === 'notes') {
    const result = await supabase.from('notes').select('id,title,description,level,file_type,file_size_bytes,downloads,created_at,subject_id,custom_subject,storage_path,status,tags').eq('id', id).maybeSingle()
    if (result.error || !result.data) notFound()
    row = result.data as ResourceRow
  } else if (kind === 'past_papers') {
    const result = await supabase.from('past_papers').select('id,title,level,exam_type,year,file_type,file_size_bytes,downloads,created_at,subject_id,custom_subject,storage_path,status,marking_scheme_path').eq('id', id).maybeSingle()
    if (result.error || !result.data) notFound()
    row = result.data as ResourceRow
  } else {
    const result = await supabase.from('textbooks').select('id,title,description,level,file_type,file_size_bytes,downloads,created_at,subject_id,custom_subject,storage_path,status,author,publisher,publication_year').eq('id', id).maybeSingle()
    if (result.error || !result.data) notFound()
    row = result.data as ResourceRow
  }

  // RLS limits unapproved records to their uploader. Only a short-lived signed
  // URL is passed to the browser, never a public Storage URL or service key.
  if (!row || !['approved', 'pending', 'rejected'].includes(row.status)) notFound()
  const [{ data: subject }, signedResult] = await Promise.all([
    supabase.from('subjects').select('name').eq('id', row.subject_id).maybeSingle(),
    supabase.storage.from('learning-resources').createSignedUrl(row.storage_path, 15 * 60),
  ])
  const signedUrl = signedResult.error ? null : signedResult.data?.signedUrl ?? null
  const label = kind === 'notes' ? 'Notes' : kind === 'past_papers' ? 'Mtihani wa zamani' : 'Kitabu'

  return <div className="mx-auto max-w-5xl space-y-4">
    <Link href={`/library?type=${kind}`} className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300"><ArrowLeft className="h-4 w-4" /> Rudi Maktabani</Link>
    <article className="geometric-card overflow-hidden">
      <div className="geometric-hero p-6 text-white sm:p-8">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
          {kind === 'textbooks' ? <BookMarked className="h-3.5 w-3.5" /> : kind === 'notes' ? <BookOpen className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />} {label}
        </span>
        <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">{row.title}</h1>
        <p className="mt-2 text-sm text-slate-100">{row.custom_subject || subject?.name || 'Somo'} · {levelName[row.level] ?? row.level}</p>
      </div>
      <div className="space-y-5 p-4 sm:p-7">
        {row.status !== 'approved' && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Nyenzo hii bado haijaidhinishwa. Inaonekana kwa mchangiaji aliyeipakia tu; itapatikana kwa wanafunzi wengine baada ya ukaguzi.</p>}
        {row.description && <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-200">{row.description}</p>}
        {kind === 'past_papers' && <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{row.exam_type} · {row.year}</p>}
        {kind === 'textbooks' && <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{row.author ? `Mwandishi: ${row.author}` : ''}{row.publisher ? ` · Mchapishaji: ${row.publisher}` : ''}{row.publication_year ? ` · ${row.publication_year}` : ''}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900"><p className="text-xs text-slate-500">Aina ya faili</p><p className="mt-1 font-extrabold text-slate-900 dark:text-white">{row.file_type.toUpperCase()}</p></div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900"><p className="text-xs text-slate-500">Downloads</p><p className="mt-1 font-extrabold text-slate-900 dark:text-white">{row.downloads}</p></div>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"><ShieldCheck className="mr-1 inline h-4 w-4" /> Faili linalindwa na ruhusa za Supabase. Kiungo cha muda tu ndicho kinachotumika kwa reader.</div>
      </div>
    </article>

    <SmartNekamResourceReader resourceId={row.id} title={row.title} fileType={row.file_type} signedUrl={signedUrl} />

    {row.status === 'approved' ? <div className="grid gap-3 sm:grid-cols-2">
      <SmartNekamDownloadButton id={row.id} type={kind} storagePath={row.storage_path} fileName={`${row.title}.${row.file_type}`} />
      {kind === 'past_papers' && row.marking_scheme_path && <SmartNekamDownloadButton id={row.id} type="past_papers" storagePath={row.marking_scheme_path} fileName={`${row.title}-marking-scheme.pdf`} />}
    </div> : <p className="text-sm text-slate-500">Download itawezeshwa baada ya moderator kuidhinisha nyenzo.</p>}
  </div>
}

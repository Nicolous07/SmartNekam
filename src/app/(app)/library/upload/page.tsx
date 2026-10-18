import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import SmartNekamUploadForm from '@/components/library/SmartNekamUploadForm'

export default async function UploadPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')
  const { data: subjects } = await supabase.from('subjects').select('id,name,level').order('level').order('name')
  return <div className="mx-auto max-w-2xl space-y-4"><Link href="/library" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300"><ArrowLeft className="h-4 w-4" /> Rudi Maktabani</Link><section className="geometric-hero rounded-3xl p-5 text-white"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><Upload className="h-6 w-6" /></span><div><h1 className="text-2xl font-extrabold">Pakia nyenzo</h1><p className="mt-1 text-sm text-emerald-50">Saidia wanafunzi wengine kwa kushiriki nyenzo bora.</p></div></div></section><SmartNekamUploadForm subjects={(subjects ?? []) as { id: string; name: string; level: string }[]} initialType={params.type === 'past-paper' ? 'past_papers' : params.type === 'textbooks' ? 'textbooks' : 'notes'} /></div>
}

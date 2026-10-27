import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Radio } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createLearningChannel } from '../actions'

export default async function CreateLearningChannelPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const errorText = sp.error === 'name' ? 'Jina liwe kati ya herufi 2 na 100.'
    : sp.error === 'save' ? 'Imeshindikana kuunda channel. Hakikisha SQL 047 imeendeshwa kwenye Supabase.'
    : sp.error ? 'Baadhi ya taarifa hazijakubalika. Kagua kisha jaribu tena.' : ''

  return <div className="mx-auto max-w-3xl space-y-5">
    <Link href="/learn/channels" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300"><ArrowLeft className="h-4 w-4"/> Rudi kwenye Channels</Link>
    <section className="geometric-hero rounded-3xl p-6 text-white sm:p-8">
      <Radio className="h-9 w-9 text-emerald-200"/>
      <h1 className="mt-3 text-3xl font-black">Fungua channel yako</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-100">Fundisha masomo, maisha, biashara, career au teknolojia. Unaweza kuongeza video zako na link za YouTube ambazo zitachezwa ndani ya SmartNekam.</p>
    </section>
    <form action={createLearningChannel} className="geometric-card space-y-4 p-5 sm:p-7">
      {errorText && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">{errorText}</p>}
      <label className="block space-y-1.5"><span className="text-sm font-bold text-slate-800 dark:text-slate-100">Jina la channel *</span><input name="name" required minLength={2} maxLength={100} placeholder="Mfano: Tech na Maisha kwa Kiswahili" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"/></label>
      <label className="block space-y-1.5"><span className="text-sm font-bold text-slate-800 dark:text-slate-100">Maelezo ya channel</span><textarea name="description" rows={4} maxLength={1500} placeholder="Eleza watu watakachojifunza kwenye channel yako..." className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"/></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5"><span className="text-sm font-bold text-slate-800 dark:text-slate-100">Aina ya maudhui</span><select name="category" defaultValue="academics" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="life">Maisha na ujuzi wa maisha</option><option value="academics">Masomo</option><option value="technology">Teknolojia / Programming / AI</option><option value="career">Career na fursa</option><option value="business">Biashara na ujasiriamali</option><option value="health">Afya na ustawi</option><option value="other">Nyingine</option></select></label>
        <label className="block space-y-1.5"><span className="text-sm font-bold text-slate-800 dark:text-slate-100">Lugha kuu</span><select name="language" defaultValue="sw" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="sw">Kiswahili</option><option value="en">English</option></select></label>
      </div>
      <div className="rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">Tumia maudhui yako au video ambazo una ruhusa ya kushiriki. Channel na video zinapaswa kufuata kanuni za SmartNekam.</div>
      <button type="submit" className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-extrabold text-white transition hover:bg-emerald-500">Fungua channel</button>
    </form>
  </div>
}

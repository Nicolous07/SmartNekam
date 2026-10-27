import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, BookOpen, BriefcaseBusiness, Code2, HeartPulse, Plus, Radio, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

const categories: Record<string,string> = { life:'Maisha', academics:'Masomo', technology:'Tech', career:'Career', business:'Biashara', health:'Afya', other:'Nyingine' }
const icons: Record<string,typeof BookOpen> = { life:Sparkles, academics:BookOpen, technology:Code2, career:BriefcaseBusiness, business:BriefcaseBusiness, health:HeartPulse, other:Radio }

export default async function LearningChannelsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')
  const { data, error } = await supabase.from('learning_channels')
    .select('id,name,slug,description,category,language,owner_id,created_at')
    .eq('status','published').order('created_at',{ascending:false}).limit(100)
  const channels = data ?? []
  return <div className="mx-auto max-w-6xl space-y-5">
    <section className="geometric-hero rounded-3xl p-6 text-white sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="max-w-2xl"><p className="text-xs font-extrabold uppercase tracking-[.18em] text-teal-200">SmartNekam Learn</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Channels za kujifunza</h1><p className="mt-3 text-sm leading-6 text-slate-100">Gundua walimu na creators wanaofundisha masomo, ujuzi wa maisha, biashara, career, programming na AI. Video za YouTube zinafunguka na kuchezwa hapa hapa.</p></div><Link href="/learn/channels/create" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-emerald-800"><Plus className="h-4 w-4"/> Fungua channel</Link></div>
    </section>
    {error ? <div className="geometric-card p-5 text-sm text-rose-700 dark:text-rose-200">Imeshindikana kupakia channels. Hakikisha SQL 047 imeendeshwa kwenye Supabase.</div> : channels.length ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{channels.map(channel=>{const Icon=icons[channel.category]??Radio;return <article key={channel.id} className="geometric-card hover-lift flex flex-col p-5"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Icon className="h-6 w-6"/></span><div className="mt-4 flex items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{categories[channel.category]??'Channel'}</span><span className="text-xs text-slate-500">{channel.language==='sw'?'Kiswahili':'English'}</span></div><h2 className="mt-3 text-lg font-extrabold text-slate-950 dark:text-white">{channel.name}</h2><p className="mt-2 flex-1 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{channel.description||'Channel ya kujifunza na kushirikiana maarifa.'}</p><Link href={`/learn/channels/${channel.slug}`} className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-500">Fungua channel <ArrowRight className="h-4 w-4"/></Link></article>})}</section> : <section className="geometric-card p-8 text-center"><Radio className="mx-auto h-10 w-10 text-emerald-600"/><h2 className="mt-3 text-xl font-black text-slate-950 dark:text-white">Bado hakuna channel</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">Kuwa creator wa kwanza. Fungua channel yako na anza kushiriki maarifa na wanafunzi wengine.</p><Link href="/learn/channels/create" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white"><Plus className="h-4 w-4"/> Fungua channel</Link></section>}
  </div>
}

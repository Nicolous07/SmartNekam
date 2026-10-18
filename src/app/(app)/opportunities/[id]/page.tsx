import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, CalendarClock, CheckCircle2, ExternalLink, Globe2, ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import OpportunityActions from '@/components/opportunities/OpportunityActions'

function dateLabel(value:string|null) { return value ? new Date(`${value.slice(0,10)}T12:00:00`).toLocaleDateString('sw-TZ',{day:'numeric',month:'long',year:'numeric'}) : 'Deadline haijawekwa' }
const typeLabel:Record<string,string>={scholarship:'Scholarship',competition:'Mashindano',internship:'Internship',job:'Kazi',graduate_programme:'Graduate programme',volunteering:'Volunteering',loan:'Mkopo / Funding',university:'Chuo'}

export default async function OpportunityDetailPage({ params }: { params:Promise<{id:string}> }) {
  const { id }=await params
  const supabase=await createClient()
  const {data:{user}}=await supabase.auth.getUser()
  if(!user) redirect('/auth')
  const [{data:o},{data:saved}] = await Promise.all([
    supabase.from('opportunities').select('id,type,title,sponsor,description,level,field,funding_type,amount,country,location,deadline,eligibility,documents,source_url,application_url,verified,status,created_at').eq('id',id).eq('status','active').maybeSingle(),
    supabase.from('saved_opportunities').select('opportunity_id').eq('user_id',user.id).eq('opportunity_id',id).maybeSingle(),
  ])
  if(!o) notFound()
  const facts=[['Kiwango',o.level?.replace('_','-')],['Field',o.field],['Funding',o.funding_type],['Kiasi',o.amount],['Nchi',o.country],['Mahali',o.location],['Sponsor',o.sponsor]].filter((x)=>Boolean(x[1])) as [string,string][]
  const days=o.deadline?Math.ceil((new Date(`${o.deadline}T23:59:59`).getTime()-Date.now())/86400000):null
  return <main className="mx-auto max-w-3xl space-y-4 pb-8"><Link href="/opportunities" className="inline-flex items-center gap-2 text-sm font-bold text-teal-700 dark:text-teal-300"><ArrowLeft className="h-4 w-4"/> Rudi Fursa</Link>
    <article className="geometric-card overflow-hidden"><header className="geometric-hero relative p-5 text-white sm:p-8"><div className="relative z-10"><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{typeLabel[o.type]??o.type}</span><h1 className="mt-4 text-2xl font-black sm:text-3xl">{o.title}</h1><p className="mt-2 text-sm text-teal-50">{o.sponsor??'Sponsor hajatajwa'}</p><div className="mt-4 flex flex-wrap gap-2">{o.verified?<span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold"><CheckCircle2 className="h-4 w-4"/> Imehakikiwa</span>:<span className="inline-flex items-center gap-1 rounded-full bg-amber-300/20 px-3 py-1.5 text-xs font-bold text-amber-100"><ShieldAlert className="h-4 w-4"/> Haijathibitishwa — hakiki chanzo</span>}<span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold"><CalendarClock className="h-4 w-4"/> {dateLabel(o.deadline)}</span></div></div></header>
      <div className="space-y-5 p-5 sm:p-7"><div><h2 className="font-heading text-lg font-extrabold text-slate-950 dark:text-white">Kuhusu fursa</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-200">{o.description||'Maelezo ya fursa bado hayajawekwa.'}</p></div>{o.eligibility&&<div><h2 className="font-heading font-extrabold text-slate-950 dark:text-white">Vigezo vya kustahili</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600 dark:text-slate-300">{o.eligibility}</p></div>}{facts.length>0&&<dl className="grid gap-3 sm:grid-cols-2">{facts.map(([k,v])=><div key={k} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900"><dt className="text-xs text-slate-500">{k}</dt><dd className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{v}</dd></div>)}</dl>}{Array.isArray(o.documents)&&o.documents.length>0&&<div><h2 className="font-heading font-extrabold text-slate-950 dark:text-white">Nyaraka zinazohitajika</h2><ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600 dark:text-slate-300">{o.documents.map((d:string)=><li key={d}>{d}</li>)}</ul></div>}{days!==null&&<p className={`rounded-xl p-3 text-sm font-bold ${days<0?'bg-slate-100 text-slate-500 dark:bg-slate-800':days<=7?'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-100':'bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-100'}`}>{days<0?'Deadline imepita':days===0?'Deadline ni leo':`Zimebaki siku ${days} kabla ya deadline`}</p>}{o.source_url&&<a href={o.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-teal-700 underline dark:text-teal-300"><Globe2 className="h-4 w-4"/> Chanzo rasmi <ExternalLink className="h-3.5 w-3.5"/></a>}{o.application_url&&<a href={o.application_url} target="_blank" rel="noreferrer" className="ml-4 inline-flex items-center gap-2 text-sm font-bold text-teal-700 underline dark:text-teal-300">Fungua application <ExternalLink className="h-3.5 w-3.5"/></a>}<OpportunityActions opportunityId={o.id} deadline={o.deadline} saved={Boolean(saved)}/></div>
    </article></main>
}

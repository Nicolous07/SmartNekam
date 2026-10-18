import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { Award, BriefcaseBusiness, CalendarClock, CheckCircle2, GraduationCap, MapPin, Search, ShieldCheck, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import OpportunityActions from '@/components/opportunities/OpportunityActions'

const TABS = [
  { key: 'scholarships', label: 'Scholarships' },
  { key: 'competitions', label: 'Mashindano' },
  { key: 'internships', label: 'Internships & Jobs' },
  { key: 'universities', label: 'Vyuo na Programmes' },
  { key: 'saved', label: 'Zilizohifadhiwa' },
  { key: 'applications', label: 'Maombi yangu' },
]
type Opportunity = { id: string; type: string; title: string; sponsor: string | null; description: string | null; level: string | null; field: string | null; funding_type: string | null; amount: string | null; country: string; location: string | null; deadline: string | null; eligibility: string | null; source_url: string | null; application_url: string | null; verified: boolean; status: string; created_at: string }
type Programme = { id: string; university_id: string; programme_name: string; award: string | null; field_of_study: string | null; entry_requirements: string | null; application_deadline: string | null; tuition_fee: number | null; currency: string }
function dateLabel(value: string | null) { return value ? new Date(`${value.slice(0,10)}T12:00:00`).toLocaleDateString('sw-TZ',{day:'numeric',month:'short',year:'numeric'}) : 'Deadline haijawekwa' }
function opportunityKind(type: string) { return ({ scholarship: 'Scholarship', competition: 'Mashindano', internship: 'Internship', job: 'Kazi', graduate_programme: 'Graduate programme', volunteering: 'Volunteering', loan: 'Mkopo / Funding', university: 'Chuo' } as Record<string,string>)[type] ?? type }

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; type?: string }> }) {
  const sp = await searchParams
  const active = TABS.some(t => t.key === sp.tab) ? sp.tab! : 'scholarships'
  const queryText = (sp.q ?? '').trim().slice(0, 100)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  let savedIds: string[] = []
  let opportunities: Opportunity[] = []
  if (active === 'saved') {
    const { data: savedRows } = await supabase.from('saved_opportunities').select('opportunity_id').eq('user_id', user.id).order('saved_at', { ascending: false })
    savedIds = (savedRows ?? []).map(r => r.opportunity_id as string)
  }
  if (['scholarships','competitions','internships','saved'].includes(active)) {
    const types = active === 'scholarships' ? ['scholarship','loan'] : active === 'competitions' ? ['competition'] : active === 'internships' ? ['internship','job','graduate_programme','volunteering'] : null
    if (active !== 'saved' || savedIds.length) {
      let request = supabase.from('opportunities').select('id,type,title,sponsor,description,level,field,funding_type,amount,country,location,deadline,eligibility,source_url,application_url,verified,status,created_at').eq('status','active').order('deadline',{ascending:true,nullsFirst:false}).limit(60)
      if (types) request = request.in('type',types)
      if (active === 'saved') request = request.in('id',savedIds)
      if (queryText) request = request.or(`title.ilike.%${queryText.replace(/[%_]/g,'')}%,sponsor.ilike.%${queryText.replace(/[%_]/g,'')}%,field.ilike.%${queryText.replace(/[%_]/g,'')}%`)
      const { data } = await request
      opportunities = (data ?? []) as Opportunity[]
    }
  }

  let programmes: Programme[] = []
  let universityNames = new Map<string,string>()
  if (active === 'universities') {
    let programmeQuery = supabase.from('university_programmes').select('id,university_id,programme_name,award,field_of_study,entry_requirements,application_deadline,tuition_fee,currency').eq('status','active').order('programme_name').limit(60)
    if (queryText) programmeQuery = programmeQuery.ilike('programme_name', `%${queryText.replace(/[%_]/g,'')}%`)
    const [programmeRes, universityRes] = await Promise.all([programmeQuery, supabase.from('universities').select('id,name').order('name')])
    programmes = (programmeRes.data ?? []) as Programme[]
    universityNames = new Map((universityRes.data ?? []).map((u) => [u.id, u.name]))
  }

  let applications: { id: string; status: string; deadline: string | null; opportunity_id: string | null; university_programme_id: string | null; created_at: string }[] = []
  if (active === 'applications') {
    const { data } = await supabase.from('applications').select('id,status,deadline,opportunity_id,university_programme_id,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100)
    applications = (data ?? []) as typeof applications
  }
  const opportunityNames = new Map(opportunities.map(o => [o.id,o.title]))
  const missingOpportunityIds = [...new Set(applications.map(a=>a.opportunity_id).filter((id): id is string=>!!id))]
  const missingProgrammeIds = [...new Set(applications.map(a=>a.university_programme_id).filter((id): id is string=>!!id))]
  const [{ data: applicationOpps }, { data: applicationPrograms }] = active === 'applications' ? await Promise.all([
    missingOpportunityIds.length ? supabase.from('opportunities').select('id,title').in('id',missingOpportunityIds) : Promise.resolve({ data: [] as {id:string;title:string}[] }),
    missingProgrammeIds.length ? supabase.from('university_programmes').select('id,programme_name').in('id',missingProgrammeIds) : Promise.resolve({ data: [] as {id:string;programme_name:string}[] }),
  ]) : [{data: [] as {id:string;title:string}[]},{data: [] as {id:string;programme_name:string}[]}]
  const applicationTitles = new Map<string,string>([...((applicationOpps ?? []).map(o=>[o.id,o.title] as [string,string])),...((applicationPrograms ?? []).map(p=>[p.id,p.programme_name] as [string,string]))])

  return <div className="stagger mx-auto max-w-6xl space-y-5">
    <section className="geometric-hero isolate relative overflow-hidden rounded-3xl p-5 text-white sm:p-8"><Image src="/images/reference-opportunities.webp" alt="Mipango na mkakati wa kufikia malengo" fill priority sizes="(max-width: 768px) 100vw, 1200px" className="absolute inset-0 z-0 object-cover object-center opacity-85"/><div className="absolute inset-0 z-[1] bg-gradient-to-r from-[#0B0F1A]/95 via-[#0B0F1A]/78 to-[#0B0F1A]/25"/><div className="relative z-10 max-w-3xl"><p className="text-xs font-extrabold uppercase tracking-[.18em] text-violet-100">SmartNekam Opportunities</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Fursa zinazokupeleka mbele.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-100">Gundua scholarships, mashindano, internships na programu za vyuo. Kagua source na eligibility kabla ya kutuma maombi.</p><div className="mt-4 flex flex-wrap gap-2"><span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold"><ShieldCheck className="h-4 w-4"/> Fursa zilizochapishwa</span><span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold"><CalendarClock className="h-4 w-4"/> Deadline tracker</span></div></div><Award className="absolute -bottom-7 -right-3 z-[2] h-44 w-44 text-white/10"/></section>
    <nav className="flex gap-2 overflow-x-auto pb-1">{TABS.map(t=><Link key={t.key} href={`/opportunities?tab=${t.key}`} className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-extrabold transition ${active===t.key?'sn-primary-gradient text-white':'geometric-card text-slate-600 hover:text-indigo-700 dark:text-slate-200'}`}>{t.label}</Link>)}</nav>
    {['scholarships','competitions','internships','saved','universities'].includes(active) && <form action="/opportunities" className="geometric-card flex flex-col gap-2 p-3 sm:flex-row"><input type="hidden" name="tab" value={active}/><div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 dark:border-slate-700"><Search className="h-4 w-4 text-slate-400"/><input name="q" defaultValue={queryText} placeholder="Tafuta kwa jina, sponsor au field..." className="w-full bg-transparent py-3 text-sm outline-none dark:text-white"/></div><button className="rounded-xl sn-primary-gradient px-4 py-3 text-sm font-extrabold text-white">Tafuta fursa</button></form>}

    {['scholarships','competitions','internships','saved'].includes(active) && <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{opportunities.map((o)=>{const Icon = o.type==='competition'?Trophy:o.type==='scholarship'?GraduationCap:BriefcaseBusiness;return <article key={o.id} className="geometric-card hover-lift flex flex-col p-4"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"><Icon className="h-5 w-5"/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-1.5"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{opportunityKind(o.type)}</span>{o.verified?<span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-200"><CheckCircle2 className="h-3 w-3"/> Imehakikiwa</span>:<span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200">Haijathibitishwa</span>}</div><h2 className="mt-2 font-extrabold text-slate-950 dark:text-white">{o.title}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{o.sponsor ?? 'Sponsor hajatajwa'}</p></div></div><p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{o.description || o.eligibility || 'Soma taarifa za fursa kupitia chanzo rasmi.'}</p><div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400"><p className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5"/> Deadline: {dateLabel(o.deadline)}</p><p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5"/>{o.location || o.country}{o.field?` · ${o.field}`:''}</p>{o.amount&&<p className="font-semibold text-indigo-700 dark:text-indigo-300">Funding: {o.amount}</p>}</div><Link href={`/opportunities/${o.id}`} className="mt-3 inline-flex justify-center rounded-xl border border-indigo-200 px-3 py-2 text-xs font-extrabold text-indigo-800 hover:bg-indigo-50 dark:border-indigo-900 dark:text-indigo-200 dark:hover:bg-indigo-950">Maelezo na eligibility →</Link><OpportunityActions opportunityId={o.id} deadline={o.deadline} saved={active==='saved'}/></article>})}{opportunities.length===0&&<Empty title={active==='saved'?'Bado hujahifadhi fursa':'Hakuna fursa zilizopatikana'} text="Fursa zitaonekana hapa baada ya admin kuzipakia na kuzichapisha. Hakikisha query yako si pana mno."/>}</section>}

    {active==='universities'&&<section className="grid gap-3 md:grid-cols-2">{programmes.map(p=><article key={p.id} className="geometric-card p-4"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-200"><GraduationCap className="h-5 w-5"/></span><h2 className="mt-3 font-extrabold text-slate-950 dark:text-white">{p.programme_name}</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{universityNames.get(p.university_id) ?? 'Chuo kikuu'}{p.award?` · ${p.award}`:''}</p>{p.field_of_study&&<p className="mt-2 text-xs text-slate-500">{p.field_of_study}</p>}{p.entry_requirements&&<p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{p.entry_requirements}</p>}<div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">Deadline: {dateLabel(p.application_deadline)}</span>{p.tuition_fee!==null&&<span className="rounded-full bg-indigo-50 px-2 py-1 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">{Number(p.tuition_fee).toLocaleString()} {p.currency}</span>}</div>{p.application_deadline&&<p className="mt-2 text-[11px] text-slate-400">Thibitisha tarehe na mahitaji kwenye tovuti rasmi ya chuo.</p>}</article>)}{programmes.length===0&&<Empty title="Hakuna programme zilizochapishwa" text="Programmes zitaonekana baada ya data ya vyuo na programmes kupakiwa na kuidhinishwa."/>}</section>}

    {active==='applications'&&<section className="geometric-card overflow-hidden"><div className="border-b border-slate-100 p-4 dark:border-slate-800"><h2 className="font-extrabold text-slate-950 dark:text-white">Application Tracker</h2><p className="mt-1 text-xs text-slate-500">Fuatilia hatua za maombi yako sehemu moja.</p></div>{applications.length?<div className="divide-y divide-slate-100 dark:divide-slate-800">{applications.map(a=><article key={a.id} className="flex flex-wrap items-center gap-3 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200"><GraduationCap className="h-5 w-5"/></span><div className="min-w-0 flex-1"><h3 className="font-bold text-slate-950 dark:text-white">{applicationTitles.get(a.opportunity_id ?? '') ?? applicationTitles.get(a.university_programme_id ?? '') ?? 'Ombi la SmartNekam'}</h3><p className="mt-1 text-xs text-slate-500">Deadline: {dateLabel(a.deadline)}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{a.status.replaceAll('_',' ')}</span></article>)}</div>:<Empty title="Hujaanza ombi lolote" text="Fungua fursa au programme ya chuo na ubofye ‘Fuata ombi’ ili ianze kuonekana hapa."/>}</section>}
  </div>
}
function Empty({title,text}:{title:string;text:string}) { return <div className="geometric-card col-span-full p-8 text-center"><BriefcaseBusiness className="mx-auto h-9 w-9 text-indigo-500"/><h2 className="mt-3 font-extrabold text-slate-950 dark:text-white">{title}</h2><p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{text}</p></div> }

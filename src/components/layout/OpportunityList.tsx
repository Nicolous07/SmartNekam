import { Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import EmptyPanel from '@/components/layout/EmptyPanel'

const TYPE_LABELS: Record<string, string> = {
  scholarship: 'Scholarship',
  hackathon: 'Hackathon',
  competition: 'Mashindano',
  bootcamp: 'Bootcamp',
  fellowship: 'Fellowship',
  internship: 'Internship',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('sw-TZ', {
    dateStyle: 'medium',
    timeZone: 'Africa/Dar_es_Salaam',
  })
}

// Inaonyesha fursa zilizochapishwa kutoka kwenye jedwali la `opportunities`, zilizochujwa kwa aina (type).
export default async function OpportunityList({
  types,
  emptyTitle,
}: {
  types: string[]
  emptyTitle: string
}) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('opportunities')
    .select('id, title, organization, type, deadline')
    .eq('is_published', true)
    .in('type', types)
    .order('deadline', { ascending: true, nullsFirst: false })
    .limit(30)

  if (error) {
    return <p className="geometric-card p-4 text-sm text-red-600">Imeshindikana kupakia: {error.message}</p>
  }

  if (!data || data.length === 0) {
    return (
      <EmptyPanel
        icon={Sparkles}
        title={emptyTitle}
        text="Fursa mpya zikichapishwa zitaonekana hapa."
      />
    )
  }

  return (
    <ul className="space-y-3">
      {data.map((o) => (
        <li key={o.id} className="geometric-card hover-lift p-4">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              {TYPE_LABELS[o.type] ?? o.type}
            </span>
            {o.deadline && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                Mwisho: {formatDate(o.deadline)}
              </span>
            )}
          </div>
          <p className="mt-2 font-bold text-slate-900 dark:text-slate-100">{o.title}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">{o.organization}</p>
        </li>
      ))}
    </ul>
  )
}

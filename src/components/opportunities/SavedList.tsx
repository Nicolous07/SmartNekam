import { Bookmark } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import EmptyPanel from '@/components/layout/EmptyPanel'
import OpportunityCard from './OpportunityCard'
import type { Opp } from '@/lib/opportunities'
import { daysLeft } from '@/lib/opportunities'

type Row = { opportunity_id: string | number; opportunities: Opp | Opp[] | null }

// Fursa alizohifadhi mtumiaji, zikipangwa kwa deadline iliyo karibu zaidi.
export default async function SavedList({ userId }: { userId: string }) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('opp_saved')
    .select(
      'opportunity_id, opportunities(id, title, organization, type, deadline, region, degree_level, coverage_type, study_field, is_remote, apply_url)'
    )
    .eq('user_id', userId)

  if (error) {
    return (
      <p className="geometric-card p-4 text-sm text-red-600">
        Imeshindikana kupakia: {error.message}. Hakikisha umeendesha supabase/opportunities.sql.
      </p>
    )
  }

  const list = ((data ?? []) as unknown as Row[])
    .map((r) => (Array.isArray(r.opportunities) ? r.opportunities[0] : r.opportunities))
    .filter((o): o is Opp => Boolean(o))
    .sort((a, b) => {
      const da = daysLeft(a.deadline)
      const db = daysLeft(b.deadline)
      if (da === null) return 1
      if (db === null) return -1
      return da - db
    })

  if (list.length === 0) {
    return (
      <EmptyPanel
        icon={Bookmark}
        title="Hujahifadhi fursa yoyote"
        text="Bonyeza alama ya bookmark kwenye fursa yoyote ili uihifadhi, na utaona tahadhari ya deadline ikikaribia."
      />
    )
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {list.map((o) => (
        <OpportunityCard key={String(o.id)} o={o} saved />
      ))}
    </ul>
  )
}

import { createClient } from '@/lib/supabase/server'
import CutoffCalculator, { type Program } from './CutoffCalculator'
import KanbanBoard, { type AppItem } from './KanbanBoard'

export default async function Admissions() {
  const supabase = await createClient()
  const [progRes, appRes] = await Promise.all([
    supabase
      .from('opp_programs')
      .select('id, university, program, combinations, min_points, notes')
      .eq('is_published', true)
      .order('university')
      .limit(500),
    supabase
      .from('opp_applications')
      .select('id, university, program, stage')
      .order('created_at', { ascending: true }),
  ])

  if (progRes.error || appRes.error) {
    return (
      <p className="geometric-card p-4 text-sm text-red-600">
        Imeshindikana kupakia: {(progRes.error ?? appRes.error)?.message}. Hakikisha umeendesha supabase/opportunities.sql.
      </p>
    )
  }

  const apps = (appRes.data ?? []) as AppItem[]
  const programs = (progRes.data ?? []).map((p) => ({ ...p, min_points: Number(p.min_points) })) as Program[]
  const tracked = apps.map((a) => `${a.university}||${a.program ?? ''}`)

  return (
    <div className="space-y-4">
      <CutoffCalculator programs={programs} tracked={tracked} />
      <KanbanBoard items={apps} />
    </div>
  )
}

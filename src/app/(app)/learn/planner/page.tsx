import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StudyPlanner from '@/components/learning/StudyPlanner'
export default async function StudyPlannerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')
  return <StudyPlanner />
}

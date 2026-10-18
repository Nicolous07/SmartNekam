import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DailyChallenge from '@/components/learning/DailyChallenge'
export default async function DailyChallengePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')
  return <DailyChallenge />
}

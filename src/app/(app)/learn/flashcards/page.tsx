import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Flashcards from '@/components/learning/Flashcards'
export default async function FlashcardsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')
  return <Flashcards />
}

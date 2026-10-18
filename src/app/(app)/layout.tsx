import { redirect } from 'next/navigation'
import AppNavbar, { type NavProfile } from '@/components/layout/AppNavbar'
import { createClient } from '@/lib/supabase/server'
import { isStaffUser } from '@/lib/admin'
import CreatePostButton from '@/components/posts/CreatePostButton'
import MobileSwipeNavigation from '@/components/layout/MobileSwipeNavigation'
import NotificationRealtimeBridge from '@/components/notifications/NotificationRealtimeBridge'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role, level, xp, coins, streak, longest_streak, status')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !profile) redirect('/onboarding')
  if (profile.status !== 'active') redirect('/auth?error=account_unavailable')

  return (
    <div className="min-h-screen">
      <AppNavbar profile={profile as NavProfile} isAdmin={isStaffUser(profile.role, user.email)} />
      <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-4 lg:px-6 lg:pb-0"><MobileSwipeNavigation>{children}</MobileSwipeNavigation></main>
      <CreatePostButton />
      <NotificationRealtimeBridge />
    </div>
  )
}

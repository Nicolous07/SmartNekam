import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isStaffUser } from '@/lib/admin'

const MAP: Record<string,string> = {
  dashboard: '/admin?section=overview',
  users: '/admin?section=users',
  library: '/admin?section=content',
  learning: '/admin?section=learning',
  'daily-challenge': '/admin?section=daily-challenge',
  'daily-challenges': '/admin?section=daily-challenge',
  moderation: '/admin?section=reports',
  community: '/admin?section=community',
  opportunities: '/admin?section=opportunities',
  mentors: '/admin?section=mentors',
  institutions: '/admin?section=institutions',
  finance: '/admin?section=payments',
  payments: '/admin?section=payments',
  notifications: '/admin?section=notifications',
  growth: '/admin?section=growth',
  support: '/admin?section=support',
  certificates: '/admin?section=certificates',
  security: '/admin?section=security',
  analytics: '/admin?section=analytics',
  reports: '/admin?section=reports',
  content: '/admin?section=content',
  settings: '/admin?section=overview',
  audit: '/admin?section=audit',
}
export default async function AdminModuleRedirect({params}:{params:Promise<{module:string}>}) {
  const { module } = await params
  const target = MAP[module]
  if (!target) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: profile } = await supabase.from('profiles').select('role,status').eq('id', user.id).maybeSingle()
  if (!isStaffUser(profile?.role, user.email) || profile?.status !== 'active') redirect('/dashboard')
  if ((module === 'finance' || module === 'payments') && profile?.role !== 'super_admin') redirect('/admin?section=overview')
  redirect(target)
}

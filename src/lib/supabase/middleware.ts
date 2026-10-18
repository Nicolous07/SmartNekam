import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isStaffUser } from '@/lib/admin'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  const isPublic = path === '/' || path.startsWith('/auth') || path.startsWith('/verify')
  const redirectTo = (to: string) => {
    const url = request.nextUrl.clone()
    url.pathname = to
    url.search = ''
    const redirect = NextResponse.redirect(url)
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    return redirect
  }

  if (!user) return isPublic ? response : redirectTo('/auth')
  if (path.startsWith('/auth/callback')) return response

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, level, role, status')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !profile.level) return path === '/onboarding' ? response : redirectTo('/onboarding')
  if (profile.status !== 'active') return redirectTo('/auth?error=account_unavailable')
  if (path === '/onboarding' || path.startsWith('/auth')) return redirectTo('/dashboard')
  if (path.startsWith('/admin') && !isStaffUser(profile.role, user.email)) return redirectTo('/dashboard')
  return response
}

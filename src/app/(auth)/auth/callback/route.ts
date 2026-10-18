import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_NEXT = '/dashboard'

function safeNextPath(value: string | null) {
  // Allow only same-origin absolute paths. Block protocol-relative URLs.
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return DEFAULT_NEXT
  }
  return value
}

function redirectToAuth(origin: string, reason: string, errorCode?: string, description?: string) {
  const url = new URL('/auth', origin)
  url.searchParams.set('error', reason === 'provider_error' ? 'oauth' : 'callback')
  url.searchParams.set('reason', reason)

  if (errorCode) url.searchParams.set('error_code', errorCode.slice(0, 100))
  if (description) url.searchParams.set('error_description', description.slice(0, 240))

  return NextResponse.redirect(url)
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const { searchParams, origin } = requestUrl
  const code = searchParams.get('code')
  const next = safeNextPath(searchParams.get('next'))

  // Supabase can send provider errors directly to the callback URL.
  const providerError = searchParams.get('error')
  if (providerError) {
    return redirectToAuth(
      origin,
      'provider_error',
      searchParams.get('error_code') ?? providerError,
      searchParams.get('error_description') ?? undefined,
    )
  }

  if (!code) {
    return redirectToAuth(origin, 'missing_code')
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      // Log only the error identifiers, never the auth code or session tokens.
      console.error('[SmartNekam auth callback] Code exchange failed:', {
        code: error.code,
        status: error.status,
        name: error.name,
      })
      return redirectToAuth(origin, 'exchange_failed', error.code ?? error.name)
    }

    return NextResponse.redirect(new URL(next, origin))
  } catch (error) {
    const safeError = error instanceof Error ? error.name : 'UnknownError'
    console.error('[SmartNekam auth callback] Unexpected callback error:', safeError)
    return redirectToAuth(origin, 'server_error', safeError)
  }
}

import { createClient } from 'npm:@supabase/supabase-js@2'
import * as webpush from 'jsr:@negrel/webpush@^0.5.0'

type NotificationRecord = {
  id: string
  user_id: string
  title: string
  body: string
  notification_type?: string
  data?: Record<string, unknown> | null
}

type WebhookPayload = {
  type?: string
  table?: string
  schema?: string
  record?: NotificationRecord | null
}

type WebPushSubscription = {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-smartnekam-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const expectedSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
  const suppliedSecret = req.headers.get('x-smartnekam-webhook-secret')
  if (!expectedSecret || !suppliedSecret || suppliedSecret !== expectedSecret) {
    return json({ error: 'Unauthorized webhook' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return json({ error: 'Push service environment is incomplete' }, 500)
  }

  let webhook: WebhookPayload
  try {
    webhook = await req.json() as WebhookPayload
  } catch {
    return json({ error: 'Request body must be valid JSON' }, 400)
  }
  const record = webhook.record
  if (webhook.type !== 'INSERT' || webhook.table !== 'notifications' || webhook.schema !== 'public' || !record?.id || !record.user_id) {
    return json({ ok: true, skipped: 'Not a notification INSERT event' })
  }
  if (/umefungua taarifa hii bila kuondoka kwenye ukurasa/i.test(`${record.title} ${record.body}`)) {
    return json({ ok: true, sent: 0, skipped: 'internal navigation notice' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // A webhook can be processed just after the recipient has answered/rejected.
  // Do not create a late device alert for a call which is already resolved.
  if (record.notification_type === 'call' && typeof record.data?.call_signal_id === 'string') {
    const callSignalId = record.data.call_signal_id
    const { data: responses, error: responseError } = await supabase
      .from('smartnekam_call_signals')
      .select('id')
      .eq('conversation_id', String(record.data.conversation_id || ''))
      .contains('signal', { callSignalId })
      .in('signal->>type', ['answer', 'reject'])
      .limit(1)
    if (responseError) return json({ error: 'Could not verify incoming-call status before push' }, 500)
    if (responses?.length) return json({ ok: true, sent: 0, skipped: 'call was already answered or rejected' })
  }

  const [{ data: devices, error: devicesError }, { data: preferences, error: preferencesError }] = await Promise.all([
    supabase.from('push_devices')
      .select('id,device_token')
      .eq('user_id', record.user_id)
      .eq('platform', 'web')
      .eq('is_active', true),
    supabase.from('notification_preferences')
      .select('push_enabled')
      .eq('user_id', record.user_id)
      .maybeSingle(),
  ])

  if (devicesError) return json({ error: 'Could not load push subscriptions' }, 500)
  if (preferencesError) return json({ error: 'Could not load notification preferences' }, 500)
  if (preferences?.push_enabled === false || !devices?.length) {
    return json({ ok: true, sent: 0, reason: preferences?.push_enabled === false ? 'push disabled by user' : 'no active web subscriptions' })
  }

  let appServer: webpush.ApplicationServer
  try {
    const exportedKeys = convertVapidKeysToJWK(vapidPublicKey, vapidPrivateKey)
    const vapidKeys = await webpush.importVapidKeys(exportedKeys, { extractable: false })
    appServer = await webpush.ApplicationServer.new({
      contactInformation: Deno.env.get('VAPID_SUBJECT') || 'mailto:notifications@smartnekam.app',
      vapidKeys,
    })
  } catch (error) {
    return json({ error: `VAPID key configuration is invalid: ${error instanceof Error ? error.message : 'key error'}` }, 500)
  }

  const href = targetForNotification(record)
  let sent = 0
  let expired = 0
  const failures: string[] = []

  await Promise.all(devices.map(async (device) => {
    try {
      const subscription = JSON.parse(device.device_token) as WebPushSubscription
      if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        throw new Error('Invalid browser push subscription format')
      }
      const subscriber = appServer.subscribe({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      })
      await subscriber.pushTextMessage(JSON.stringify({
        id: record.id,
        title: record.title || 'SmartNekam',
        body: record.body || 'Una taarifa mpya kwenye SmartNekam.',
        href,
        notificationType: record.notification_type || 'system',
        conversationId: typeof record.data?.conversation_id === 'string' ? record.data.conversation_id : undefined,
        callerId: typeof record.data?.caller_id === 'string' ? record.data.caller_id : undefined,
        callSignalId: typeof record.data?.call_signal_id === 'string' ? record.data.call_signal_id : undefined,
      }), {})
      sent += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : 'send failed'
      const errorValue = error as { status?: unknown; statusCode?: unknown; response?: { status?: unknown } }
      const statusCode = Number(errorValue?.response?.status ?? errorValue?.statusCode ?? errorValue?.status ?? 0)
      if (statusCode === 404 || statusCode === 410 || /\b(404|410)\b/.test(message)) {
        expired += 1
        await supabase.from('push_devices').update({ is_active: false }).eq('id', device.id)
      } else {
        failures.push(`device ${device.id}: ${message}`)
      }
    }
  }))

  return json({ ok: true, sent, expired, failed: failures.length, failures: failures.slice(0, 3) })
})

function targetForNotification(record: NotificationRecord): string {
  const data = record.data ?? {}
  const conversationId = typeof data.conversation_id === 'string' ? data.conversation_id : ''
  const postId = typeof data.post_id === 'string' ? data.post_id : ''
  const questionId = typeof data.question_id === 'string' ? data.question_id : ''
  const groupId = typeof data.group_id === 'string' ? data.group_id : ''
  const source = typeof data.source === 'string' ? data.source : ''
  const status = typeof data.status === 'string' ? data.status : ''

  // IDs identify the actual destination more reliably than a legacy generic notifications URL.
  if (conversationId) {
    const params = new URLSearchParams({ tab: 'chats', conversation: conversationId })
    return `/communities?${params.toString()}`
  }
  if (postId) return `/posts/${encodeURIComponent(postId)}`
  if (questionId) return `/communities/questions/${encodeURIComponent(questionId)}`
  if (groupId) return '/communities?tab=groups'
  if (source === 'mentor_request') return '/communities?tab=mentors'
  if (source === 'mentor_request_response') {
    return status === 'accepted' ? '/communities?tab=chats' : '/communities?tab=mentors'
  }

  const href = data.href
  if (typeof href === 'string' && href.startsWith('/') && !href.startsWith('//') && href !== '/notifications' && !href.startsWith('/notifications?') && !href.startsWith('/notifications/')) {
    return href
  }

  switch (record.notification_type) {
    case 'chat':
      return '/communities?tab=chats'
    case 'mentor':
      return '/communities?tab=mentors'
    case 'community':
      return '/communities'
    case 'content_review':
      return '/library'
    case 'deadline':
      return '/opportunities'
    case 'application':
      return '/applications'
    case 'achievement':
    case 'referral':
    case 'security':
      return '/profile'
    default:
      return '/dashboard'
  }
}

function convertVapidKeysToJWK(publicKeyBase64url: string, privateKeyBase64url: string) {
  const publicBytes = base64urlToBytes(publicKeyBase64url)
  if (publicBytes.length !== 65 || publicBytes[0] !== 4) {
    throw new Error('VAPID public key must be an uncompressed P-256 key of 65 bytes.')
  }
  const x = publicBytes.slice(1, 33)
  const y = publicBytes.slice(33, 65)
  const d = base64urlToBytes(privateKeyBase64url)
  if (d.length !== 32) throw new Error('VAPID private key must be 32 bytes.')
  return {
    publicKey: {
      kty: 'EC', crv: 'P-256', alg: 'ES256',
      x: bytesToBase64url(x), y: bytesToBase64url(y),
      key_ops: ['verify'], ext: true,
    },
    privateKey: {
      kty: 'EC', crv: 'P-256', alg: 'ES256',
      x: bytesToBase64url(x), y: bytesToBase64url(y), d: bytesToBase64url(d),
      key_ops: ['sign'], ext: true,
    },
  } as webpush.ExportedVapidKeys
}

function base64urlToBytes(value: string): Uint8Array {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(Array.from(raw).map((character) => character.charCodeAt(0)))
}

function bytesToBase64url(value: Uint8Array): string {
  let binary = ''
  for (const byte of value) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

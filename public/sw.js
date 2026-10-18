/* SmartNekam Web Push service worker. Keep this file at the site root. */
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data ? event.data.text() : '' }
  }

  const title = typeof payload.title === 'string' && payload.title.trim()
    ? payload.title
    : 'SmartNekam'
  const isIncomingCall = payload.notificationType === 'call'
  const href = typeof payload.href === 'string' && payload.href.startsWith('/') && !payload.href.startsWith('//')
    ? payload.href
    : '/notifications'
  const callSignalId = typeof payload.callSignalId === 'string' ? payload.callSignalId : ''
  const conversationId = typeof payload.conversationId === 'string' ? payload.conversationId : ''
  const callerId = typeof payload.callerId === 'string' ? payload.callerId : ''

  const options = {
    body: typeof payload.body === 'string' ? payload.body : 'Una taarifa mpya kwenye SmartNekam.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: isIncomingCall
      ? `smartnekam-call-${callSignalId || conversationId || payload.id || 'incoming'}`
      : (typeof payload.id === 'string' ? `smartnekam-${payload.id}` : 'smartnekam-notification'),
    renotify: isIncomingCall,
    // Incoming-call alerts intentionally stay visible until the call is answered/rejected.
    requireInteraction: isIncomingCall,
    vibrate: isIncomingCall ? [300, 100, 300, 100, 600] : [100],
    actions: isIncomingCall ? [
      { action: 'answer', title: 'Pokea' },
      { action: 'reject', title: 'Kata' },
    ] : [],
    data: {
      href,
      isIncomingCall,
      callSignalId,
      conversationId,
      callerId,
    },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data || {}
  const isIncomingCall = data.isIncomingCall === true
  const href = typeof data.href === 'string' && data.href.startsWith('/') && !data.href.startsWith('//')
    ? data.href
    : '/notifications'
  const destinationUrl = new URL(href, self.location.origin)

  if (isIncomingCall && (event.action === 'answer' || event.action === 'reject')) {
    destinationUrl.searchParams.set('tab', 'chats')
    if (typeof data.conversationId === 'string' && data.conversationId) destinationUrl.searchParams.set('conversation', data.conversationId)
    destinationUrl.searchParams.set('callAction', event.action)
    if (typeof data.callSignalId === 'string' && data.callSignalId) destinationUrl.searchParams.set('callSignalId', data.callSignalId)
    if (typeof data.callerId === 'string' && data.callerId) destinationUrl.searchParams.set('callerId', data.callerId)
  } else if (!isIncomingCall) {
    // Ordinary notifications close on click. A call alert does not close on body-click;
    // it is dismissed after the app sends the answer/reject signal.
    event.notification.close()
  }

  event.waitUntil((async () => {
    const destination = destinationUrl.href
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        await client.navigate(destination)
        return client.focus()
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(destination)
    return undefined
  })())
})

// Called by the page only after the recipient successfully answers or rejects the call.
self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || data.type !== 'SMARTNEKAM_CALL_RESOLVED') return
  const callSignalId = typeof data.callSignalId === 'string' ? data.callSignalId : ''
  const conversationId = typeof data.conversationId === 'string' ? data.conversationId : ''
  event.waitUntil(self.registration.getNotifications().then((notifications) => {
    for (const notification of notifications) {
      const noticeData = notification.data || {}
      const matchesSignal = callSignalId && noticeData.callSignalId === callSignalId
      const matchesConversation = !callSignalId && conversationId && noticeData.conversationId === conversationId
      if (matchesSignal || matchesConversation) notification.close()
    }
  }))
})

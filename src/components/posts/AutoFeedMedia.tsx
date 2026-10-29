'use client'

import { useCallback, useEffect, useRef } from 'react'

type FeedMediaNode = HTMLVideoElement | HTMLIFrameElement
type FeedMediaEntry = {
  ratio: number
  play: () => void
  pause: () => void
}

const MIN_VISIBLE_RATIO = 0.55
const feedMediaEntries = new Map<FeedMediaNode, FeedMediaEntry>()
let activeFeedMedia: FeedMediaNode | null = null
let visibilityListenerInstalled = false

function syncActiveFeedMedia(forcePlay = false) {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    if (activeFeedMedia) feedMediaEntries.get(activeFeedMedia)?.pause()
    activeFeedMedia = null
    return
  }

  let bestNode: FeedMediaNode | null = null
  let bestEntry: FeedMediaEntry | null = null
  for (const [node, entry] of feedMediaEntries) {
    if (entry.ratio >= MIN_VISIBLE_RATIO && (!bestEntry || entry.ratio > bestEntry.ratio)) {
      bestNode = node
      bestEntry = entry
    }
  }

  const nextActive = bestNode && bestEntry ? bestNode : null
  if (nextActive === activeFeedMedia) {
    if (forcePlay && nextActive) feedMediaEntries.get(nextActive)?.play()
    return
  }

  const previousActive = activeFeedMedia
  activeFeedMedia = nextActive
  if (previousActive) feedMediaEntries.get(previousActive)?.pause()
  if (nextActive) feedMediaEntries.get(nextActive)?.play()
}

function handleVisibilityChange() {
  if (typeof document === 'undefined') return
  if (document.visibilityState === 'hidden') {
    if (activeFeedMedia) feedMediaEntries.get(activeFeedMedia)?.pause()
    activeFeedMedia = null
    return
  }
  syncActiveFeedMedia(true)
}

function registerFeedMedia(
  node: FeedMediaNode,
  play: () => void,
  pause: () => void,
) {
  feedMediaEntries.set(node, { ratio: 0, play, pause })
  if (!visibilityListenerInstalled && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    visibilityListenerInstalled = true
  }
  return () => {
    const entry = feedMediaEntries.get(node)
    entry?.pause()
    feedMediaEntries.delete(node)
    if (activeFeedMedia === node) activeFeedMedia = null
    syncActiveFeedMedia()
    if (feedMediaEntries.size === 0 && visibilityListenerInstalled && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      visibilityListenerInstalled = false
    }
  }
}

function updateFeedMediaVisibility(node: FeedMediaNode, ratio: number) {
  const entry = feedMediaEntries.get(node)
  if (!entry) return
  feedMediaEntries.set(node, { ...entry, ratio })
  syncActiveFeedMedia()
}

function claimFeedMedia(node: FeedMediaNode) {
  const entry = feedMediaEntries.get(node)
  if (!entry || activeFeedMedia === node) return
  // Ikiwa mtumiaji amebonyeza Play mwenyewe, heshimu chaguo lake na usimamishe nyingine.
  feedMediaEntries.set(node, { ...entry, ratio: 1 })
  syncActiveFeedMedia(true)
}

function retryActiveFeedMedia(node: FeedMediaNode) {
  if (activeFeedMedia === node) feedMediaEntries.get(node)?.play()
}

function useFeedMediaAutoplay(
  ref: React.RefObject<FeedMediaNode | null>,
  play: () => void,
  pause: () => void,
) {
  useEffect(() => {
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') return

    const unregister = registerFeedMedia(node, play, pause)
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        updateFeedMediaVisibility(node, entry.isIntersecting ? entry.intersectionRatio : 0)
      }
    }, { threshold: [0, 0.1, 0.25, 0.4, MIN_VISIBLE_RATIO, 0.7, 0.85, 1] })

    observer.observe(node)
    return () => {
      observer.disconnect()
      unregister()
    }
  }, [ref, play, pause])
}

export function AutoFeedVideo({
  src,
  mimeType,
  controls = true,
  ariaLabel = 'Video ya SmartNekam',
  className = '',
  preload = 'metadata',
}: {
  src: string
  mimeType?: string
  controls?: boolean
  ariaLabel?: string
  className?: string
  preload?: 'none' | 'metadata' | 'auto'
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  const play = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    // Autoplay yenye sauti huzuiwa na browser nyingi; mtumiaji bado anaweza kuwasha sauti kupitia controls.
    video.muted = true
    video.defaultMuted = true
    const playback = video.play()
    if (playback && typeof playback.catch === 'function') {
      void playback.catch(() => {
        // Browser inaweza kuzuia autoplay; controls zinaendelea kufanya kazi kawaida.
      })
    }
  }, [])

  const pause = useCallback(() => {
    const video = videoRef.current
    if (video && !video.paused) video.pause()
  }, [])

  useFeedMediaAutoplay(videoRef, play, pause)

  return (
    <video
      ref={videoRef}
      src={mimeType ? undefined : src}
      controls={controls}
      playsInline
      muted
      preload={preload}
      aria-label={ariaLabel}
      className={className}
      onPlay={() => videoRef.current && claimFeedMedia(videoRef.current)}
    >
      {mimeType && <source src={src} type={mimeType} />}
      Kivinjari chako hakiwezi kucheza video hii.
    </video>
  )
}

function sendEmbedCommand(frame: HTMLIFrameElement, platform: string, action: 'play' | 'pause') {
  const target = frame.contentWindow
  if (!target) return

  if (platform === 'YouTube') {
    const command = action === 'play' ? 'playVideo' : 'pauseVideo'
    if (action === 'play') {
      target.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: [] }), '*')
    }
    target.postMessage(JSON.stringify({ event: 'command', func: command, args: [] }), '*')
    return
  }

  if (platform === 'TikTok') {
    if (action === 'play') {
      target.postMessage({ type: 'mute', value: null, 'x-tiktok-player': true }, '*')
    }
    target.postMessage({ type: action, value: null, 'x-tiktok-player': true }, '*')
    return
  }

  if (platform === 'Vimeo') {
    if (action === 'play') target.postMessage(JSON.stringify({ method: 'setVolume', value: 0 }), '*')
    target.postMessage(JSON.stringify({ method: action }), '*')
    return
  }

  // Watoa embed wengine hawatoi amri za play/pause zinazoweza kuitwa na ukurasa wenye embed.
}

export function AutoFeedEmbed({
  src,
  platform,
  title,
  loading = 'lazy',
  className = '',
}: {
  src: string
  platform: string
  title: string
  loading?: 'eager' | 'lazy'
  className?: string
}) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const play = useCallback(() => {
    if (frameRef.current) sendEmbedCommand(frameRef.current, platform, 'play')
  }, [platform])
  const pause = useCallback(() => {
    if (frameRef.current) sendEmbedCommand(frameRef.current, platform, 'pause')
  }, [platform])

  useFeedMediaAutoplay(frameRef, play, pause)

  return (
    <iframe
      ref={frameRef}
      src={src}
      title={title}
      loading={loading}
      onLoad={() => {
        const frame = frameRef.current
        if (frame) retryActiveFeedMedia(frame)
      }}
      className={className}
      style={{ border: 0, pointerEvents: 'auto', touchAction: 'manipulation' }}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
    />
  )
}

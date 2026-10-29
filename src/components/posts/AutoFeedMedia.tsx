'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

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
  ref: RefObject<FeedMediaNode | null>,
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

function supportsCanvasPreview(src: string) {
  try {
    const url = new URL(src, 'https://smartnekam.vercel.app/')
    // Supabase Storage and the same-origin app can be read by canvas when CORS permits it.
    return url.origin === 'https://smartnekam.vercel.app' || url.hostname.endsWith('.supabase.co')
  } catch {
    return false
  }
}

function usesSupabaseCors(src: string) {
  try {
    return new URL(src, 'https://smartnekam.vercel.app/').hostname.endsWith('.supabase.co')
  } catch {
    return false
  }
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
  const previewCaptured = useRef(false)
  const [previewFrame, setPreviewFrame] = useState<string | null>(null)
  const canCapturePreview = supportsCanvasPreview(src)
  const useCors = usesSupabaseCors(src)

  const capturePreviewFrame = useCallback((video: HTMLVideoElement) => {
    if (previewCaptured.current || !canCapturePreview || !video.videoWidth || !video.videoHeight) return
    try {
      // A small thumbnail is enough for the blurred background and costs very little memory.
      const scale = Math.min(1, 480 / video.videoWidth)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
      const context = canvas.getContext('2d')
      if (!context) return
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      const frame = canvas.toDataURL('image/jpeg', 0.68)
      previewCaptured.current = true
      setPreviewFrame(frame)
    } catch {
      // Cross-origin sources without CORS still play normally; they simply keep the dark background.
    }
  }, [canCapturePreview])

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
    <div className="relative isolate w-full overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {previewFrame && (
        <img
          src={previewFrame}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl"
        />
      )}
      <video
        ref={videoRef}
        src={mimeType ? undefined : src}
        crossOrigin={useCors ? 'anonymous' : undefined}
        controls={controls}
        playsInline
        muted
        preload={preload}
        aria-label={ariaLabel}
        className={`relative z-10 ${className}`}
        style={{ backgroundColor: 'transparent' }}
        onLoadedData={(event) => capturePreviewFrame(event.currentTarget)}
        onPlay={() => videoRef.current && claimFeedMedia(videoRef.current)}
      >
        {mimeType && <source src={src} type={mimeType} />}
        Kivinjari chako hakiwezi kucheza video hii.
      </video>
    </div>
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

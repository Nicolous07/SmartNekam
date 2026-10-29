'use client'

import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { restoreStructure } from '@/lib/postText'

/**
 * Huonyesha posts kwa maandishi ya kawaida, Markdown na majedwali.
 * Alama ghafi za LaTeX hubadilishwa kuwa maelezo mafupi ili zisichanganye wasomaji.
 */
function simplifyMathForReaders(src: string) {
  return restoreStructure(src).split('\n').map((line) => {
    // Ikiwa post ina command za LaTeX (mfano \sqrt, \sum, \int) kwenye sehemu
    // ya fomula, onyesha ujumbe unaoeleweka badala ya kuonyesha syntax ghafi.
    if (/\\(?:sqrt|sum|int|frac|prod|lim|infty|alpha|beta|theta|pi|cdot|times|leq|geq|neq|approx)\b/i.test(line)) {
      const first = line.indexOf('$')
      const last = line.lastIndexOf('$')
      if (first !== -1 && last > first) return `${line.slice(0, first)}(fomula ya hesabu)${line.slice(last + 1)}`
      return line.replace(/\\(?:sqrt|sum|int|frac|prod|lim|infty|alpha|beta|theta|pi|cdot|times|leq|geq|neq|approx)\b[^\s]*/gi, 'fomula ya hesabu').replace(/[${}]/g, '')
    }
    // Fomula rahisi huonekana bila dollar delimiters; daraja la kawaida hubadilishwa kuwa superscript.
    return line.replace(/\$([^$\n]+)\$/g, (_, expression: string) => expression
      .replace(/\\times\b/g, '×').replace(/\\cdot\b/g, '·').replace(/\\leq\b/g, '≤')
      .replace(/\\geq\b/g, '≥').replace(/\\neq\b/g, '≠').replace(/\\pi\b/g, 'π')
      .replace(/\^\{?([0-9])\}?/g, (_, digit: string) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(digit)] ?? digit)
    ).replace(/\\\(|\\\)|\\\[|\\\]/g, '')
  }).join('\n')
}

type SocialVideoEmbed = {
  platform: string
  src: string
  kind: 'iframe' | 'file'
  isYouTubeShort?: boolean
}

function getSocialVideoEmbed(href: string | undefined): SocialVideoEmbed | null {
  if (!href) return null
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

  const rawHost = url.hostname.toLowerCase()
  const host = rawHost.startsWith('www.') ? rawHost.slice(4) : rawHost
  const parts = url.pathname.split('/').filter(Boolean)
  const first = parts[0] ?? ''
  const second = parts[1] ?? ''

  // Direct video URLs can use the browser's native player.
  const path = url.pathname.toLowerCase()
  if (['.mp4', '.webm', '.m4v', '.mov'].some((extension) => path.endsWith(extension))) {
    return { platform: 'Video', src: url.href, kind: 'file' }
  }

  // YouTube watch, short, live and embed links.
  let videoId = ''
  if (host === 'youtu.be') {
    videoId = first
  } else if (['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)) {
    if (url.pathname === '/watch') videoId = url.searchParams.get('v') ?? ''
    else if (['shorts', 'embed', 'live', 'v'].includes(first)) videoId = second
  }
  if (/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    return {
      platform: 'YouTube',
      src: `https://www.youtube-nocookie.com/embed/${videoId}?controls=1&playsinline=1&rel=0`,
      kind: 'iframe',
      isYouTubeShort: host !== 'youtu.be' && first === 'shorts',
    }
  }

  // TikTok's official player requires the post ID from /@creator/video/{id}.
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
    const videoIndex = parts.indexOf('video')
    const tiktokId = videoIndex >= 0 ? parts[videoIndex + 1] ?? '' : ''
    if (/^\d+$/.test(tiktokId)) {
      return { platform: 'TikTok', src: `https://www.tiktok.com/player/v1/${tiktokId}?autoplay=0&controls=1&play_button=1&progress_bar=1&volume_control=1&fullscreen_button=1&muted=0`, kind: 'iframe' }
    }
  }

  // Instagram public posts, reels and IGTV posts support an embed endpoint.
  if (host === 'instagram.com' || host === 'instagr.am') {
    if (['reel', 'p', 'tv'].includes(first) && second) {
      return { platform: 'Instagram', src: `https://www.instagram.com/${first}/${encodeURIComponent(second)}/embed/`, kind: 'iframe' }
    }
  }

  // Facebook's official video plugin accepts the original public video/reel URL.
  if (host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.watch') {
    return {
      platform: 'Facebook',
      src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url.href)}&show_text=false`,
      kind: 'iframe',
    }
  }

  // X video is delivered as part of an embedded public post.
  if (host === 'x.com' || host === 'twitter.com' || host === 'mobile.twitter.com') {
    const statusIndex = parts.indexOf('status')
    const postId = statusIndex >= 0 ? parts[statusIndex + 1] ?? '' : ''
    if (/^\d+$/.test(postId)) {
      return { platform: 'X', src: `https://platform.twitter.com/embed/Tweet.html?id=${postId}&dnt=true`, kind: 'iframe' }
    }
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const vimeoId = host === 'player.vimeo.com' && first === 'video' ? second : first
    if (/^\d+$/.test(vimeoId)) {
      return { platform: 'Vimeo', src: `https://player.vimeo.com/video/${vimeoId}`, kind: 'iframe' }
    }
  }

  if (host === 'dailymotion.com' || host === 'dai.ly') {
    const dailyId = host === 'dai.ly' ? first : (first === 'video' ? second : '')
    if (/^[A-Za-z0-9]+$/.test(dailyId)) {
      return { platform: 'Dailymotion', src: `https://www.dailymotion.com/embed/video/${dailyId}`, kind: 'iframe' }
    }
  }

  return null
}

export default function RichContent({
  text,
  className = '',
}: {
  text: string
  className?: string
}) {

  return (
    <div className={`rich-content break-words ${className}`}>
      <Markdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-emerald-200 dark:border-slate-700">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-emerald-600 text-white dark:bg-emerald-700">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-emerald-100 dark:divide-slate-700">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="even:bg-emerald-50/60 dark:even:bg-slate-800/50">{children}</tr>
          ),
          th: ({ children, style }) => (
            <th
              style={style}
              className="border-r border-emerald-500/40 px-3 py-2 text-left font-bold last:border-r-0"
            >
              {children}
            </th>
          ),
          td: ({ children, style }) => (
            <td
              style={style}
              className="border-r border-emerald-100 px-3 py-2 align-top last:border-r-0 dark:border-slate-700"
            >
              {children}
            </td>
          ),
          p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
          code: ({ children }) => (
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] dark:bg-slate-800">
              {children}
            </code>
          ),
          a: ({ children, href }) => {
            const embed = getSocialVideoEmbed(typeof href === 'string' ? href : undefined)
            if (embed?.kind === 'file') {              return (
                <span className="my-3 block overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm dark:border-slate-800">
                  <video controls playsInline preload="metadata" className="max-h-[38rem] w-full bg-black" src={embed.src}>
                    Kivinjari chako hakiwezi kucheza video hii.
                  </video>
                </span>
              )
            }
            if (embed?.kind === 'iframe') {
              const isYouTubeShort = Boolean(embed.isYouTubeShort)
              const isVertical = isYouTubeShort || embed.platform === 'TikTok' || embed.platform === 'Instagram'              return (
                <span className={`my-3 block rounded-2xl border border-slate-200 bg-slate-950 shadow-sm dark:border-slate-800 ${embed.platform === 'TikTok' ? 'overflow-x-auto overflow-y-hidden' : 'overflow-hidden'}`}>
                  <span className={`relative mx-auto block w-full bg-black ${isYouTubeShort ? 'aspect-[9/16] max-h-[min(78svh,760px)] max-w-md' : isVertical ? `aspect-[9/16] max-h-[38rem] max-w-sm ${embed.platform === 'TikTok' ? 'min-w-[325px]' : ''}` : 'aspect-video min-h-[220px]'}`}>
                    <iframe
                      src={embed.src}
                      title={`Video ya ${embed.platform} kwenye SmartNekam`}
                      loading="lazy"
                      className="pointer-events-auto absolute inset-0 block h-full w-full touch-manipulation" style={{ border: 0, pointerEvents: 'auto', touchAction: 'manipulation' }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  </span>
                  <span className="block px-3 py-2 text-[11px] text-slate-300">
                    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-indigo-200 hover:text-white">
                      Fungua kwenye {embed.platform}
                    </a>
                  </span>
                </span>
              )
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="font-medium text-emerald-700 underline dark:text-emerald-400"
              >
                {children}
              </a>
            )
          },
        }}
      >
        {simplifyMathForReaders(text)}
      </Markdown>
    </div>
  )
}

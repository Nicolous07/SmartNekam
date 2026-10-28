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

function getYouTubeVideoId(href: string | undefined): string | null {
  if (!href) return null
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return null
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  let id = ''
  if (host === 'youtu.be') {
    id = url.pathname.split('/').filter(Boolean)[0] ?? ''
  } else if (['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)) {
    const parts = url.pathname.split('/').filter(Boolean)
    if (url.pathname === '/watch') id = url.searchParams.get('v') ?? ''
    else if (['shorts', 'embed', 'live', 'v'].includes(parts[0] ?? '')) id = parts[1] ?? ''
  }

  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
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
            const videoId = getYouTubeVideoId(typeof href === 'string' ? href : undefined)
            if (videoId) {
              return (
                <span className="my-3 block overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm dark:border-slate-800">
                  <span className="flex items-center gap-2 px-3 py-2.5 text-xs font-extrabold text-white">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-600">▶</span>
                    <span>YouTube · Cheza ndani ya SmartNekam</span>
                  </span>
                  <span className="relative block aspect-video w-full bg-black">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0`}
                      title="Video ya YouTube kwenye SmartNekam"
                      loading="lazy"
                      className="absolute inset-0 h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  </span>
                  <span className="block px-3 py-2 text-[11px] text-slate-300">
                    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-indigo-200 hover:text-white">
                      Fungua kwenye YouTube
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

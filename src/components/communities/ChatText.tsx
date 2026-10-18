import { Fragment } from 'react'

// ```lang\nkodi``` inaonyeshwa kama kisanduku cha kodi; viungo na @majina vinaangaziwa.
const FENCE_RE = /```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g
const INLINE_RE = /(https?:\/\/[^\s<]+|@[a-zA-Z0-9_]{3,20})/g

type Part =
  | { type: 'text'; value: string }
  | { type: 'code'; lang: string; value: string }

function parse(src: string): Part[] {
  const parts: Part[] = []
  let last = 0
  for (const m of src.matchAll(FENCE_RE)) {
    const idx = m.index ?? 0
    if (idx > last) parts.push({ type: 'text', value: src.slice(last, idx) })
    parts.push({ type: 'code', lang: m[1] ?? '', value: (m[2] ?? '').replace(/\n$/, '') })
    last = idx + m[0].length
  }
  if (last < src.length) parts.push({ type: 'text', value: src.slice(last) })
  return parts
}

function Inline({ text }: { text: string }) {
  const pieces = text.split(INLINE_RE)
  return (
    <>
      {pieces.map((p, i) => {
        if (!p) return null
        if (/^https?:\/\//.test(p)) {
          return (
            <a
              key={i}
              href={p}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="break-all font-medium text-emerald-700 underline dark:text-emerald-400"
            >
              {p}
            </a>
          )
        }
        if (/^@[a-zA-Z0-9_]{3,20}$/.test(p)) {
          return (
            <span key={i} className="font-semibold text-emerald-600 dark:text-emerald-400">
              {p}
            </span>
          )
        }
        return <Fragment key={i}>{p}</Fragment>
      })}
    </>
  )
}

export default function ChatText({ text }: { text: string }) {
  const parts = parse(text)
  return (
    <div className="break-words text-sm text-slate-800 dark:text-slate-200">
      {parts.map((p, i) =>
        p.type === 'code' ? (
          <div key={i} className="my-1.5 overflow-hidden rounded-lg bg-slate-900">
            {p.lang && (
              <p className="border-b border-slate-700 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {p.lang}
              </p>
            )}
            <pre className="overflow-x-auto p-3 text-xs leading-relaxed text-slate-100">
              <code>{p.value}</code>
            </pre>
          </div>
        ) : (
          <span key={i} className="whitespace-pre-wrap">
            <Inline text={p.value} />
          </span>
        )
      )}
    </div>
  )
}

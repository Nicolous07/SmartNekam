'use client'

import { useMemo, useRef } from 'react'
import type { Language } from '@/lib/learn/courses'

// Editor ndogo bila maktaba ya nje: namba za mistari, rangi za maneno muhimu (syntax highlighting),
// Tab = nafasi, auto-indent kwenye Enter, na kufunga kiotomatiki mabano/nukuu.
// Ukitaka editor kamili baadaye (auto-complete halisi), badilisha faili hili kwa CodeMirror/Monaco.

const PY_KW =
  'and as assert break class continue def del elif else except finally for from global if import in is lambda None nonlocal not or pass raise return try while with yield True False print len range input int str float list dict set sum min max sorted'
const JS_KW =
  'async await break case catch class const continue default do else export extends false finally for from function if import in instanceof let new null of return switch this throw true try typeof undefined var while console'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const C = {
  kw: 'text-emerald-400',
  str: 'text-amber-300',
  num: 'text-sky-300',
  com: 'text-slate-500 italic',
  tag: 'text-emerald-400',
  attr: 'text-sky-300',
}
const span = (cls: string, s: string) => `<span class="${cls}">${esc(s)}</span>`

function highlight(code: string, lang: Language): string {
  if (lang === 'html') {
    const re = /(<!--[\s\S]*?-->)|(<\/?[a-zA-Z][^>]*>?)|([^<]+|<)/g
    return code.replace(re, (m, comment, tag) => {
      if (comment) return span(C.com, m)
      if (tag) {
        // <tag attr="x"> => tag kijani, sifa bluu, thamani njano
        const inner = esc(m).replace(
          /(&lt;\/?)([a-zA-Z0-9-]+)|([a-zA-Z-:]+)(=)(&quot;[^&]*&quot;|"[^"]*"|'[^']*')|(&gt;)/g,
          (x, o, name, attr, eq, val, close) => {
            if (name) return `${o}<span class="${C.tag}">${name}</span>`
            if (attr) return `<span class="${C.attr}">${attr}</span>${eq}<span class="${C.str}">${val}</span>`
            if (close) return close
            return x
          }
        )
        return inner
      }
      return esc(m)
    })
  }

  const kw = new Set((lang === 'python' ? PY_KW : JS_KW).split(' '))
  const comment = lang === 'python' ? '#[^\\n]*' : '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/'
  const re = new RegExp(
    `(${comment})|("""[\\s\\S]*?"""|'[^'\\n]*'?|"[^"\\n]*"?|\`[^\`]*\`?)|(\\b\\d+(?:\\.\\d+)?\\b)|([A-Za-z_][A-Za-z0-9_]*)`,
    'g'
  )
  let out = ''
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(code))) {
    out += esc(code.slice(last, m.index))
    if (m[1]) out += span(C.com, m[1])
    else if (m[2]) out += span(C.str, m[2])
    else if (m[3]) out += span(C.num, m[3])
    else out += kw.has(m[4]) ? span(C.kw, m[4]) : esc(m[4])
    last = m.index + m[0].length
  }
  return out + esc(code.slice(last))
}

const PAIRS: Record<string, string> = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" }
const TEXT = 'text-base leading-6 sm:text-[13px] sm:leading-5'

export default function CodeEditor({
  value,
  onChange,
  language,
  height = 'h-72',
  readOnly = false,
}: {
  value: string
  onChange: (v: string) => void
  language: Language
  height?: string
  readOnly?: boolean
}) {
  const gutterRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const html = useMemo(() => highlight(value, language) + '\n', [value, language])
  const lineCount = value.split('\n').length

  function sync() {
    const ta = taRef.current
    if (!ta) return
    const t = `translate(${-ta.scrollLeft}px, ${-ta.scrollTop}px)`
    if (layerRef.current) layerRef.current.style.transform = t
    if (gutterRef.current) gutterRef.current.style.transform = `translateY(${-ta.scrollTop}px)`
  }

  // Tunabadilisha DOM moja kwa moja (na kuweka caret papo hapo) kisha tunaarifu React.
  // Hii inazuia caret kuruka wakati mtu anaandika haraka.
  function edit(next: string, caret: number) {
    const ta = taRef.current
    if (ta) {
      ta.value = next
      ta.setSelectionRange(caret, caret)
    }
    onChange(next)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget
    const { selectionStart: s, selectionEnd: en } = ta
    const value = ta.value // chanzo cha kweli (prop inaweza kuchelewa kusasishwa)
    const indentUnit = language === 'python' ? '    ' : '  '

    if (e.key === 'Tab') {
      e.preventDefault()
      edit(value.slice(0, s) + indentUnit + value.slice(en), s + indentUnit.length)
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      const lineStart = value.lastIndexOf('\n', s - 1) + 1
      const line = value.slice(lineStart, s)
      let indent = /^[ \t]*/.exec(line)?.[0] ?? ''
      const trimmed = line.trimEnd()
      const opens =
        (language === 'python' && trimmed.endsWith(':')) ||
        (language !== 'python' && /[{([]$/.test(trimmed))
      if (opens) indent += indentUnit
      const between = value[s - 1] === '{' && value[s] === '}'
      if (between) {
        const close = '\n' + indent.slice(0, Math.max(0, indent.length - indentUnit.length))
        edit(value.slice(0, s) + '\n' + indent + close + value.slice(en), s + 1 + indent.length)
      } else {
        edit(value.slice(0, s) + '\n' + indent + value.slice(en), s + 1 + indent.length)
      }
      return
    }

    // Kufunga kiotomatiki: ( [ { " '
    if (PAIRS[e.key] && s === en && language !== 'html') {
      const next = value[s]
      const isQuote = e.key === '"' || e.key === "'"
      if (isQuote && next === e.key) {
        e.preventDefault()
        edit(value, s + 1) // ruka nukuu ya kufunga iliyopo
        return
      }
      const prev = value[s - 1] ?? ''
      if (isQuote && /\w/.test(prev)) return // mf. don't
      e.preventDefault()
      edit(value.slice(0, s) + e.key + PAIRS[e.key] + value.slice(en), s + 1)
      return
    }

    // Kuandika alama ya kufunga ambayo tayari ipo: ruka tu
    if ((e.key === ')' || e.key === ']' || e.key === '}') && s === en && value[s] === e.key) {
      e.preventDefault()
      edit(value, s + 1)
    }
  }

  return (
    <div
      className={`relative flex overflow-hidden rounded-xl border border-slate-700 bg-slate-950 font-mono ${height}`}
    >
      <div
        aria-hidden
        className={`w-10 shrink-0 select-none overflow-hidden border-r border-slate-800 bg-slate-900/60 ${TEXT}`}
      >
        <div ref={gutterRef} className="px-2 py-3 text-right text-slate-500">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
      </div>

      <div className="relative min-w-0 flex-1">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div ref={layerRef}>
            <pre
              className={`m-0 whitespace-pre p-3 text-slate-100 ${TEXT}`}
              style={{ tabSize: 4, fontFamily: 'inherit' }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </div>
        <textarea
          ref={taRef}
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onScroll={sync}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          wrap="off"
          aria-label="Code editor"
          className={`absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent p-3 text-transparent caret-white outline-none selection:bg-emerald-700/50 ${TEXT}`}
          style={{ tabSize: 4, fontFamily: 'inherit' }}
        />
      </div>
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import { ChevronUp, Loader2, Send, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export type AmaQuestion = {
  id: string
  event_id: string
  author_id: string
  content: string
  status: 'pending' | 'selected' | 'answered' | 'rejected'
  created_at: string
  author_name: string | null
  author_username: string | null
  vote_count: number
  voted_by_me: boolean
}

const STATUS_LABEL: Record<AmaQuestion['status'], string> = {
  pending: 'Linasubiri',
  selected: 'Linajibiwa sasa',
  answered: 'Limejibiwa',
  rejected: 'Limekataliwa',
}

const STATUS_STYLE: Record<AmaQuestion['status'], string> = {
  pending: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  selected: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  answered: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
}

const ORDER: Record<AmaQuestion['status'], number> = {
  selected: 0,
  pending: 1,
  answered: 2,
  rejected: 3,
}

export default function AmaQuestions({
  eventId,
  currentUserId,
  isStaff,
  closed,
  initial,
}: {
  eventId: string
  currentUserId: string
  isStaff: boolean
  closed: boolean
  initial: AmaQuestion[]
}) {
  const supabase = useMemo(() => createClient(), [])
  const [questions, setQuestions] = useState<AmaQuestion[]>(initial)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const sorted = [...questions]
    .filter((q) => isStaff || q.status !== 'rejected')
    .sort(
      (a, b) =>
        ORDER[a.status] - ORDER[b.status] ||
        b.vote_count - a.vote_count ||
        a.created_at.localeCompare(b.created_at)
    )

  async function ask() {
    const content = text.trim()
    if (content.length < 5) {
      setError('Swali liwe na angalau herufi 5.')
      return
    }
    setSending(true)
    setError('')
    const { data, error: insErr } = await supabase
      .from('ama_questions')
      .insert({ event_id: eventId, author_id: currentUserId, content })
      .select('id')
      .single()
    if (insErr || !data) {
      setError('Imeshindikana kutuma swali. Jaribu tena.')
    } else {
      const { data: row } = await supabase
        .from('ama_questions_feed')
        .select(
          'id, event_id, author_id, content, status, created_at, author_name, author_username, vote_count, voted_by_me'
        )
        .eq('id', data.id)
        .maybeSingle()
      if (row) setQuestions((prev) => [...prev, row as AmaQuestion])
      setText('')
    }
    setSending(false)
  }

  async function toggleVote(q: AmaQuestion) {
    const next = !q.voted_by_me
    setQuestions((prev) =>
      prev.map((x) =>
        x.id === q.id
          ? { ...x, voted_by_me: next, vote_count: x.vote_count + (next ? 1 : -1) }
          : x
      )
    )
    const res = next
      ? await supabase.from('ama_question_votes').insert({ question_id: q.id })
      : await supabase
          .from('ama_question_votes')
          .delete()
          .eq('question_id', q.id)
          .eq('user_id', currentUserId)
    if (res.error && res.error.code !== '23505') {
      setQuestions((prev) =>
        prev.map((x) =>
          x.id === q.id
            ? { ...x, voted_by_me: !next, vote_count: x.vote_count + (next ? -1 : 1) }
            : x
        )
      )
    }
  }

  async function setStatus(q: AmaQuestion, status: AmaQuestion['status']) {
    const { error: rpcErr } = await supabase.rpc('set_ama_question_status', {
      p_question: q.id,
      p_status: status,
    })
    if (!rpcErr) {
      setQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, status } : x)))
    }
  }

  async function remove(q: AmaQuestion) {
    const { error: delErr } = await supabase.from('ama_questions').delete().eq('id', q.id)
    if (!delErr) setQuestions((prev) => prev.filter((x) => x.id !== q.id))
  }

  return (
    <div className="space-y-4">
      {!closed && (
        <div className="geometric-card space-y-2 p-4">
          <label className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Uliza swali lako
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 300))}
            rows={2}
            placeholder="Andika swali unalotaka mgeni alijibu..."
            className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">{text.length}/300</span>
            <button
              type="button"
              onClick={ask}
              disabled={sending || text.trim().length < 5}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-500 active:scale-95 disabled:opacity-40"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Tuma swali
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="geometric-card p-5 text-center text-sm text-slate-500 dark:text-slate-400">
          Bado hakuna maswali. Kuwa wa kwanza kuuliza!
        </p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((q, i) => (
            <li
              key={q.id}
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              className={`geometric-card anim-fade-up flex gap-3 p-3 ${
                q.status === 'selected' ? 'ring-2 ring-amber-400' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => toggleVote(q)}
                aria-pressed={q.voted_by_me}
                aria-label="Piga kura swali hili"
                className={`flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl border-2 transition active:scale-90 ${
                  q.voted_by_me
                    ? 'border-emerald-500 bg-emerald-600 text-white'
                    : 'border-slate-200 text-slate-600 hover:border-emerald-300 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                <ChevronUp className="h-4 w-4" />
                <span className="text-sm font-extrabold">{q.vote_count}</span>
              </button>

              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap break-words text-sm text-slate-900 dark:text-slate-100">
                  {q.content}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>{q.author_name ?? q.author_username ?? 'Mtumiaji'}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[q.status]}`}>
                    {STATUS_LABEL[q.status]}
                  </span>
                </p>

                {isStaff && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(['selected', 'answered', 'pending', 'rejected'] as const)
                      .filter((s) => s !== q.status)
                      .map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setStatus(q, s)}
                          className="rounded-full border border-slate-300 px-2.5 py-0.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          {STATUS_LABEL[s]}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {(q.author_id === currentUserId || isStaff) && (
                <button
                  type="button"
                  onClick={() => remove(q)}
                  aria-label="Futa swali"
                  className="self-start rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

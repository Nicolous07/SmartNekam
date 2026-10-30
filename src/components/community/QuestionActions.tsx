'use client'

import { type FormEvent, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, Send, ThumbsUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Answer = {
  id: string
  user_id: string
  body: string
  upvotes: number
  is_best_answer: boolean
  created_at: string
  author_name?: string | null
  author_username?: string | null
}

type Props = {
  questionId: string
  questionOwnerId: string
  currentUserId: string
  initialAnswers: Answer[]
  status: string
}

export default function QuestionActions({
  questionId,
  questionOwnerId,
  currentUserId,
  initialAnswers,
  status,
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [answers, setAnswers] = useState(initialAnswers)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [voted, setVoted] = useState<string[]>([])

  async function sendAnswer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { error: insertError } = await supabase.from('answers').insert({
        question_id: questionId,
        user_id: currentUserId,
        body: body.trim(),
      })
      if (insertError) throw insertError
      setBody('')
      setNotice('Jibu lako limeongezwa.')
      const { data, error: reloadError } = await supabase
        .from('answers')
        .select('id,user_id,body,upvotes,is_best_answer,created_at')
        .eq('question_id', questionId)
        .order('created_at', { ascending: true })
      if (reloadError) throw reloadError
      const rows=(data??[]) as Answer[]
      const authorIds=[...new Set(rows.map(answer=>answer.user_id))]
      const {data:authorProfiles}=authorIds.length
        ? await supabase.from('profiles').select('id,full_name,username').in('id',authorIds)
        : {data:[]}
      const authorMap=new Map((authorProfiles??[]).map(profile=>[profile.id,profile]))
      setAnswers(rows.map(answer=>({...answer,author_name:authorMap.get(answer.user_id)?.full_name??null,author_username:authorMap.get(answer.user_id)?.username??null})))
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Imeshindikana kuongeza jibu.')
    } finally {
      setBusy(false)
    }
  }

  async function vote(answerId: string) {
    setError('')
    setNotice('')
    if (voted.includes(answerId)) return
    const { error: voteError } = await supabase.from('answer_votes').insert({
      answer_id: answerId,
      user_id: currentUserId,
    })
    if (voteError) {
      setError(voteError.code === '23505' ? 'Tayari umepiga kura kwa jibu hili.' : voteError.message)
      return
    }
    setVoted((prev) => [...prev, answerId])
    setAnswers((prev) => prev.map((answer) => answer.id === answerId
      ? { ...answer, upvotes: answer.upvotes + 1 }
      : answer))
  }

  async function chooseBestAnswer(answerId: string) {
    setBusy(true)
    setError('')
    setNotice('')
    const { error: rpcError } = await supabase.rpc('set_best_answer', {
      p_question_id: questionId,
      p_answer_id: answerId,
    })
    if (rpcError) {
      setError(rpcError.message)
    } else {
      setAnswers((prev) => prev.map((answer) => ({
        ...answer,
        is_best_answer: answer.id === answerId,
      })))
      setNotice('Jibu bora limechaguliwa.')
      router.refresh()
    }
    setBusy(false)
  }

  return (
    <div className="space-y-4">
      <section className="geometric-card p-4 sm:p-5">
        <h2 className="font-heading text-lg font-extrabold text-slate-950 dark:text-white">
          Majibu ({answers.length})
        </h2>
        <div className="mt-4 space-y-3">
          {answers.length > 0 ? answers.map((answer) => (
            <article
              key={answer.id}
              className={`rounded-2xl border p-4 ${answer.is_best_answer
                ? 'border-emerald-300 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/30'
                : 'border-slate-200 dark:border-slate-800'}`}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-xs font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                  {answer.is_best_answer ? <CheckCircle2 className="h-5 w-5" /> : 'J'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">{answer.body}</p>
                  <p className="mt-2 text-[11px] text-slate-400">
                    {answer.user_id === currentUserId ? 'Wewe' : (answer.author_name || (answer.author_username ? '@' + answer.author_username : 'Mwanafunzi'))} · {new Date(answer.created_at).toLocaleString('sw-TZ')}
                  </p>
                  {answer.is_best_answer && (
                    <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-extrabold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">
                      Jibu bora
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void vote(answer.id)}
                  disabled={voted.includes(answer.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                >
                  <ThumbsUp className="h-3.5 w-3.5" /> {answer.upvotes} kura
                </button>
                {questionOwnerId === currentUserId && !answer.is_best_answer && status !== 'closed' && status !== 'removed' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void chooseBestAnswer(answer.id)}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    Chagua jibu bora
                  </button>
                )}
              </div>
            </article>
          )) : (
            <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
              Hakuna jibu bado. Unaweza kuwa wa kwanza kusaidia.
            </p>
          )}
        </div>
      </section>

      <section className="geometric-card p-4 sm:p-5">
        <h2 className="font-heading font-extrabold text-slate-950 dark:text-white">Andika jibu lako</h2>
        <form onSubmit={sendAnswer} className="mt-3 space-y-3">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            minLength={2}
            maxLength={12000}
            rows={4}
            placeholder="Eleza hatua au maarifa yatakayomsaidia mwanafunzi..."
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          <button
            disabled={busy || status === 'closed' || status === 'removed'}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Tuma jibu
          </button>
        </form>
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      </section>
    </div>
  )
}

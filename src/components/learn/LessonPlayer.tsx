'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Play,
  CheckCheck,
  RotateCcw,
  Lightbulb,
  CheckCircle2,
  XCircle,
  Loader2,
  Trophy,
  Award,
  ArrowRight,
  MessageSquare,
} from 'lucide-react'
import RichContent from '@/components/posts/RichContent'
import CodeEditor from './CodeEditor'
import { runCode, type RunResult } from '@/lib/learn/runner'
import { PASS_RATIO } from '@/lib/learn/config'
import type { ClientLesson } from '@/lib/learn/courses'
import { completeLesson, type CompleteResult } from '@/app/(app)/learn/actions'

type Props = {
  courseSlug: string
  lesson: ClientLesson
  alreadyDone: boolean
  nextHref: string | null
  nextTitle: string | null
  channel: string
}

const btn =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-95 disabled:opacity-60 disabled:active:scale-100'

export default function LessonPlayer({ courseSlug, lesson, alreadyDone, nextHref, nextTitle, channel }: Props) {
  const draftKey = `learn:${courseSlug}:${lesson.slug}`
  const language = lesson.language ?? 'python'

  const [code, setCode] = useState(lesson.starter ?? '')
  const [running, setRunning] = useState<'run' | 'check' | null>(null)
  const [status, setStatus] = useState('')
  const [result, setResult] = useState<RunResult | null>(null)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [done, setDone] = useState(alreadyDone)
  const [reward, setReward] = useState<CompleteResult | null>(null)
  const [saveError, setSaveError] = useState('')

  // Quiz
  const quiz = useMemo(() => lesson.quiz ?? [], [lesson.quiz])
  const [answers, setAnswers] = useState<number[]>(() => quiz.map(() => -1))
  const [submitted, setSubmitted] = useState(false)

  // Rudisha rasimu ya kodi iliyohifadhiwa kwenye browser hii (kama ipo)
  const loaded = useRef(false)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved !== null && lesson.kind === 'code') setCode(saved)
    } catch {
      /* hifadhi ya browser haipatikani */
    }
    loaded.current = true
  }, [draftKey, lesson.kind])

  useEffect(() => {
    if (!loaded.current || lesson.kind !== 'code') return
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, code)
      } catch {
        /* puuza */
      }
    }, 500)
    return () => clearTimeout(t)
  }, [code, draftKey, lesson.kind])

  const passedCount = result?.results?.filter((r) => r.pass).length ?? 0
  const totalTests = result?.results?.length ?? 0

  async function saveCompletion() {
    setSaveError('')
    const r = await completeLesson(courseSlug, lesson.slug)
    if (!r.ok) {
      setSaveError(r.error ?? 'Imeshindikana kuhifadhi maendeleo.')
      return
    }
    setReward(r)
    setDone(true)
  }

  async function run(mode: 'run' | 'check') {
    setRunning(mode)
    setSaveError('')
    setStatus('')
    if (language === 'html') setPreviewHtml(code)
    try {
      const r = await runCode({
        language,
        code,
        tests: mode === 'check' ? lesson.tests : undefined,
        packages: lesson.packages,
        onStatus: (s) =>
          setStatus(s === 'loading' ? 'Inapakia Python (mara ya kwanza huchukua sekunde chache)...' : 'Inaendesha...'),
      })
      setResult(r)
      if (mode === 'check') {
        const all = r.results && r.results.length > 0 && !r.error && r.results.every((t) => t.pass)
        if (all) await saveCompletion()
      }
    } finally {
      setRunning(null)
      setStatus('')
    }
  }

  function resetCode() {
    setCode(lesson.starter ?? '')
    setResult(null)
    try {
      localStorage.removeItem(draftKey)
    } catch {
      /* puuza */
    }
  }

  // ---------- Quiz ----------
  const score = useMemo(
    () => quiz.reduce((n, q, i) => n + (answers[i] === q.answer ? 1 : 0), 0),
    [quiz, answers]
  )
  const quizPassed = quiz.length > 0 && score / quiz.length >= PASS_RATIO

  async function submitQuiz() {
    setSubmitted(true)
    if (quizPassed) await saveCompletion()
  }

  function retryQuiz() {
    setAnswers(quiz.map(() => -1))
    setSubmitted(false)
  }

  return (
    <div className="space-y-4">
      <div className="geometric-card p-5">
        <RichContent text={lesson.body} className="learn-body text-sm text-slate-700 dark:text-slate-300" />
      </div>

      {lesson.kind === 'code' && (
        <div className="space-y-3">
          <CodeEditor value={code} onChange={setCode} language={language} />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => run('run')}
              disabled={running !== null}
              className={`${btn} bg-slate-800 text-white hover:bg-slate-700 dark:bg-slate-700`}
            >
              {running === 'run' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run Code
            </button>
            <button
              type="button"
              onClick={() => run('check')}
              disabled={running !== null}
              className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}
            >
              {running === 'check' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
              Hakiki kazi
            </button>
            <button
              type="button"
              onClick={resetCode}
              disabled={running !== null}
              className={`${btn} border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300`}
            >
              <RotateCcw className="h-4 w-4" /> Anza upya
            </button>
            {lesson.hint && (
              <button
                type="button"
                onClick={() => setShowHint((v) => !v)}
                className={`${btn} border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300`}
              >
                <Lightbulb className="h-4 w-4" /> {showHint ? 'Ficha dokezo' : 'Dokezo'}
              </button>
            )}
          </div>

          {showHint && lesson.hint && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              💡 {lesson.hint}
            </p>
          )}

          {status && (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> {status}
            </p>
          )}

          {language === 'html' && previewHtml !== null && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
              <p className="border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                Muonekano
              </p>
              <iframe title="Muonekano wa ukurasa" sandbox="" srcDoc={previewHtml} className="h-56 w-full bg-white" />
            </div>
          )}

          {result && (
            <div className="space-y-3">
              {(language !== 'html' || result.error) && (
                <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                  <p className="border-b border-slate-800 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                    Matokeo (Console)
                  </p>
                  <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[13px] text-slate-100">
                    {result.output || (result.error ? '' : '(hakuna matokeo ya kuonyesha)')}
                    {result.error && <span className="text-red-400">{(result.output ? '\n' : '') + result.error}</span>}
                  </pre>
                </div>
              )}

              {result.results && result.results.length > 0 && (
                <div className="geometric-card p-4">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Majaribio: {passedCount}/{totalTests} yamepita
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {result.results.map((t, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        {t.pass ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        ) : (
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                        )}
                        <span className={t.pass ? 'text-slate-700 dark:text-slate-300' : 'text-red-600 dark:text-red-400'}>
                          {t.name}
                          {t.msg ? ` — ${t.msg}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {passedCount < totalTests && (
                    <p className="mt-3 text-xs text-slate-500">
                      Bado. Soma makosa hapo juu, rekebisha kodi, kisha bofya &quot;Hakiki kazi&quot; tena.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {lesson.kind === 'quiz' && (
        <div className="space-y-4">
          {quiz.map((q, qi) => (
            <fieldset key={qi} className="geometric-card p-4">
              <legend className="px-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                {qi + 1}. {q.q}
              </legend>
              <div className="mt-2 space-y-2">
                {q.options.map((o, oi) => {
                  const picked = answers[qi] === oi
                  const right = submitted && oi === q.answer
                  const wrong = submitted && picked && oi !== q.answer
                  return (
                    <label
                      key={oi}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                        right
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950'
                          : wrong
                            ? 'border-red-400 bg-red-50 dark:bg-red-950'
                            : picked
                              ? 'border-emerald-500 bg-emerald-50/60 dark:bg-slate-800'
                              : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q${qi}`}
                        className="mt-1 accent-emerald-600"
                        checked={picked}
                        disabled={submitted}
                        onChange={() => setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))}
                      />
                      <span className="text-slate-800 dark:text-slate-200">{o}</span>
                    </label>
                  )
                })}
              </div>
              {submitted && (
                <p
                  className={`mt-2 text-xs ${
                    answers[qi] === q.answer ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {answers[qi] === q.answer ? '✔ Sahihi. ' : '✘ Si sahihi. '}
                  {q.why}
                </p>
              )}
            </fieldset>
          ))}

          {!submitted ? (
            <button
              type="button"
              onClick={submitQuiz}
              disabled={answers.some((a) => a < 0)}
              className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}
            >
              <CheckCheck className="h-4 w-4" /> Wasilisha majibu
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Alama: {score}/{quiz.length}
              </p>
              {!quizPassed && (
                <button
                  type="button"
                  onClick={retryQuiz}
                  className={`${btn} border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200`}
                >
                  <RotateCcw className="h-4 w-4" /> Jaribu tena
                </button>
              )}
              {!quizPassed && (
                <span className="text-xs text-slate-500">Unahitaji angalau theluthi mbili ya maswali sahihi.</span>
              )}
            </div>
          )}
        </div>
      )}

      {saveError && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {saveError} Hakikisha umeendesha supabase/learn.sql, kisha jaribu tena.
        </p>
      )}

      {done && (
        <div className="anim-scale-in geometric-card border-emerald-400 p-5 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <Trophy className="h-6 w-6" />
          </span>
          <p className="mt-2 font-heading text-lg font-extrabold text-slate-900 dark:text-slate-100">
            {reward ? 'Hongera! Umepita somo hili' : 'Umeshamaliza somo hili'}
          </p>
          {reward && reward.points > 0 && (
            <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              +{reward.points} EduPoints
            </p>
          )}
          {reward && reward.points === 0 && (
            <p className="mt-1 text-xs text-slate-500">Ulishapata EduPoints za somo hili mwanzo.</p>
          )}
          {reward?.courseCompleted && reward.certificate && (
            <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <p className="font-bold">🎓 Umekamilisha kozi nzima!</p>
              <Link
                href={`/verify/${reward.certificate}`}
                className="mt-1 inline-flex items-center gap-1 font-bold underline"
              >
                <Award className="h-4 w-4" /> Fungua cheti chako
              </Link>
            </div>
          )}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {nextHref ? (
              <Link href={nextHref} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}>
                Somo lijalo{nextTitle ? `: ${nextTitle}` : ''} <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link href="/learn?tab=vyeti" className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}>
                Tazama vyeti vyangu <Award className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      )}

      <Link
        href="/communities"
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <MessageSquare className="h-4 w-4 text-emerald-600" />
        Umekwama? Uliza kwenye Jamii ({channel})
      </Link>
    </div>
  )
}

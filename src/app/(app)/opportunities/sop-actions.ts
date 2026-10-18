'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { SOP_COST_POINTS } from '@/lib/opportunities'

export type SopInput = {
  mode: 'draft' | 'review'
  language: 'English' | 'Kiswahili'
  target: string // chuo / scholarship
  program: string
  background: string
  achievements: string
  goals: string
  existingText: string // kwa mode 'review'
}

export type SopResult = { ok: true; output: string; balance: number } | { ok: false; error: string }

const clip = (s: unknown, n: number) => (typeof s === 'string' ? s.trim().slice(0, n) : '')

export async function runSopAssistant(raw: SopInput): Promise<SopResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Tafadhali ingia kwanza.' }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { ok: false, error: 'Huduma ya AI haijawashwa (ANTHROPIC_API_KEY haipo kwenye server).' }

  const input: SopInput = {
    mode: raw.mode === 'review' ? 'review' : 'draft',
    language: raw.language === 'Kiswahili' ? 'Kiswahili' : 'English',
    target: clip(raw.target, 160),
    program: clip(raw.program, 160),
    background: clip(raw.background, 1500),
    achievements: clip(raw.achievements, 1500),
    goals: clip(raw.goals, 1000),
    existingText: clip(raw.existingText, 6000),
  }

  if (input.mode === 'draft' && (input.background.length < 30 || !input.target)) {
    return { ok: false, error: 'Andika chuo/scholarship na maelezo ya msingi (angalau sentensi chache).' }
  }
  if (input.mode === 'review' && input.existingText.length < 100) {
    return { ok: false, error: 'Bandika rasimu yako (angalau maneno machache) ili ihakikiwe.' }
  }

  // Angalia salio kabla ya kupiga AI (hakuna makato hadi ifanikiwe)
  const { data: prof } = await supabase.from('profiles').select('edupoints_balance').eq('id', user.id).single()
  const balance = prof?.edupoints_balance ?? 0
  if (balance < SOP_COST_POINTS) {
    return { ok: false, error: `Unahitaji angalau ${SOP_COST_POINTS} EduPoints. Salio lako ni ${balance}.` }
  }

  const system =
    'You are an admissions writing coach for East African students. Write in the requested language. ' +
    'Use ONLY facts the student provided; never invent achievements, grades, names or numbers. ' +
    'Where a detail is missing, insert a short [bracketed placeholder]. Keep a sincere, specific, professional tone.'

  const userPrompt =
    input.mode === 'draft'
      ? `Write a Statement of Purpose / Motivation Letter (about 400-500 words) in ${input.language}.\n` +
        `Target: ${input.target}\nProgram: ${input.program}\n` +
        `Background: ${input.background}\nAchievements: ${input.achievements}\nGoals: ${input.goals}`
      : `Review this draft for ${input.target || 'an application'} in ${input.language}. Give: (1) 3-5 strengths, (2) 3-5 concrete weaknesses, ` +
        `(3) a tightened rewrite. Do not invent facts.\n\nDRAFT:\n${input.existingText}`

  let output = ''
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: 1500,
        system,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })
    if (!res.ok) return { ok: false, error: 'AI imeshindwa kujibu. Hujakatwa pointi, jaribu tena.' }
    const json = (await res.json()) as { content?: { type: string; text?: string }[] }
    output = (json.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n').trim()
  } catch {
    return { ok: false, error: 'Tatizo la mtandao. Hujakatwa pointi, jaribu tena.' }
  }
  if (!output) return { ok: false, error: 'AI haikurudisha maandishi. Hujakatwa pointi.' }

  // Kata pointi baada ya mafanikio (RPC salama upande wa server)
  const { data: newBal, error: spendErr } = await supabase.rpc('spend_edupoints', {
    p_amount: SOP_COST_POINTS,
    p_reason: input.mode === 'draft' ? 'sop_draft' : 'sop_review',
  })
  if (spendErr) return { ok: false, error: 'Imeshindikana kukata EduPoints (salio linaweza kuwa limebadilika).' }

  await supabase.from('opp_sop_drafts').insert({
    mode: input.mode,
    title: input.target || null,
    input: { ...input, existingText: input.mode === 'review' ? '(imehifadhiwa kwenye output)' : '' },
    output,
    points_spent: SOP_COST_POINTS,
  })

  revalidatePath('/opportunities')
  return { ok: true, output, balance: typeof newBal === 'number' ? newBal : balance - SOP_COST_POINTS }
}

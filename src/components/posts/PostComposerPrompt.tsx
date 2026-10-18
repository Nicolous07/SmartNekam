'use client'

import { ImagePlus, Plus } from 'lucide-react'

export default function PostComposerPrompt({ displayName }: { displayName: string }) {
  function openComposer() {
    window.dispatchEvent(new Event('smartnekam:create-post'))
  }

  return <button type="button" onClick={openComposer} className="geometric-card flex w-full items-center gap-3 p-3 text-left transition hover:border-emerald-400 hover:bg-emerald-50/60 dark:hover:bg-slate-900 sm:p-4">
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-800 text-sm font-extrabold text-white">{displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'S'}</span>
    <span className="min-w-0 flex-1 rounded-full border border-emerald-100 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">Shiriki wazo, swali au mafanikio yako...</span>
    <span className="hidden items-center gap-1.5 rounded-xl bg-emerald-100 px-3 py-2 text-xs font-extrabold text-emerald-800 sm:inline-flex dark:bg-emerald-950 dark:text-emerald-200"><ImagePlus className="h-4 w-4" /> Picha</span>
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white sm:hidden"><Plus className="h-5 w-5" /></span>
  </button>
}

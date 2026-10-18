'use client'

import { useState } from 'react'
import { PenLine } from 'lucide-react'

export default function OpenPostComposerButton({ label = 'Shiriki post' }: { label?: string }) {
  const [opened, setOpened] = useState(false)
  return <button type="button" onClick={() => { window.dispatchEvent(new Event('smartnekam:create-post')); setOpened(true) }} className="inline-flex items-center justify-center gap-1.5 rounded-xl sn-primary-gradient px-3 py-2 text-xs font-extrabold text-white transition active:scale-[0.98]">
    <PenLine className="h-3.5 w-3.5" />{opened ? 'Andika post nyingine' : label}
  </button>
}

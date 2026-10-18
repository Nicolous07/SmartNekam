'use client'

import { Printer } from 'lucide-react'

export default function PrintCertificateButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
      type="button"
    >
      <Printer className="h-4 w-4" /> Print / Save PDF
    </button>
  )
}

'use client'

import { useState } from 'react'
import { Check, Download, Link2, Share2 } from 'lucide-react'

const btn =
  'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-95'

export default function CertificateActions({
  url,
  title,
  code,
  year,
  month,
}: {
  url: string
  title: string
  code: string
  year: number
  month: number
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard haipatikani */
    }
  }

  const linkedin =
    'https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME' +
    `&name=${encodeURIComponent(title)}` +
    '&organizationName=SmartNekam' +
    `&issueYear=${year}&issueMonth=${month}` +
    `&certUrl=${encodeURIComponent(url)}&certId=${encodeURIComponent(code)}`

  return (
    <div className="flex flex-wrap justify-center gap-2 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}
      >
        <Download className="h-4 w-4" /> Pakua (PDF)
      </button>
      <button
        type="button"
        onClick={copy}
        className={`${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
      >
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Link2 className="h-4 w-4" />}
        {copied ? 'Imenakiliwa' : 'Nakili kiungo'}
      </button>
      <a
        href={linkedin}
        target="_blank"
        rel="noopener noreferrer"
        className={`${btn} bg-[#0a66c2] text-white hover:opacity-90`}
      >
        <Share2 className="h-4 w-4" /> Weka LinkedIn
      </a>
    </div>
  )
}

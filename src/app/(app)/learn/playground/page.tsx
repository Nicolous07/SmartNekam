import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import Playground from '@/components/learn/Playground'

export const metadata = { title: 'Code Playground | SmartNekam' }

export default function PlaygroundPage() {
  return (
    <div className="mx-auto mt-2 max-w-3xl space-y-4">
      <Link href="/learn" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Learn
      </Link>
      <div>
        <h1 className="font-heading text-2xl font-extrabold text-slate-900 dark:text-slate-100">Code Playground</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Andika na uendeshe Python, JavaScript au HTML/CSS papo hapo, bila kusakinisha chochote. Inafanya kazi kwenye simu na laptop.
        </p>
      </div>
      <Playground />
    </div>
  )
}

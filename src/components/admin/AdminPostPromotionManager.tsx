'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BadgeCheck, Loader2, Megaphone, Pin, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type PromotionPost = {
  post_id: string
  subject: string | null
  content: string
  category: string
  created_at: string
  author_name: string | null
  is_pinned: boolean
  is_sponsored: boolean
  promotion_label: string | null
  promoted_until: string | null
  promotion_payment_reference: string | null
  promotion_payment_confirmed: boolean
}

const fieldClass = 'mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white'

function toLocalDateTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function dateLabel(value: string) {
  return new Date(value).toLocaleString('sw-TZ', { dateStyle: 'medium', timeStyle: 'short' })
}

function PromotionPostRow({ post, onSaved }: { post: PromotionPost; onSaved: () => void }) {
  const supabase = useMemo(() => createClient(), [])
  const [pinned, setPinned] = useState(post.is_pinned)
  const [sponsored, setSponsored] = useState(post.is_sponsored)
  const [label, setLabel] = useState(post.promotion_label ?? '')
  const [until, setUntil] = useState(toLocalDateTime(post.promoted_until))
  const [paymentReference, setPaymentReference] = useState(post.promotion_payment_reference ?? '')
  const [paymentConfirmed, setPaymentConfirmed] = useState(post.promotion_payment_confirmed)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function save() {
    setBusy(true)
    setError('')
    setSuccess('')

    if (sponsored && !pinned) {
      setError('Tangazo lililolipiwa lazima liwe limewekwa juu.')
      setBusy(false)
      return
    }
    if (sponsored && (!until || !paymentReference.trim() || !paymentConfirmed)) {
      setError('Kwa tangazo lililolipiwa, weka tarehe ya mwisho, payment reference na uthibitishe kwamba umekagua malipo.')
      setBusy(false)
      return
    }

    const { error: rpcError } = await supabase.rpc('admin_update_post_promotion', {
      p_post_id: post.post_id,
      p_is_pinned: pinned,
      p_is_sponsored: pinned && sponsored,
      p_promotion_label: label.trim() || null,
      p_promoted_until: until ? new Date(until).toISOString() : null,
      p_payment_reference: paymentReference.trim() || null,
      p_payment_confirmed: pinned && sponsored && paymentConfirmed,
    })

    setBusy(false)
    if (rpcError) {
      setError(rpcError.message.includes('admin_update_post_promotion')
        ? 'SQL 046 haijaendeshwa kwenye Supabase, au function haipatikani.'
        : rpcError.message)
      return
    }

    setSuccess(pinned ? (sponsored ? 'Tangazo limewekwa juu na kuhifadhiwa.' : 'Post imewekwa juu ya feed.') : 'Pin imeondolewa; post itapangwa kwa tarehe yake.')
    onSaved()
  }

  return (
    <article className="geometric-card space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-extrabold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-200">{post.category}</span>
            {post.is_pinned && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-extrabold text-amber-800 dark:bg-amber-950 dark:text-amber-200"><Pin className="h-3 w-3" /> Iko juu</span>}
            {post.is_sponsored && <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-1 text-[10px] font-extrabold text-violet-800 dark:bg-violet-950 dark:text-violet-200"><Megaphone className="h-3 w-3" /> Sponsored</span>}
          </div>
          <h4 className="mt-2 font-extrabold text-slate-950 dark:text-white">{post.subject || 'Post bila kichwa'}</h4>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600 dark:text-slate-300">{post.content.length > 260 ? `${post.content.slice(0, 260)}…` : post.content}</p>
          <p className="mt-2 text-xs text-slate-500">{post.author_name || 'Mtumiaji'} · {dateLabel(post.created_at)}</p>
          <p className="mt-1 break-all text-[10px] text-slate-400">Post ID: {post.post_id}</p>
          {post.is_sponsored && post.promoted_until && <p className="mt-1 text-xs text-violet-700 dark:text-violet-300">Promotion inaisha: {dateLabel(post.promoted_until)}</p>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Lebo inayoonekana kwenye feed (hiari)
          <input maxLength={120} value={label} onChange={(event) => setLabel(event.target.value)} className={fieldClass} placeholder="mf. Udahili wa Chuo 2027" />
        </label>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Tarehe ya mwisho (hiari kwa pin ya kawaida)
          <input type="datetime-local" value={until} onChange={(event) => setUntil(event.target.value)} className={fieldClass} />
        </label>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100"><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} className="h-4 w-4 accent-emerald-600" /><Pin className="h-4 w-4 text-amber-600" /> Weka juu ya feed</label>
          <label className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100"><input type="checkbox" checked={sponsored} onChange={(event) => setSponsored(event.target.checked)} className="h-4 w-4 accent-emerald-600" /><Megaphone className="h-4 w-4 text-violet-600" /> Tangazo lililolipiwa</label>
        </div>
        {sponsored && <div className="grid flex-1 gap-2 sm:max-w-md">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Payment reference iliyopokelewa
            <input required value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} className={fieldClass} placeholder="Reference kutoka provider/risiti" />
          </label>
          <label className="flex items-start gap-2 text-xs leading-5 text-slate-600 dark:text-slate-300"><input type="checkbox" checked={paymentConfirmed} onChange={(event) => setPaymentConfirmed(event.target.checked)} className="mt-1 h-4 w-4 accent-emerald-600" /><span><b className="inline-flex items-center gap-1"><BadgeCheck className="h-3.5 w-3.5" /> Malipo yamehakikiwa</b><span className="block">Thibitisha tu baada ya kukagua malipo kwenye provider au risiti. Sponsored posts zinahitaji Super Admin.</span></span></label>
        </div>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void save()} disabled={busy} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-500 disabled:opacity-50">{busy ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <Pin className="mr-2 inline h-4 w-4" />}{pinned ? sponsored ? 'Hifadhi tangazo' : 'Hifadhi pin' : 'Ondoa pin'}</button>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
        {success && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{success}</p>}
      </div>
    </article>
  )
}

export default function AdminPostPromotionManager() {
  const supabase = useMemo(() => createClient(), [])
  const [posts, setPosts] = useState<PromotionPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  const loadPosts = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('admin_list_posts_for_promotion', { p_limit: 100 })
    if (rpcError) {
      setError(rpcError.message.includes('admin_list_posts_for_promotion')
        ? 'SQL 046 haijaendeshwa kwenye Supabase, au function haipatikani.'
        : rpcError.message)
      setPosts([])
    } else {
      setPosts((data ?? []) as PromotionPost[])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { void loadPosts() }, [loadPosts, reload])

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h3 className="font-heading text-xl font-black text-slate-950 dark:text-white">Post Pinning & Sponsored Ads</h3><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">Chagua post iwe juu ya feed hata kama ni ya zamani. Pin ya kawaida inaweza kubaki hadi uiondoe; tangazo lililolipiwa linaisha kwenye tarehe uliyochagua.</p></div>
        <button type="button" onClick={() => setReload((value) => value + 1)} disabled={loading} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900">{loading ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 inline h-4 w-4" />} Refresh posts</button>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">Kwa sasa mfumo huhifadhi payment reference na uthibitisho wa admin; haujathibitishi malipo moja kwa moja kupitia webhook ya provider. Weka Sponsored tu baada ya kuthibitisha malipo mwenyewe. Muda ukiisha, post itaondoka juu ya feed kiotomatiki.</div>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{error}</p>}
      {loading ? <div className="geometric-card p-8 text-center text-sm text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Inapakia posts…</div> : posts.length ? posts.map((post) => <PromotionPostRow key={post.post_id} post={post} onSaved={() => setReload((value) => value + 1)} />) : !error ? <div className="geometric-card p-8 text-center text-sm text-slate-500">Hakuna post inayoonekana kwenye feed kwa sasa.</div> : null}
    </section>
  )
}

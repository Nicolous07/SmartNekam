import { Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import EmptyPanel from '@/components/layout/EmptyPanel'
import { IncomingRequests, TeamCardActions, TeamPostForm, type IncomingRequest } from './TeamClient'

type Post = {
  id: string
  author_id: string
  kind: 'looking_for_team' | 'looking_for_members'
  event_title: string
  my_skills: string
  seeking_skills: string | null
  message: string | null
  created_at: string
}
type Req = { id: string; post_id: string; requester_id: string; message: string | null; status: 'pending' | 'accepted' | 'declined' }

export default async function TeamMatchmaking({ userId }: { userId: string }) {
  const supabase = await createClient()

  const [{ data: postsData, error }, { data: reqData }] = await Promise.all([
    supabase
      .from('opp_team_posts')
      .select('id, author_id, kind, event_title, my_skills, seeking_skills, message, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(40),
    // RLS: naona maombi yangu mwenyewe na yale yaliyoingia kwenye post zangu
    supabase.from('opp_team_requests').select('id, post_id, requester_id, message, status'),
  ])

  if (error) {
    return (
      <p className="geometric-card p-4 text-sm text-red-600">
        Imeshindikana kupakia: {error.message}. Hakikisha umeendesha supabase/opportunities.sql.
      </p>
    )
  }

  const posts = (postsData ?? []) as Post[]
  const reqs = (reqData ?? []) as Req[]
  const myReq = new Map(reqs.filter((r) => r.requester_id === userId).map((r) => [r.post_id, r.status]))
  const myPostIds = new Set(posts.filter((p) => p.author_id === userId).map((p) => p.id))
  const incoming = reqs.filter((r) => myPostIds.has(r.post_id))

  // Majina (kama profile inaruhusu kusomwa; la sivyo "Mwanafunzi")
  const ids = [...new Set([...posts.map((p) => p.author_id), ...incoming.map((r) => r.requester_id)])]
  const names = new Map<string, string>()
  if (ids.length > 0) {
    const { data: profs } = await supabase.from('profiles').select('id, full_name, username').in('id', ids)
    profs?.forEach((p) => names.set(p.id, p.full_name ?? p.username ?? 'Mwanafunzi'))
  }
  const nameOf = (id: string) => names.get(id) ?? 'Mwanafunzi'

  const incomingItems: IncomingRequest[] = incoming.map((r) => ({
    id: r.id,
    eventTitle: posts.find((p) => p.id === r.post_id)?.event_title ?? '',
    requesterName: nameOf(r.requester_id),
    message: r.message,
    status: r.status,
  }))

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Unashindwa kushiriki hackathon kwa kukosa timu? Tafuta wenza wenye ujuzi unaokamilisha wako, mfano
        Computer Science na Business au Design.
      </p>
      <TeamPostForm />
      <IncomingRequests items={incomingItems} />

      {posts.length === 0 ? (
        <EmptyPanel icon={Users} title="Hakuna posts bado" text="Kuwa wa kwanza kuchapisha ujuzi wako au kutafuta wanatimu." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {posts.map((p) => (
            <li key={p.id} className="geometric-card space-y-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    p.kind === 'looking_for_members'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                  }`}
                >
                  {p.kind === 'looking_for_members' ? 'Natafuta wanatimu' : 'Natafuta timu'}
                </span>
                <span className="truncate text-xs text-slate-500">{nameOf(p.author_id)}</span>
              </div>
              <p className="font-bold text-slate-900 dark:text-slate-100">{p.event_title}</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                <b>Ujuzi:</b> {p.my_skills}
              </p>
              {p.seeking_skills && (
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  <b>Anatafuta:</b> {p.seeking_skills}
                </p>
              )}
              {p.message && <p className="text-sm text-slate-500 dark:text-slate-400">{p.message}</p>}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <TeamCardActions
                  postId={p.id}
                  mine={p.author_id === userId}
                  myRequestStatus={myReq.get(p.id) ?? null}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

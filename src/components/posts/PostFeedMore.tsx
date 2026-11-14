'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import PostCard, { type FeedPost } from './PostCard'
import { createClient } from '@/lib/supabase/client'

type FeedCursor = { created_at: string; id: string }

export default function PostFeedMore({
  initialCursor,
  initialHasMore,
  initialSeenIds,
  pageSize,
}: {
  initialCursor: FeedCursor | null
  initialHasMore: boolean
  initialSeenIds: string[]
  pageSize: number
}) {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [cursor, setCursor] = useState<FeedCursor | null>(initialCursor)
  const [hasMore, setHasMore] = useState(initialHasMore && Boolean(initialCursor))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const seenIdsRef = useRef(new Set(initialSeenIds))
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || !cursor) return
    setLoading(true)
    setError('')
    try {
      const supabase = supabaseRef.current ?? (supabaseRef.current = createClient())
      const { data, error: queryError } = await supabase
        .from('posts_feed')
        .select('id, author_id, category, subject, content, image_url, created_at, author_name, author_username, author_avatar, author_role, like_count, comment_count, share_count, liked_by_me, is_anonymous, attachments, author_follower_count, following_author_by_me')
        .or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(pageSize)

      if (queryError) throw queryError

      const rows = (data ?? []) as FeedPost[]
      const nextCursor = rows.length
        ? { created_at: rows[rows.length - 1].created_at, id: rows[rows.length - 1].id }
        : null

      const freshRows = rows.filter((post) => !seenIdsRef.current.has(post.id))
      for (const post of rows) seenIdsRef.current.add(post.id)
      if (freshRows.length) setPosts((current) => [...current, ...freshRows])
      setCursor(nextCursor)
      setHasMore(rows.length === pageSize && Boolean(nextCursor))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Imeshindikana kupakia machapisho mengine.')
    } finally {
      setLoading(false)
    }
  }, [cursor, hasMore, loading, pageSize])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasMore || error) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore()
    }, { rootMargin: '700px 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [error, hasMore, loadMore])

  if (posts.length === 0 && !hasMore && !error) return null

  return (
    <div className="space-y-4">
      {posts.map((post, index) => (
        <PostCard key={post.id} post={post} index={index} />
      ))}
      <div ref={sentinelRef} className="flex min-h-12 items-center justify-center" aria-live="polite">
        {loading && <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Inapakia machapisho mengine...</span>}
        {error && <div className="flex flex-col items-center gap-2 text-center"><p className="text-xs text-red-600">Imeshindikana kupakia machapisho: {error}</p><button type="button" onClick={() => void loadMore()} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Jaribu tena</button></div>}
        {!hasMore && !loading && !error && <p className="text-xs text-slate-400">Umefika mwisho wa machapisho yaliyopo.</p>}
      </div>
    </div>
  )
}

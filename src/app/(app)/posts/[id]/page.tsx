import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MessagesSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import PostCard, { type FeedPost } from '@/components/posts/PostCard'

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('posts_feed')
    .select('id, author_id, category, subject, content, image_url, created_at, author_name, author_username, author_avatar, author_role, like_count, comment_count, share_count, liked_by_me, is_anonymous, attachments, author_follower_count, following_author_by_me')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) notFound()
  return <div className="mx-auto max-w-3xl space-y-4">
    <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:underline dark:text-emerald-300"><ArrowLeft className="h-4 w-4" /> Rudi Home Feed</Link>
    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-300"><MessagesSquare className="h-4 w-4" /> Mjadala wa SmartNekam</div>
    <PostCard post={data as FeedPost} defaultOpenComments viewerId={user?.id ?? null} />
  </div>
}

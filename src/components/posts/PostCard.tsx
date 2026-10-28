'use client'

import { useEffect, useMemo, useState } from 'react'
import { Heart, MessageCircle, Share2, Send, Loader2, Check, CornerDownRight, X, FileText, FileImage, Download, UserPlus, Pin, Megaphone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import RichContent from '@/components/posts/RichContent'

export type FeedPost = {
  id: string
  author_id: string | null
  category: string
  subject: string | null
  content: string
  image_url: string | null
  created_at: string
  author_name: string | null
  author_username: string | null
  author_avatar: string | null
  author_role: string | null
  like_count: number
  comment_count: number
  share_count: number
  liked_by_me: boolean
  is_anonymous?: boolean
  attachments?: { url: string; name: string; mime_type: string; size_bytes?: number }[] | null
  author_follower_count?: number | null
  following_author_by_me?: boolean | null
  is_pinned?: boolean
  is_sponsored?: boolean
  promotion_label?: string | null
  promoted_until?: string | null
}

type FeedComment = {
  id: string
  post_id: string
  parent_comment_id: string | null
  content: string
  created_at: string
  author_name: string | null
  author_username: string | null
  author_avatar: string | null
}

const CATEGORY_LABELS: Record<string, string> = {
  academics: 'Academics',
  guidance: 'Guidance',
  campus_life: 'Campus Life',
}

const ROLE_LABELS: Record<string, string> = {
  secondary_student: 'Mwanafunzi',
  university_student: 'Mwanachuo',
  verified_university_student: 'Mwanachuo',
  campus_ambassador: 'Campus Ambassador',
  course_rep: 'Course Rep',
  moderator: 'Moderator',
  super_admin: 'Admin',
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || 'U'
  )
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'Sasa hivi'
  if (mins < 60) return `Dakika ${mins} zilizopita`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Masaa ${hrs} yaliyopita`
  const days = Math.floor(hrs / 24)
  return days === 1 ? 'Jana' : `Siku ${days} zilizopita`
}

function Avatar({ name, url, size = 'h-11 w-11' }: { name: string; url: string | null; size?: string }) {
  return (
    <span
      className={`${size} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-600 text-sm font-bold text-white`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  )
}

export default function PostCard({
  post,
  defaultOpenComments = false,
  index = 0,
  viewerId = null,
}: {
  post: FeedPost
  defaultOpenComments?: boolean
  index?: number
  viewerId?: string | null
}) {
  const supabase = useMemo(() => createClient(), [])

  const isAnon = Boolean(post.is_anonymous)
  const hiddenAuthor = isAnon && !post.author_name && !post.author_username
  const authorName = hiddenAuthor
    ? 'Mwanafunzi Asiyejulikana'
    : (post.author_name ?? post.author_username ?? 'Mtumiaji')


  const [liked, setLiked] = useState(post.liked_by_me)
  const [likes, setLikes] = useState(post.like_count)
  const [likeBusy, setLikeBusy] = useState(false)
  const [likeError, setLikeError] = useState('')

  const [shares, setShares] = useState(post.share_count)
  const [copied, setCopied] = useState(false)
  const [shareError, setShareError] = useState('')
  const [followingAuthor, setFollowingAuthor] = useState(Boolean(post.following_author_by_me))
  const [followerCount, setFollowerCount] = useState(Number(post.author_follower_count ?? 0))
  const [followBusy, setFollowBusy] = useState(false)
  const [followError, setFollowError] = useState('')

  const [commentCount, setCommentCount] = useState(post.comment_count)
  const [open, setOpen] = useState(defaultOpenComments)
  const [loaded, setLoaded] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)
  const [comments, setComments] = useState<FeedComment[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [commentError, setCommentError] = useState('')
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null)

  async function loadComments() {
    setLoadingComments(true)
    setCommentError('')
    try {
      const { data, error } = await supabase
        .from('post_comments_feed')
        .select('id, post_id, parent_comment_id, content, created_at, author_name, author_username, author_avatar')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true })
        .limit(100)
      if (error) {
        setCommentError(`Imeshindikana kupakia comments: ${error.message}`)
      } else {
        setComments((data ?? []) as FeedComment[])
        setLoaded(true)
      }
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : 'Imeshindikana kupakia comments.')
    } finally {
      setLoadingComments(false)
    }
  }

  // Ikiwa post ilifunguliwa na comments wazi (ukurasa wa post moja)
  useEffect(() => {
    if (defaultOpenComments) void loadComments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleComments() {
    const next = !open
    setOpen(next)
    if (next && !loaded) void loadComments()
  }

  async function toggleLike() {
    if (likeBusy) return
    setLikeBusy(true)
    setLikeError('')
    const next = !liked
    setLiked(next)
    setLikes((n) => Math.max(0, n + (next ? 1 : -1)))
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('Ingia tena kwenye SmartNekam ili kuweka Like.')
      const result = next
        ? await supabase.from('post_likes').insert({ post_id: post.id })
        : await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user.id)
      if (result.error && !(next && result.error.code === '23505')) throw result.error
      if (next && result.error?.code === '23505') {
        // Like already exists in the database; keep the button in the liked state.
      }
    } catch (error) {
      setLiked(!next)
      setLikes((n) => Math.max(0, n + (next ? -1 : 1)))
      setLikeError(error instanceof Error ? error.message : 'Imeshindikana kuhifadhi Like.')
    } finally {
      setLikeBusy(false)
    }
  }

  async function submitComment() {
    const commentContent = text.trim()
    if (!commentContent || sending) return
    setSending(true)
    setCommentError('')
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('Ingia tena kwenye SmartNekam ili kutuma comment.')
      const { error } = await supabase.from('post_comments').insert({
        post_id: post.id,
        content: commentContent,
        parent_comment_id: replyTo?.id ?? null,
      })
      if (error) throw error
      setText('')
      setReplyTo(null)
      setCommentCount((n) => n + 1)
      await loadComments()
    } catch (error) {
      setCommentError(error instanceof Error ? `Imeshindikana kutuma comment: ${error.message}` : 'Imeshindikana kutuma comment.')
    } finally {
      setSending(false)
    }
  }

  async function toggleFollowAuthor() {
    if (!post.author_id || followBusy) return
    setFollowBusy(true)
    setFollowError('')
    const next = !followingAuthor
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('Ingia tena kwenye SmartNekam ili kufuatilia mtumiaji.')
      if (post.author_id === user.id) throw new Error('Huwezi kujifuata mwenyewe.')
      setFollowingAuthor(next)
      setFollowerCount((count) => Math.max(0, count + (next ? 1 : -1)))
      const result = next
        ? await supabase.from('user_follows').insert({ follower_id: user.id, following_id: post.author_id })
        : await supabase.from('user_follows').delete().eq('follower_id', user.id).eq('following_id', post.author_id)
      if (result.error && !(next && result.error.code === '23505')) throw result.error
    } catch (error) {
      setFollowingAuthor(!next)
      setFollowerCount((count) => Math.max(0, count + (next ? -1 : 1)))
      const message = error instanceof Error ? error.message : 'Kosa lisilojulikana.'
      setFollowError(message.includes('user_follows') || message.includes('relation')
        ? 'Jedwali user_follows halipo. Endesha SQL 021 kwenye Supabase SQL Editor.'
        : `Imeshindikana kufuatilia mtumiaji: ${message}`)
    } finally {
      setFollowBusy(false)
    }
  }

  async function sharePost() {
    const url = `${window.location.origin}/posts/${post.id}`
    setShareError('')
    let shared = false
    let shareMethod: 'native' | 'copy' = 'copy'
    const shareApi = (navigator as unknown as { share?: (data: ShareData) => Promise<void> }).share
    try {
      if (typeof shareApi === 'function') {
        try {
          await shareApi.call(navigator, {
            title: `${authorName} kwenye SmartNekam`,
            text: post.content.slice(0, 120),
            url,
          })
          shareMethod = 'native'
          shared = true
        } catch (nativeError) {
          if (nativeError instanceof Error && nativeError.name === 'AbortError') return
          // If native sharing is unavailable or fails, fall back to copying the link.
          await navigator.clipboard.writeText(url)
          shareMethod = 'copy'
          shared = true
          setCopied(true)
          window.setTimeout(() => setCopied(false), 2000)
        }
      } else {
        await navigator.clipboard.writeText(url)
        shareMethod = 'copy'
        shared = true
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      }
      if (shared) {
        const { error } = await supabase.from('post_shares').insert({ post_id: post.id, share_method: shareMethod })
        if (error) setShareError(`Link imeshirikiwa, lakini rekodi ya share haikuhifadhiwa: ${error.message}`)
        else setShares((n) => n + 1)
      }
    } catch (error) {
      setShareError(error instanceof Error ? `Imeshindikana kushare: ${error.message}` : 'Imeshindikana kushare post.')
    }
  }

  const actionBtn =
    'flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg py-2 text-xs font-semibold transition active:scale-95 hover:bg-slate-100 sm:gap-2 sm:text-sm dark:hover:bg-slate-800'

  return (
    <article
      id={`post-${post.id}`}
      style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
      className="geometric-card hover-lift anim-fade-up p-4"
    >
      {(post.is_pinned || post.is_sponsored) && <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${post.is_sponsored ? 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'}`}>
          {post.is_sponsored ? <Megaphone className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          {post.is_sponsored ? 'Tangazo lililolipiwa' : 'Imepandishwa juu'}
        </span>
        {post.promotion_label && <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{post.promotion_label}</span>}
      </div>}
      {/* Mwandishi */}
      <div className="flex items-start gap-3">
        <Avatar name={authorName} url={post.author_avatar} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="truncate font-bold text-slate-900 dark:text-slate-100">{authorName}</p>
            {isAnon && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                {hiddenAuthor ? 'Anonymous' : 'Anonymous (jina lako linaonekana kwako tu)'}
              </span>
            )}
            {post.author_role && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                {ROLE_LABELS[post.author_role] ?? 'Mwanafunzi'}
              </span>
            )}
          </div>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {post.author_username && <>@{post.author_username} · </>}
            <span suppressHydrationWarning>{timeAgo(post.created_at)}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {CATEGORY_LABELS[post.category] ?? post.category}
          </span>
          {post.subject && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {post.subject}
            </span>
          )}
        </div>
      </div>

      {/* Maudhui */}
      <RichContent
        text={post.content}
        className="mt-3 text-sm leading-relaxed text-slate-800 dark:text-slate-200"
      />
      {post.attachments && post.attachments.length > 0 ? (
        <div className={`mt-3 grid gap-2 ${post.attachments.length > 1 ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
          {post.attachments.map((attachment, attachmentIndex) => {
            const key = `${attachment.url}-${attachmentIndex}`
            if (attachment.mime_type?.startsWith('image/')) {
              return (
                <a key={key} href={attachment.url} target="_blank" rel="noopener noreferrer" className="group relative block overflow-hidden rounded-2xl border border-emerald-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={attachment.url} alt={attachment.name || 'Picha ya post'} loading="lazy" className="max-h-[28rem] w-full object-contain transition duration-300 group-hover:scale-[1.01]" />
                </a>
              )
            }
            if (attachment.mime_type?.startsWith('video/')) {
              return (
                <div key={key} className="min-w-0 overflow-hidden rounded-2xl border border-emerald-100 bg-slate-950 dark:border-slate-800">
                  <video
                    controls
                    playsInline
                    preload="metadata"
                    aria-label={attachment.name || 'Video fupi ya post'}
                    className="aspect-video max-h-[28rem] w-full bg-black object-contain"
                  >
                    <source src={attachment.url} type={attachment.mime_type} />
                    Kivinjari chako hakiwezi kucheza video hii.
                  </video>
                  <div className="flex items-center justify-between gap-2 px-3 py-2 text-[11px] text-slate-300">
                    <span className="min-w-0 truncate">{attachment.name || 'Video fupi'}</span>
                    {typeof attachment.size_bytes === 'number' && <span className="shrink-0">{(attachment.size_bytes / (1024 * 1024)).toFixed(1)} MB</span>}
                    <a href={attachment.url} download={attachment.name || 'smartnekam-video'} className="shrink-0 font-bold text-indigo-200 hover:text-white">Pakua</a>
                  </div>
                </div>
              )
            }
            return (
              <a key={key} href={attachment.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 transition hover:border-emerald-400 hover:bg-emerald-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm dark:bg-slate-800 dark:text-emerald-200">{attachment.mime_type === 'application/pdf' ? <FileText className="h-5 w-5"/> : <FileImage className="h-5 w-5"/>}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold text-slate-900 dark:text-white">{attachment.name || 'Kiambatisho'}</span><span className="mt-1 block text-[11px] text-slate-500">{attachment.mime_type === 'application/pdf' ? 'PDF document' : 'Faili lililoambatishwa'}</span></span>
                <Download className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300"/>
              </a>
            )
          })}
        </div>
      ) : post.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.image_url} alt="Picha ya post" loading="lazy" className="mt-3 max-h-96 w-full rounded-2xl object-cover" />
      ) : null}

      {likeError && <p role="status" className="mb-2 text-[11px] text-red-600 dark:text-red-300">{likeError}</p>}
      {shareError && <p role="status" className="mb-2 break-words text-[11px] text-red-600 dark:text-red-300">{shareError}</p>}
      {/* Vitendo: Like, Comment, Share, Follow */}
      <div className="mt-3 flex items-center gap-1 border-t border-emerald-100 pt-2 dark:border-slate-800">
        <button
          type="button"
          onClick={toggleLike}
          aria-pressed={liked}
          aria-label="Penda post"
          className={`${actionBtn} ${liked ? 'text-rose-500' : 'text-slate-600 dark:text-slate-300'}`}
        >
          <Heart
            key={liked ? 'on' : 'off'}
            className={`h-5 w-5 ${liked ? 'anim-pop fill-current' : ''}`}
          />
          {likes} <span className="hidden sm:inline">Like</span>
        </button>

        <button
          type="button"
          onClick={toggleComments}
          aria-expanded={open}
          aria-label="Comments"
          className={`${actionBtn} ${open ? 'text-emerald-600' : 'text-slate-600 dark:text-slate-300'}`}
        >
          <MessageCircle className="h-5 w-5" />
          {commentCount} <span className="hidden sm:inline">Comments</span>
        </button>

        <button
          type="button"
          onClick={sharePost}
          aria-label="Share"
          className={`${actionBtn} text-slate-600 dark:text-slate-300`}
        >
          {copied ? <Check className="anim-pop h-5 w-5 text-emerald-600" /> : <Share2 className="h-5 w-5" />}
          {copied ? 'Imenakiliwa' : shares} <span className="hidden sm:inline">{copied ? '' : 'Share'}</span>
        </button>
        {post.author_id && viewerId && post.author_id !== viewerId && (
          <button
            type="button"
            onClick={() => void toggleFollowAuthor()}
            disabled={followBusy}
            aria-pressed={followingAuthor}
            aria-label={followingAuthor ? 'Acha kumfuatilia mtumiaji' : 'Mfuatilie mtumiaji'}
            className={`${actionBtn} min-w-0 text-xs sm:text-sm ${followingAuthor ? 'text-[#36a91d] dark:text-[#70f753]' : 'text-slate-600 dark:text-slate-300'}`}
          >
            <UserPlus className="h-5 w-5 shrink-0" />
            <span className="sm:hidden">{followingAuthor ? 'Unafuata' : 'Fuata'}</span><span className="hidden sm:inline">{followerCount} · {followingAuthor ? 'Following' : 'Follow'}</span>
          </button>
        )}
      </div>
      {followError && <p role="status" className="mt-1 text-[11px] text-red-600 dark:text-red-300">{followError}</p>}

      {/* Comments */}
      {open && (
        <div className="anim-fade-up mt-3 space-y-3 border-t border-emerald-100 pt-3 dark:border-slate-800">
          {loadingComments && !loaded && (
            <div className="space-y-2">
              <div className="shimmer-element h-10 rounded-lg" />
              <div className="shimmer-element h-10 rounded-lg" />
            </div>
          )}

          {loaded && comments.length === 0 && (
            <p className="text-center text-xs text-slate-500 dark:text-slate-400">
              Hakuna comment bado. Kuwa wa kwanza!
            </p>
          )}

          {comments.length > 0 && (() => {
            const renderComment = (comment: FeedComment, depth = 0): React.ReactNode => {
              const name = comment.author_name ?? comment.author_username ?? 'Mtumiaji'
              const children = comments.filter((candidate) => candidate.parent_comment_id === comment.id)
              return (
                <div key={comment.id} className={`anim-fade-in ${depth > 0 ? 'ml-4 border-l-2 border-emerald-100 pl-3 dark:border-slate-700' : ''}`}>
                  <div className="flex gap-2.5">
                    <Avatar name={name} url={comment.author_avatar} size="h-8 w-8" />
                    <div className="min-w-0 flex-1 rounded-2xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {name}{' '}
                        <span className="font-normal text-slate-400" suppressHydrationWarning>· {timeAgo(comment.created_at)}</span>
                      </p>
                      <RichContent text={comment.content} className="text-sm text-slate-800 dark:text-slate-200" />
                      <button type="button" onClick={() => setReplyTo({ id: comment.id, name })} className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline dark:text-emerald-300">
                        <CornerDownRight className="h-3 w-3" /> Jibu thread
                      </button>
                    </div>
                  </div>
                  {children.length > 0 && depth < 4 && <div className="mt-2 space-y-2">{children.map((child) => renderComment(child, depth + 1))}</div>}
                </div>
              )
            }
            return <div className="space-y-3">{comments.filter((comment) => !comment.parent_comment_id).map((comment) => renderComment(comment))}</div>
          })()}

          {replyTo && <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100"><CornerDownRight className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1">Unajibu thread ya <strong>{replyTo.name}</strong></span><button type="button" onClick={() => setReplyTo(null)} aria-label="Ghairi jibu" className="rounded p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900"><X className="h-3.5 w-3.5" /></button></div>}
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 1000))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void submitComment()
                }
              }}
              placeholder={replyTo ? `Jibu ${replyTo.name}...` : 'Andika comment...'}
              className="flex-1 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={submitComment}
              disabled={sending || !text.trim()}
              aria-label={replyTo ? 'Tuma jibu la thread' : 'Tuma comment'}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-500 active:scale-90 disabled:opacity-40"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          {commentError && <p className="text-xs text-red-600">{commentError}</p>}
        </div>
      )}
    </article>
  )
}

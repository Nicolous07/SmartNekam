'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function slugify(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || 'channel'
}

function validYouTubeUrl(value: string) {
  try {
    const url = new URL(value)
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com', 'youtube-nocookie.com'].includes(url.hostname)) return false
    const id = url.hostname === 'youtu.be'
      ? url.pathname.split('/').filter(Boolean)[0]
      : url.pathname === '/watch' ? url.searchParams.get('v')
      : url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/)?.[1]
    return Boolean(id && /^[\w-]{11}$/.test(id))
  } catch {
    return false
  }
}

export async function createLearningChannel(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim().slice(0, 1500)
  const category = String(formData.get('category') ?? 'other')
  const language = String(formData.get('language') ?? 'sw')
  if (name.length < 2 || name.length > 100) redirect('/learn/channels/create?error=name')
  if (!['life','academics','technology','career','business','health','other'].includes(category)) redirect('/learn/channels/create?error=category')
  if (!['sw','en'].includes(language)) redirect('/learn/channels/create?error=language')

  const base = slugify(name)
  const slug = `${base}-${user.id.replace(/-/g, '').slice(0, 8)}`
  const { data, error } = await supabase.from('learning_channels')
    .insert({ owner_id: user.id, name, slug, description, category, language, status: 'published' })
    .select('slug').single()
  if (error || !data) redirect('/learn/channels/create?error=save')
  revalidatePath('/learn')
  revalidatePath('/learn/channels')
  redirect(`/learn/channels/${data.slug}`)
}

export async function addYouTubeVideo(channelId: string, slug: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim().slice(0, 2000)
  const youtubeUrl = String(formData.get('youtube_url') ?? '').trim()
  if (title.length < 2 || title.length > 180 || !validYouTubeUrl(youtubeUrl)) {
    redirect(`/learn/channels/${slug}?error=video`)
  }

  const { data: channel, error: channelError } = await supabase.from('learning_channels')
    .select('id,owner_id').eq('id', channelId).eq('owner_id', user.id).single()
  if (channelError || !channel) redirect(`/learn/channels/${slug}?error=owner`)

  const { count } = await supabase.from('learning_channel_videos').select('id', { count: 'exact', head: true }).eq('channel_id', channelId)
  const { error } = await supabase.from('learning_channel_videos').insert({
    channel_id: channelId, owner_id: user.id, title, description, youtube_url: youtubeUrl,
    position: (count ?? 0) + 1, status: 'published',
  })
  if (error) redirect(`/learn/channels/${slug}?error=save`)
  revalidatePath('/learn/channels')
  revalidatePath(`/learn/channels/${slug}`)
  redirect(`/learn/channels/${slug}`)
}

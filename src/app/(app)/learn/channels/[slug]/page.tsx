import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, ExternalLink, Play, Plus, Radio } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { addYouTubeVideo } from '../actions'

function youtubeId(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.hostname === 'youtu.be' || url.hostname === 'www.youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0]
      return id && /^[\w-]{11}$/.test(id) ? id : null
    }
    if (!['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com','youtube-nocookie.com'].includes(url.hostname)) return null
    const id = url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/)?.[1]
    return id && /^[\w-]{11}$/.test(id) ? id : null
  } catch { return null }
}

const categories: Record<string,string> = { life:'Maisha', academics:'Masomo', technology:'Teknolojia', career:'Career', business:'Biashara', health:'Afya', other:'Nyingine' }

export default async function LearningChannelPage({ params, searchParams }: { params: Promise<{slug:string}>; searchParams: Promise<{error?:string}> }) {
  const { slug } = await params
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')
  const { data: channel } = await supabase.from('learning_channels')
    .select('id,name,slug,description,category,language,owner_id,created_at')
    .eq('slug',slug).eq('status','published').maybeSingle()
  if (!channel) notFound()
  const [{data:videos,error:videoError},{data:owner}] = await Promise.all([
    supabase.from('learning_channel_videos').select('id,title,description,youtube_url,created_at,position')
      .eq('channel_id',channel.id).eq('status','published').order('position').order('created_at'),
    supabase.from('profiles').select('full_name,username').eq('id',channel.owner_id).maybeSingle()
  ])
  const isOwner = channel.owner_id === user.id
  const errorText = sp.error === 'video' ? 'Weka jina la video na link halali ya YouTube.'
    : sp.error === 'owner' ? 'Ni mmiliki wa channel pekee anayeweza kuongeza video.'
    : sp.error === 'save' ? 'Imeshindikana kuhifadhi video. Hakikisha SQL 047 imeendeshwa kwenye Supabase.'
    : ''
  return <div className="mx-auto max-w-5xl space-y-5">
    <Link href="/learn/channels" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300"><ArrowLeft className="h-4 w-4"/> Channels zote</Link>
    <section className="geometric-hero rounded-3xl p-6 text-white sm:p-8"><Radio className="h-8 w-8 text-emerald-200"/><div className="mt-3 flex flex-wrap items-center gap-2"><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{categories[channel.category]??'Channel'}</span><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{channel.language==='sw'?'Kiswahili':'English'}</span></div><h1 className="mt-3 text-3xl font-black sm:text-4xl">{channel.name}</h1><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-100">{channel.description||'Channel ya kujifunza na kushirikiana maarifa.'}</p><p className="mt-4 text-xs text-teal-100">Creator: {owner?.full_name||owner?.username||'Mwalimu wa SmartNekam'}</p></section>
    {isOwner && <section className="geometric-card p-5 sm:p-6"><h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-950 dark:text-white"><Plus className="h-5 w-5 text-emerald-600"/> Ongeza video ya YouTube</h2><p className="mt-1 text-sm text-slate-500">Bandika link ya YouTube. Video itachezwa ndani ya ukurasa huu bila kumpeleka mtazamaji YouTube.</p>{errorText&&<p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">{errorText}</p>}<form action={addYouTubeVideo.bind(null,channel.id,channel.slug)} className="mt-4 grid gap-3"><label className="space-y-1"><span className="block text-sm font-bold text-slate-800 dark:text-slate-100">Jina la video *</span><input name="title" required minLength={2} maxLength={180} placeholder="Mfano: Utangulizi wa Python" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"/></label><label className="space-y-1"><span className="block text-sm font-bold text-slate-800 dark:text-slate-100">Link ya YouTube *</span><input name="youtube_url" type="url" required placeholder="https://www.youtube.com/watch?v=..." className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"/></label><label className="space-y-1"><span className="block text-sm font-bold text-slate-800 dark:text-slate-100">Maelezo (hiari)</span><textarea name="description" rows={2} maxLength={2000} placeholder="Video hii inafundisha nini?" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"/></label><button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-emerald-500"><Plus className="h-4 w-4"/> Ongeza video</button></form></section>}
    <section className="space-y-4"><div><h2 className="text-xl font-black text-slate-950 dark:text-white">Video za channel</h2><p className="mt-1 text-sm text-slate-500">{videos?.length??0} video</p></div>{videoError ? <div className="geometric-card p-5 text-sm text-rose-700 dark:text-rose-200">Imeshindikana kupakia video.</div> : videos?.length ? videos.map(video=>{const id=youtubeId(video.youtube_url);return <article key={video.id} className="geometric-card overflow-hidden"><div className="aspect-video w-full bg-black">{id ? <iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${id}`} title={video.title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/> : <div className="flex h-full items-center justify-center text-sm text-white">Link ya video si sahihi.</div>}</div><div className="p-4 sm:p-5"><h3 className="text-lg font-extrabold text-slate-950 dark:text-white">{video.title}</h3>{video.description&&<p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{video.description}</p>}<a href={video.youtube_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300"><ExternalLink className="h-3.5 w-3.5"/> Fungua YouTube <span className="sr-only">(tab mpya)</span></a></div></article>}) : <div className="geometric-card p-8 text-center"><Play className="mx-auto h-9 w-9 text-emerald-600"/><h3 className="mt-3 font-extrabold text-slate-950 dark:text-white">Bado hakuna video</h3><p className="mt-1 text-sm text-slate-500">{isOwner?'Ongeza link yako ya kwanza ya YouTube hapo juu.':'Creator bado hajaongeza video kwenye channel hii.'}</p></div>}</section>
  </div>
}

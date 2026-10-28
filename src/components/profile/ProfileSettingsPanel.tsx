'use client'

import { useRef, useState } from 'react'
import { Loader2, Save, ShieldCheck, UserRound, X, Crop } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ImageCropper from './ImageCropper'

type Props = {
  userId: string
  fullName: string
  username: string
  bio: string
  avatarUrl: string | null
  coverUrl: string | null
  level: string | null
  formOrYear: string | null
  combination: string | null
  course: string | null
  region: string | null
  showOnLeaderboard: boolean
  languageCode: string
  lowDataMode: boolean
  profileVisibility: string
}
const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white'
const normalizeIdentity = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

export default function ProfileSettingsPanel({ userId, fullName, username: initialUsername, bio: initialBio, avatarUrl: initialAvatarUrl, coverUrl: initialCoverUrl, level, formOrYear, combination, course, region, showOnLeaderboard, languageCode, lowDataMode, profileVisibility }: Props) {
  const [name, setName] = useState(fullName)
  const [username, setUsername] = useState(initialUsername)
  const [userBio, setUserBio] = useState(initialBio)
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? '')
  const [coverUrl, setCoverUrl] = useState(initialCoverUrl ?? '')
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [removeCover, setRemoveCover] = useState(false)
  const [studyLevel, setStudyLevel] = useState(level ?? '')
  const [year, setYear] = useState(formOrYear ?? '')
  const [subjectCombination, setSubjectCombination] = useState(combination ?? '')
  const [programme, setProgramme] = useState(course ?? '')
  const [userRegion, setUserRegion] = useState(region ?? '')
  const [leaderboard, setLeaderboard] = useState(showOnLeaderboard)
  const [language, setLanguage] = useState(languageCode)
  const [lowData, setLowData] = useState(lowDataMode)
  const [visibility, setVisibility] = useState(profileVisibility)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState<'avatar' | 'cover' | null>(null)
  const [cropTarget, setCropTarget] = useState<{ file: File; kind: 'avatar' | 'cover' } | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const avatarInput = useRef<HTMLInputElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  async function uploadImage(file: File | undefined, kind: 'avatar' | 'cover') {
    if (!file) return
    setError(''); setMessage('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Tumia picha ya JPG, PNG au WEBP pekee.')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Picha isiwe kubwa kuliko 8 MB.')
      return
    }
    setUploading(kind)
    try {
      const bucket = kind === 'avatar' ? 'avatars' : 'profile-covers'
      const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`
      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from(bucket).getPublicUrl(path)
      if (kind === 'avatar') { setAvatarUrl(data.publicUrl); setRemoveAvatar(false) }
      else { setCoverUrl(data.publicUrl); setRemoveCover(false) }
      setMessage(kind === 'avatar' ? 'Picha ya profile imepakiwa. Bonyeza Hifadhi mabadiliko ili kuitumia.' : 'Cover picha imepakiwa. Bonyeza Hifadhi mabadiliko ili kuitumia.')
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Picha haikuweza kupakiwa. Hakikisha SQL 017 imeendeshwa.')
    } finally {
      setUploading(null)
    }
  }

  function chooseImage(file: File | undefined, kind: 'avatar' | 'cover') {
    if (!file) return
    setError(''); setMessage('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Tumia picha ya JPG, PNG au WEBP pekee.')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Picha ya awali isiwe kubwa kuliko 8 MB.')
      return
    }
    setCropTarget({ file, kind })
  }

  async function save() {
    setBusy(true); setMessage(''); setError('')
    const cleanName = name.trim().replace(/\s+/g, ' ')
    const cleanUsername = username.trim().toLowerCase()
    if (cleanName.length < 3) { setError('Weka display name yenye angalau herufi 3.'); setBusy(false); return }
    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) { setError('Username iwe herufi ndogo, namba au underscore; herufi 3–20.'); setBusy(false); return }
    if (normalizeIdentity(cleanName) === normalizeIdentity(cleanUsername)) { setError('Username lazima iwe tofauti na display name.'); setBusy(false); return }

    const { error: profileError } = await supabase.rpc('update_my_profile', {
      p_full_name: cleanName,
      p_username: cleanUsername,
      p_avatar_url: avatarUrl || null,
      p_bio: userBio.trim(),
      p_remove_avatar: removeAvatar,
      p_cover_url: coverUrl || null,
      p_remove_cover: removeCover,
    })
    if (profileError) {
      const msg = profileError.message.includes('username_taken') ? 'Username hii imeshatumika. Chagua nyingine.'
        : profileError.message.includes('username_must_be_different') ? 'Username lazima iwe tofauti na display name.'
        : profileError.message
      setError(msg); setBusy(false); return
    }

    const { error: settingsError } = await supabase.from('profiles').update({
      level: studyLevel || null,
      form_or_year: year.trim() || null,
      combination: studyLevel === 'A_LEVEL' ? (subjectCombination.trim() || null) : null,
      course: studyLevel === 'UNIVERSITY' ? (programme.trim() || null) : null,
      region: userRegion.trim() || null,
      show_on_leaderboard: leaderboard,
    }).eq('id', userId)
    if (settingsError) { setError(settingsError.message); setBusy(false); return }

    const { error: prefError } = await supabase.from('user_app_preferences').upsert({ user_id: userId, language_code: language, low_data_mode: lowData }, { onConflict: 'user_id' })
    const { error: privacyError } = await supabase.from('user_privacy_settings').upsert({ user_id: userId, profile_visibility: visibility, show_in_leaderboards: leaderboard }, { onConflict: 'user_id' })
    if (prefError || privacyError) {
      setError(prefError?.message ?? privacyError?.message ?? 'Mipangilio haijahifadhiwa.')
    } else {
      setMessage('Wasifu na mipangilio vimehifadhiwa.')
      try { window.localStorage.setItem('smartnekam:low-data-mode', String(lowData)) } catch { /* storage may be blocked */ }
      window.dispatchEvent(new CustomEvent('smartnekam:low-data-mode-change', { detail: { enabled: lowData } }))
    }
    setBusy(false); router.refresh()
  }

  return <>
  <section className="geometric-card space-y-4 p-4 sm:p-5">
    <div><h2 className="font-heading text-lg font-extrabold text-slate-950 dark:text-white">Wasifu na mipangilio</h2><p className="mt-1 text-xs leading-5 text-slate-500">Display name inaweza kuonekana kwa wengine. Username ni ya kipekee na lazima iwe tofauti na display name.</p></div>

    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700 sm:col-span-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-emerald-100 text-xl font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{avatarUrl && !removeAvatar ? <img src={avatarUrl} alt="Picha ya profile" className="h-full w-full object-cover" /> : <UserRound className="h-7 w-7" />}</div>
          <div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-900 dark:text-white">Picha ya profile</p><p className="text-xs text-slate-500">JPG, PNG au WEBP · hadi 8 MB</p></div>
          <button type="button" onClick={() => avatarInput.current?.click()} disabled={uploading !== null} className="rounded-xl border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-50 dark:border-emerald-900 dark:text-emerald-200">{uploading === 'avatar' ? <Loader2 className="inline h-4 w-4 animate-spin" /> : <Crop className="mr-1 inline h-4 w-4" />} Badili na kata picha</button>
          <input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { chooseImage(e.target.files?.[0], 'avatar'); e.currentTarget.value = '' }} />
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 sm:col-span-2">
        <div className="relative h-28 bg-gradient-to-r from-emerald-900 via-emerald-700 to-lime-600">{coverUrl && !removeCover && <img src={coverUrl} alt="Cover picha" className="h-full w-full object-cover" />}<span className="absolute bottom-2 left-3 rounded-lg bg-black/50 px-2 py-1 text-xs font-bold text-white">Cover picha</span></div>
        <div className="flex flex-wrap items-center justify-between gap-2 p-3"><p className="text-xs text-slate-500">Picha ya juu ya profile · hadi 8 MB</p><div className="flex gap-2"><button type="button" onClick={() => coverInput.current?.click()} disabled={uploading !== null} className="rounded-xl border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-50 dark:border-emerald-900 dark:text-emerald-200">{uploading === 'cover' ? <Loader2 className="inline h-4 w-4 animate-spin" /> : <Crop className="mr-1 inline h-4 w-4" />} Weka na kata cover</button>{coverUrl && !removeCover && <button type="button" onClick={() => { setCoverUrl(''); setRemoveCover(true) }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-200"><X className="inline h-4 w-4" /> Ondoa</button>}</div><input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { chooseImage(e.target.files?.[0], 'cover'); e.currentTarget.value = '' }} /></div>
      </div>
      <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Display name / Jina kamili</span><input className={input} value={name} onChange={e => setName(e.target.value)} maxLength={120} required /></label>
      <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Username ya kipekee <span className="text-red-500">*</span></span><div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"><span className="text-sm font-bold text-emerald-600">@</span><input className="w-full bg-transparent px-2 py-2.5 text-sm outline-none dark:text-white" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0,20))} minLength={3} maxLength={20} required autoComplete="username" aria-describedby="profile-username-help" /></div><span id="profile-username-help" className="mt-1 block text-[11px] text-slate-500">Herufi ndogo, namba au _ pekee; herufi 3–20. Lazima iwe tofauti na jina lako.</span></label>
      <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Bio fupi</span><textarea className={input} value={userBio} onChange={e => setUserBio(e.target.value.slice(0,280))} rows={2} placeholder="Niambie kuhusu masomo au malengo yako..."/><span className="mt-1 block text-right text-[11px] text-slate-400">{userBio.length}/280</span></label>
      <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Kiwango</span><select className={input} value={studyLevel} onChange={e => setStudyLevel(e.target.value)}><option value="">Chagua</option><option value="O_LEVEL">O-Level</option><option value="A_LEVEL">A-Level</option><option value="UNIVERSITY">University</option></select></label>
      <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Kidato / Mwaka</span><input className={input} value={year} onChange={e => setYear(e.target.value)} maxLength={30}/></label>
      {studyLevel === 'A_LEVEL' && <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Combination</span><input className={input} value={subjectCombination} onChange={e => setSubjectCombination(e.target.value)} maxLength={30}/></label>}
      {studyLevel === 'UNIVERSITY' && <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Kozi</span><input className={input} value={programme} onChange={e => setProgramme(e.target.value)} maxLength={150}/></label>}
      <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Mkoa</span><input className={input} value={userRegion} onChange={e => setUserRegion(e.target.value)} maxLength={80}/></label>
    </div>

    <div className="border-t border-emerald-50 pt-4 dark:border-slate-800"><h3 className="font-bold text-slate-900 dark:text-white">Faragha na accessibility</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Lugha</span><select className={input} value={language} onChange={e => setLanguage(e.target.value)}><option value="sw">Kiswahili</option><option value="en">English</option></select></label>
      <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Mwonekano wa profile</span><select className={input} value={visibility} onChange={e => setVisibility(e.target.value)}><option value="community">Jamii ya SmartNekam</option><option value="public">Public</option><option value="private">Private</option></select></label>
    </div><div className="mt-3 space-y-2"><label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"><input className="mt-1 accent-emerald-600" type="checkbox" checked={lowData} onChange={e => setLowData(e.target.checked)}/><span><span className="block text-sm font-bold text-slate-900 dark:text-white">Low-data mode</span><span className="block text-xs leading-5 text-slate-500">Hupunguza machapisho yanayopakiwa, huzuia picha/video kupakuliwa bila kugusa, na hupunguza picha unazotuma. Unaweza kufungua media unayotaka pekee.</span></span></label><label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"><input className="mt-1 accent-emerald-600" type="checkbox" checked={leaderboard} onChange={e => setLeaderboard(e.target.checked)}/><span><span className="block text-sm font-bold text-slate-900 dark:text-white">Nionyeshe kwenye leaderboard</span><span className="block text-xs leading-5 text-slate-500">Chagua kwa hiari kushiriki kwenye rankings.</span></span></label></div></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-200">{error}</p>}{message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">{message}</p>}
    <button type="button" onClick={() => void save()} disabled={busy || uploading !== null || name.trim().length < 3} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-emerald-500 disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>} Hifadhi mabadiliko</button>
    <p className="flex items-start gap-2 text-xs leading-5 text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"/> Username lazima iwe ya kipekee. Picha za profile ni public-facing; usipakie nyaraka binafsi hapa.</p>
  </section>
  {cropTarget && <ImageCropper file={cropTarget.file} aspect={cropTarget.kind === 'avatar' ? 1 : 3} shape={cropTarget.kind === 'avatar' ? 'round' : 'rect'} outputWidth={cropTarget.kind === 'avatar' ? 640 : 1800} title={cropTarget.kind === 'avatar' ? 'Kata picha ya profile' : 'Kata picha ya cover'} onCancel={() => setCropTarget(null)} onDone={(croppedFile) => { const kind = cropTarget.kind; setCropTarget(null); void uploadImage(croppedFile, kind) }} />}
  </>
}

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AtSign,
  Camera,
  Check,
  Crop,
  ImagePlus,
  KeyRound,
  Loader2,
  Lock,
  Save,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ImageCropper from './ImageCropper'

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/
const MAX_RAW_BYTES = 8 * 1024 * 1024 // picha ya kuchagua; itapunguzwa baada ya kukatwa
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const BIO_MAX = 280

type UsernameStatus = 'idle' | 'same' | 'checking' | 'available' | 'taken' | 'invalid'
type CropKind = 'avatar' | 'cover'

const fieldWrap =
  'flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-3 transition focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-100 dark:border-slate-700 dark:bg-slate-800 dark:focus-within:ring-emerald-900/40'
const fieldInput =
  'w-full bg-transparent py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100'
const labelClass = 'mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200'
const smallBtn =
  'flex items-center gap-1.5 rounded-lg border border-emerald-400 px-3 py-1.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 active:scale-95 dark:text-emerald-300 dark:hover:bg-emerald-950'
const dangerBtn =
  'flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 active:scale-95 dark:hover:bg-red-950/40'

function friendlyError(message?: string) {
  const m = message ?? ''
  if (m.includes('username_taken')) return 'Username hiyo imeshatumika. Chagua nyingine.'
  if (m.includes('invalid_username')) return 'Username iwe herufi 3 hadi 20 (a-z, 0-9, _).'
  if (m.includes('invalid_name')) return 'Jina liwe na angalau herufi 3.'
  if (m.includes('not_authenticated')) return 'Session imeisha. Ingia tena.'
  if (m.includes('update_my_profile'))
    return 'Hakikisha umeendesha supabase/profile-settings.sql na supabase/profile-cover.sql kwenye Supabase.'
  return 'Imeshindikana kuhifadhi. Jaribu tena. (' + m + ')'
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

export default function ProfileSettingsForm({
  initialName,
  initialUsername,
  initialBio,
  initialAvatar,
  initialCover,
}: {
  initialName: string
  initialUsername: string
  initialBio: string
  initialAvatar: string | null
  initialCover: string | null
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const avatarInput = useRef<HTMLInputElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)

  const [fullName, setFullName] = useState(initialName)
  const [username, setUsername] = useState(initialUsername)
  const [bio, setBio] = useState(initialBio)

  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)

  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [removeCover, setRemoveCover] = useState(false)

  const [cropTarget, setCropTarget] = useState<{ kind: CropKind; file: File } | null>(null)

  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('same')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Username: ukaguzi wa wakati halisi
  useEffect(() => {
    const value = username.trim()
    if (value.toLowerCase() === initialUsername.toLowerCase()) {
      setUsernameStatus('same')
      return
    }
    if (!USERNAME_RE.test(value)) {
      setUsernameStatus(value ? 'invalid' : 'idle')
      return
    }
    setUsernameStatus('checking')
    let cancelled = false
    const timer = setTimeout(async () => {
      const { data, error: rpcErr } = await supabase.rpc('is_username_available', {
        p_username: value,
      })
      if (cancelled) return
      if (rpcErr) setUsernameStatus('idle')
      else setUsernameStatus(data ? 'available' : 'taken')
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [username, initialUsername, supabase])

  // Preview za picha zilizokatwa
  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null)
      return
    }
    const url = URL.createObjectURL(avatarFile)
    setAvatarPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [avatarFile])

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null)
      return
    }
    const url = URL.createObjectURL(coverFile)
    setCoverPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [coverFile])

  function onPick(kind: CropKind) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null)
      const file = e.target.files?.[0]
      e.target.value = '' // ruhusu kuchagua picha ileile tena
      if (!file) return
      if (!IMAGE_TYPES.includes(file.type)) {
        setError('Picha iwe PNG, JPG au WEBP.')
        return
      }
      if (file.size > MAX_RAW_BYTES) {
        setError('Picha isizidi MB 8.')
        return
      }
      setCropTarget({ kind, file }) // fungua kifaa cha kukata
    }
  }

  function onCropDone(file: File) {
    if (!cropTarget) return
    if (cropTarget.kind === 'avatar') {
      setAvatarFile(file)
      setRemoveAvatar(false)
    } else {
      setCoverFile(file)
      setRemoveCover(false)
    }
    setCropTarget(null)
  }

  // Rekebisha (crop upya) picha iliyopo sasa
  async function recrop(kind: CropKind) {
    const url =
      kind === 'avatar' ? avatarPreview ?? initialAvatar : coverPreview ?? initialCover
    if (!url) return
    setError(null)
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      setCropTarget({ kind, file: new File([blob], `${kind}.jpg`, { type: blob.type || 'image/jpeg' }) })
    } catch {
      setError('Imeshindikana kufungua picha ya sasa. Chagua picha mpya badala yake.')
    }
  }

  function clearAvatar() {
    setAvatarFile(null)
    setRemoveAvatar(true)
  }
  function clearCover() {
    setCoverFile(null)
    setRemoveCover(true)
  }

  const shownAvatar = removeAvatar ? null : avatarPreview ?? initialAvatar
  const shownCover = removeCover ? null : coverPreview ?? initialCover

  const dirty =
    fullName.trim() !== initialName ||
    username.trim() !== initialUsername ||
    bio.trim() !== initialBio ||
    avatarFile !== null ||
    removeAvatar ||
    coverFile !== null ||
    removeCover

  const usernameOk = usernameStatus === 'same' || usernameStatus === 'available'
  const canSave = dirty && fullName.trim().length >= 3 && usernameOk && !saving

  async function uploadImage(prefix: 'avatar' | 'cover', file: File, userId: string) {
    const path = `${userId}/${prefix}-${Date.now()}.jpg`
    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { contentType: file.type || 'image/jpeg' })
    if (upErr) throw upErr
    return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
  }

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      let avatarUrl: string | null = null
      let coverUrl: string | null = null

      if (avatarFile || coverFile) {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) throw { message: 'not_authenticated' }
        if (avatarFile) avatarUrl = await uploadImage('avatar', avatarFile, user.id)
        if (coverFile) coverUrl = await uploadImage('cover', coverFile, user.id)
      }

      const { error: rpcErr } = await supabase.rpc('update_my_profile', {
        p_full_name: fullName.trim(),
        p_username: username.trim(),
        p_avatar_url: avatarUrl,
        p_bio: bio.trim(),
        p_remove_avatar: removeAvatar && !avatarFile,
        p_cover_url: coverUrl,
        p_remove_cover: removeCover && !coverFile,
      })
      if (rpcErr) throw rpcErr

      setSaved(true)
      setAvatarFile(null)
      setCoverFile(null)
      setRemoveAvatar(false)
      setRemoveCover(false)
      setTimeout(() => setSaved(false), 3000)
      router.refresh() // navbar na kurasa zingine zipate jina/picha mpya
    } catch (e) {
      setError(friendlyError((e as { message?: string }).message))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="geometric-card p-5">
      <h2 className="mb-4 text-lg font-extrabold text-slate-900 dark:text-white">
        Hariri Profile
      </h2>

      {/* Cover photo */}
      <div className="mb-5">
        <label className={labelClass}>Picha ya cover</label>
        <button
          type="button"
          onClick={() => coverInput.current?.click()}
          aria-label="Chagua picha ya cover"
          className="group relative block aspect-[3/1] w-full overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500"
        >
          {shownCover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={shownCover}
              src={shownCover}
              alt=""
              className="anim-scale-in h-full w-full object-cover"
            />
          )}
          <span className="absolute inset-0 flex items-center justify-center gap-2 bg-emerald-900/50 text-sm font-semibold text-white opacity-0 transition group-hover:opacity-100">
            <ImagePlus className="h-5 w-5" /> {shownCover ? 'Badilisha cover' : 'Weka cover'}
          </span>
        </button>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => coverInput.current?.click()} className={smallBtn}>
            <ImagePlus className="h-4 w-4" /> {shownCover ? 'Badilisha' : 'Weka cover'}
          </button>
          {shownCover && (
            <>
              <button type="button" onClick={() => recrop('cover')} className={smallBtn}>
                <Crop className="h-4 w-4" /> Rekebisha
              </button>
              <button type="button" onClick={clearCover} className={dangerBtn}>
                <Trash2 className="h-4 w-4" /> Ondoa
              </button>
            </>
          )}
        </div>
        <input
          ref={coverInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onPick('cover')}
          className="hidden"
        />
      </div>

      {/* Picha ya wasifu */}
      <div className="mb-5 flex items-center gap-4">
        <button
          type="button"
          onClick={() => avatarInput.current?.click()}
          aria-label="Badilisha picha"
          className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-600 text-xl font-bold text-white ring-4 ring-emerald-100 transition hover:ring-emerald-300 dark:ring-emerald-900/50"
        >
          {shownAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={shownAvatar}
              src={shownAvatar}
              alt=""
              className="anim-scale-in h-full w-full object-cover"
            />
          ) : (
            initials(fullName)
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-emerald-900/50 opacity-0 transition group-hover:opacity-100">
            <Camera className="h-6 w-6" />
          </span>
        </button>
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => avatarInput.current?.click()} className={smallBtn}>
              <Camera className="h-4 w-4" /> {shownAvatar ? 'Badilisha' : 'Weka picha'}
            </button>
            {shownAvatar && (
              <>
                <button type="button" onClick={() => recrop('avatar')} className={smallBtn}>
                  <Crop className="h-4 w-4" /> Rekebisha
                </button>
                <button type="button" onClick={clearAvatar} className={dangerBtn}>
                  <Trash2 className="h-4 w-4" /> Ondoa
                </button>
              </>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            PNG, JPG au WEBP. Utaweza kuikata na kuchagua ukubwa.
          </p>
        </div>
        <input
          ref={avatarInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onPick('avatar')}
          className="hidden"
        />
      </div>

      <div className="space-y-4">
        <div>
          <label className={labelClass}>Jina kamili</label>
          <div className={fieldWrap}>
            <User className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              className={fieldInput}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jina lako kamili"
              maxLength={60}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Username</label>
          <div className={fieldWrap}>
            <AtSign className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              className={fieldInput}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              placeholder="username"
            />
            {usernameStatus === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
            {usernameStatus === 'available' && (
              <Check className="anim-pop h-4 w-4 text-emerald-500" strokeWidth={3} />
            )}
            {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
              <X className="anim-pop h-4 w-4 text-red-500" strokeWidth={3} />
            )}
          </div>
          <p key={usernameStatus} className="anim-fade-in mt-1 text-xs">
            {usernameStatus === 'invalid' && (
              <span className="text-red-600">Herufi 3 hadi 20 (a-z, 0-9, _) bila nafasi.</span>
            )}
            {usernameStatus === 'taken' && (
              <span className="text-red-600">Limeshatumika, chagua lingine.</span>
            )}
            {usernameStatus === 'available' && <span className="text-emerald-600">Linapatikana</span>}
            {usernameStatus === 'checking' && <span className="text-slate-500">Inakagua...</span>}
          </p>
        </div>

        <div>
          <label className={labelClass}>Kuhusu mimi (si lazima)</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
            rows={3}
            placeholder="Jielezee kwa ufupi: unasoma nini, unapenda nini..."
            className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-emerald-900/40"
          />
          <p className="mt-1 text-right text-xs text-slate-400">
            {bio.length}/{BIO_MAX}
          </p>
        </div>
      </div>

      {error && (
        <p className="anim-scale-in mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Inahifadhi...
          </>
        ) : saved ? (
          <>
            <Check key="saved" className="anim-pop h-4 w-4" strokeWidth={3} /> Imehifadhiwa!
          </>
        ) : (
          <>
            <Save className="h-4 w-4" /> Hifadhi mabadiliko
          </>
        )}
      </button>

      {/* Kifaa cha kukata picha */}
      {cropTarget && (
        <ImageCropper
          key={`${cropTarget.kind}-${cropTarget.file.name}-${cropTarget.file.size}`}
          file={cropTarget.file}
          aspect={cropTarget.kind === 'avatar' ? 1 : 3}
          shape={cropTarget.kind === 'avatar' ? 'round' : 'rect'}
          outputWidth={cropTarget.kind === 'avatar' ? 512 : 1500}
          title={cropTarget.kind === 'avatar' ? 'Kata picha ya wasifu' : 'Kata picha ya cover'}
          onCancel={() => setCropTarget(null)}
          onDone={onCropDone}
        />
      )}
    </section>
  )
}

/* ===== Badilisha nywila ===== */
export function PasswordForm() {
  const supabase = useMemo(() => createClient(), [])
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleChange() {
    setError(null)
    setDone(false)
    if (password.length < 8) {
      setError('Nywila iwe angalau herufi 8.')
      return
    }
    if (password !== confirm) {
      setError('Nywila hazifanani.')
      return
    }
    setSaving(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (err) {
      setError(err.message)
    } else {
      setDone(true)
      setPassword('')
      setConfirm('')
      setTimeout(() => setDone(false), 3000)
    }
  }

  return (
    <section className="geometric-card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold text-slate-900 dark:text-white">
        <KeyRound className="h-5 w-5 text-emerald-600" /> Badilisha nywila
      </h2>
      <div className="space-y-3">
        <div className={fieldWrap}>
          <Lock className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            type="password"
            className={fieldInput}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nywila mpya (angalau herufi 8)"
            autoComplete="new-password"
          />
        </div>
        <div className={fieldWrap}>
          <Lock className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            type="password"
            className={fieldInput}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Rudia nywila mpya"
            autoComplete="new-password"
          />
        </div>
      </div>
      {error && (
        <p className="anim-scale-in mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}
      {done && (
        <p className="anim-scale-in mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
          Nywila imebadilishwa.
        </p>
      )}
      <button
        type="button"
        onClick={handleChange}
        disabled={saving || !password || !confirm}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-emerald-500 py-2.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 active:scale-[0.98] disabled:opacity-40 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {saving ? 'Inabadilisha...' : 'Badilisha nywila'}
      </button>
    </section>
  )
}

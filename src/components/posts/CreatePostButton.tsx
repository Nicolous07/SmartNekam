'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, X, ImagePlus, Loader2, Table2, Eye, Pencil, EyeOff, Link2,
  Paperclip, FileText, FileImage, Video as VideoIcon, Camera, Upload, CircleStop, File as FileIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import RichContent from '@/components/posts/RichContent'
import { mergeVideoFilesInBrowser } from '@/lib/mergeVideos'

type SelectedAttachment = { file: File; previewUrl: string | null }
type UploadedAttachment = { url: string; name: string; mime_type: string; size_bytes: number }

const TABLE_TEMPLATE = '\n| Kipengele | Hatua | Jibu |\n|---|---|---|\n| | | |\n| | | |\n'
const CATEGORIES = [
  { value: 'academics', label: 'Masomo' },
  { value: 'guidance', label: 'Ushauri' },
  { value: 'campus_life', label: 'Maisha ya chuo' },
] as const
const SUBJECTS = [
  'Mathematics', 'Biology', 'Physics', 'Chemistry', 'General Studies', 'English',
  'Kiswahili', 'History', 'Geography', 'Computer Science', 'Nyingine',
]
const MAX_CHARS = 5000
const MAX_FILES = 5
const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_VIDEO_BYTES = 50 * 1024 * 1024
const MAX_MERGE_SOURCE_BYTES = 150 * 1024 * 1024
const MAX_MERGE_CLIPS = 5
const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/3gpp', 'video/x-m4v',
  'application/pdf',
  'text/plain', 'text/csv', 'application/msword', 'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
])

function formatBytes(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export default function CreatePostButton() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraPhotoInputRef = useRef<HTMLInputElement>(null)
  const cameraVideoInputRef = useRef<HTMLInputElement>(null)
  const videoMergeInputRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const attachmentsRef = useRef<SelectedAttachment[]>([])
  const cameraVideoRef = useRef<HTMLVideoElement>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<number | null>(null)
  const recordingStopTimeoutRef = useRef<number | null>(null)

  const [showPreview, setShowPreview] = useState(false)
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['value']>('academics')
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [socialLink, setSocialLink] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [attachments, setAttachments] = useState<SelectedAttachment[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraMode, setCameraMode] = useState<'photo' | 'video'>('photo')
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [cameraNotice, setCameraNotice] = useState('')
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [mergingVideo, setMergingVideo] = useState(false)
  const [mergeProgress, setMergeProgress] = useState('')

  attachmentsRef.current = attachments
  const previewContent = [content.trim(), socialLink.trim()].filter(Boolean).join('\n\n')
  useEffect(() => {
    const openComposer = () => { setOpen(true); setError('') }
    window.addEventListener('smartnekam:create-post', openComposer)
    return () => window.removeEventListener('smartnekam:create-post', openComposer)
  }, [])
  useEffect(() => () => {
    attachmentsRef.current.forEach(({ previewUrl }) => { if (previewUrl) URL.revokeObjectURL(previewUrl) })
  }, [])

  function clearRecordingTimers() {
    if (recordingIntervalRef.current !== null) window.clearInterval(recordingIntervalRef.current)
    if (recordingStopTimeoutRef.current !== null) window.clearTimeout(recordingStopTimeoutRef.current)
    recordingIntervalRef.current = null
    recordingStopTimeoutRef.current = null
  }

  function stopCameraStream() {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    cameraStreamRef.current = null
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null
  }

  function cancelCamera() {
    clearRecordingTimers()
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.ondataavailable = null
      recorder.onstop = null
      try { recorder.stop() } catch { /* recorder may already be stopping */ }
    }
    recorderRef.current = null
    recordedChunksRef.current = []
    stopCameraStream()
    setRecording(false)
    setRecordingSeconds(0)
    setCameraOpen(false)
    setCameraReady(false)
    setCameraError('')
    setCameraNotice('')
  }

  function openCamera(mode: 'photo' | 'video') {
    if (attachmentsRef.current.length >= MAX_FILES) {
      setError(`Unaweza kuambatisha faili zisizozidi ${MAX_FILES} kwa post moja.`)
      return
    }
    setError('')
    setCameraMode(mode)
    setCameraReady(false)
    setCameraError('')
    setCameraNotice('')
    setRecordingSeconds(0)
    // Browsers without getUserMedia can still ask the device to launch its native camera.
    if (!navigator.mediaDevices?.getUserMedia) {
      if (mode === 'photo') cameraPhotoInputRef.current?.click()
      else cameraVideoInputRef.current?.click()
      return
    }
    setCameraOpen(true)
  }

  function changeCameraMode(mode: 'photo' | 'video') {
    if (recording || mode === cameraMode) return
    setCameraReady(false)
    setCameraError('')
    setCameraNotice('')
    setCameraMode(mode)
  }

  function addCapturedFile(file: File): boolean {
    if (file.type.startsWith('video/') && attachmentsRef.current.some((item) => item.file.type.startsWith('video/'))) {
      const message = 'Kila post inaweza kuwa na video moja. Unganisha klipu kwanza au ondoa video iliyopo.'
      setError(message)
      setCameraError(message)
      return false
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      const message = `${file.name}: aina hii ya faili hairuhusiwi.`
      setError(message)
      setCameraError(message)
      return false
    }
    const maxBytes = file.type.startsWith('video/') ? MAX_VIDEO_BYTES : MAX_FILE_BYTES
    if (file.size > maxBytes) {
      const message = file.type.startsWith('video/')
        ? `${file.name}: video lisizidi 50 MB.`
        : `${file.name}: faili lisizidi 10 MB.`
      setError(message)
      setCameraError(message)
      return false
    }
    if (attachmentsRef.current.length >= MAX_FILES) {
      setError(`Unaweza kuambatisha faili zisizozidi ${MAX_FILES} kwa post moja.`)
      return false
    }
    const selected: SelectedAttachment = { file, previewUrl: URL.createObjectURL(file) }
    setAttachments((current) => [...current, selected].slice(0, MAX_FILES))
    setError('')
    return true
  }

  useEffect(() => {
    if (!cameraOpen) return
    let cancelled = false

    async function connectCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Kamera ya ndani ya ukurasa haipatikani. Tumia kamera ya kifaa au chagua faili kutoka kwenye kifaa.')
        return
      }
      const videoConstraints: MediaTrackConstraints = {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      }
      try {
        let stream: MediaStream
        if (cameraMode === 'video') {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: true })
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false })
            if (!cancelled) setCameraNotice('Microphone haikuruhusiwa; video hii itarekodiwa bila sauti.')
          }
        } else {
          stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false })
        }
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        cameraStreamRef.current = stream
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream
          await cameraVideoRef.current.play().catch(() => undefined)
        }
        if (!cancelled) setCameraReady(true)
      } catch (cameraFailure) {
        if (cancelled) return
        const name = cameraFailure instanceof Error ? cameraFailure.name : ''
        const message = name === 'NotAllowedError' || name === 'PermissionDeniedError'
          ? 'Ruhusu browser kutumia kamera (na microphone kwa video), kisha ujaribu tena.'
          : name === 'NotFoundError' || name === 'DevicesNotFoundError'
            ? 'Hakuna kamera iliyopatikana kwenye kifaa hiki.'
            : 'Kamera haikuweza kufunguka. Hakikisha unatumia HTTPS na hakuna programu nyingine inayoshikilia kamera.'
        setCameraError(message)
      }
    }

    void connectCamera()
    return () => {
      cancelled = true
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
      cameraStreamRef.current = null
      if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null
    }
  }, [cameraOpen, cameraMode])

  async function capturePhoto() {
    const video = cameraVideoRef.current
    if (!video || !cameraReady || !video.videoWidth || !video.videoHeight) {
      setCameraError('Kamera bado inaandaa picha. Jaribu tena baada ya sekunde chache.')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) {
      setCameraError('Imeshindikana kuandaa picha. Jaribu tena.')
      return
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (!blob) {
      setCameraError('Imeshindikana kutengeneza picha. Jaribu tena.')
      return
    }
    const photo = new File([blob], `smartnekam-picha-${Date.now()}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
    if (addCapturedFile(photo)) cancelCamera()
  }

  function stopVideoRecording() {
    const recorder = recorderRef.current
    if (recorder && recorder.state === 'recording') recorder.stop()
  }

  function startVideoRecording() {
    const stream = cameraStreamRef.current
    if (!cameraReady || !stream) {
      setCameraError('Subiri kamera ianze kabla ya kurekodi.')
      return
    }
    if (typeof MediaRecorder === 'undefined') {
      setCameraError('Kivinjari hiki hakina video recorder. Tumia Rekodi video ya kifaa au pakia faili kutoka kwenye kifaa.')
      return
    }
    try {
      const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
      const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 650000, audioBitsPerSecond: 64000 })
        : new MediaRecorder(stream)
      recorderRef.current = recorder
      recordedChunksRef.current = []
      setCameraError('')
      setCameraNotice('Video inaendelea kurekodiwa. Muda wa juu ni sekunde 30 na ukubwa hauzidi 50 MB.')
      setRecordingSeconds(0)
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data)
        const totalBytes = recordedChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0)
        if (totalBytes > MAX_VIDEO_BYTES && recorder.state === 'recording') {
          setCameraError('Video imefikia kikomo cha 50 MB. Inasimamishwa; ikizidi kikomo utahitaji kurekodi video fupi zaidi.')
          recorder.stop()
        }
      }
      recorder.onstop = () => {
        clearRecordingTimers()
        const chunks = recordedChunksRef.current
        recordedChunksRef.current = []
        setRecording(false)
        setRecordingSeconds(0)
        recorderRef.current = null
        const type = (recorder.mimeType || chunks.find((chunk) => chunk.type)?.type || 'video/webm').split(';')[0]
        const blob = new Blob(chunks, { type })
        if (blob.size === 0) {
          setCameraError('Hakuna video iliyorekodiwa. Jaribu tena.')
          return
        }
        if (blob.size > MAX_VIDEO_BYTES) {
          setCameraError('Video hii imezidi 50 MB. Chagua kurekodi tena kwa muda mfupi zaidi.')
          setCameraNotice('')
          return
        }
        const extension = type === 'video/mp4' ? 'mp4' : type === 'video/quicktime' ? 'mov' : 'webm'
        const file = new File([blob], `smartnekam-video-${Date.now()}.${extension}`, { type, lastModified: Date.now() })
        if (addCapturedFile(file)) {
          setCameraOpen(false)
          setCameraReady(false)
        } else {
          setCameraNotice('')
        }
      }
      recorder.start(1000)
      setRecording(true)
      recordingIntervalRef.current = window.setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000)
      recordingStopTimeoutRef.current = window.setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop()
      }, 30_000)
    } catch (recorderFailure) {
      setCameraError(recorderFailure instanceof Error ? `Imeshindikana kuanza kurekodi: ${recorderFailure.message}` : 'Imeshindikana kuanza kurekodi video.')
    }
  }

  useEffect(() => () => {
    if (recordingIntervalRef.current !== null) window.clearInterval(recordingIntervalRef.current)
    if (recordingStopTimeoutRef.current !== null) window.clearTimeout(recordingStopTimeoutRef.current)
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.ondataavailable = null
      recorder.onstop = null
      try { recorder.stop() } catch { /* recorder may already be stopping */ }
    }
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  // Jedwali bado linaweza kuingizwa kwa urahisi; alama ghafi za fomula zimeondolewa.
  function insertSnippet(snippet: string) {
    const el = textRef.current
    const start = el?.selectionStart ?? content.length
    const end = el?.selectionEnd ?? content.length
    const selected = content.slice(start, end)
    const hasCursorMarker = snippet.includes('|') && !snippet.startsWith('\n|')
    const inserted = hasCursorMarker ? snippet.replace('|', selected) : snippet
    const next = (content.slice(0, start) + inserted + content.slice(end)).slice(0, MAX_CHARS)
    setContent(next)
    setShowPreview(false)
    const caret = Math.min(next.length, start + snippet.length)
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(caret, caret) })
  }

  function reset() {
    cancelCamera()
    attachments.forEach(({ previewUrl }) => { if (previewUrl) URL.revokeObjectURL(previewUrl) })
    setShowPreview(false); setCategory('academics'); setSubject('')
    setContent(''); setSocialLink(''); setAnonymous(false); setAttachments([]); setError('')
    if (fileRef.current) fileRef.current.value = ''
    if (cameraPhotoInputRef.current) cameraPhotoInputRef.current.value = ''
    if (cameraVideoInputRef.current) cameraVideoInputRef.current.value = ''
    if (videoMergeInputRef.current) videoMergeInputRef.current.value = ''
  }

  function close() {
    if (busy) return
    cancelCamera()
    setOpen(false)
  }

  function onPickAttachments(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setError('')
    const accepted: SelectedAttachment[] = []
    for (const file of files) {
      if (!ALLOWED_TYPES.has(file.type)) {
        setError(`${file.name}: aina hii ya faili hairuhusiwi. Tumia picha, video fupi (MP4/WebM/MOV), PDF, Word, Excel, PowerPoint, TXT au CSV.`)
        continue
      }
      if (file.type.startsWith('video/') && (attachments.some((item) => item.file.type.startsWith('video/')) || accepted.some((item) => item.file.type.startsWith('video/')))) {
        setError('Kila post inaweza kuwa na video moja. Tumia “Unganisha video” kwa klipu nyingi.')
        continue
      }
      const maxBytes = file.type.startsWith('video/') ? MAX_VIDEO_BYTES : MAX_FILE_BYTES
      if (file.size > maxBytes) {
        setError(file.type.startsWith('video/')
          ? `${file.name}: video lisizidi 50 MB.`
          : `${file.name}: faili lisizidi 10 MB.`)
        continue
      }
      if (attachments.length + accepted.length >= MAX_FILES) {
        setError(`Unaweza kuambatisha faili zisizozidi ${MAX_FILES} kwa post moja.`)
        break
      }
      if (attachments.some((item) => item.file.name === file.name && item.file.size === file.size) || accepted.some((item) => item.file.name === file.name && item.file.size === file.size)) continue
      accepted.push({ file, previewUrl: file.type.startsWith('image/') || file.type.startsWith('video/') ? URL.createObjectURL(file) : null })
    }
    if (accepted.length) setAttachments((current) => [...current, ...accepted].slice(0, MAX_FILES))
    e.target.value = ''
  }

  async function onPickMergeVideos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    if (attachmentsRef.current.length >= MAX_FILES) {
      setError(`Unaweza kuambatisha faili zisizozidi ${MAX_FILES} kwa post moja.`)
      return
    }
    if (attachmentsRef.current.some((item) => item.file.type.startsWith('video/'))) {
      setError('Tayari una video kwenye post hii. Ondoa video hiyo kwanza kabla ya kuongeza video iliyounganishwa.')
      return
    }
    if (files.length < 2) {
      setError('Chagua angalau video 2 ili ziunganishwe na kuwa video moja.')
      return
    }
    if (files.length > MAX_MERGE_CLIPS) {
      setError(`Unaweza kuunganisha video zisizozidi ${MAX_MERGE_CLIPS} kwa wakati mmoja.`)
      return
    }
    if (files.some((file) => !file.type.startsWith('video/'))) {
      setError('Chagua video tu kwenye sehemu ya kuunganisha.')
      return
    }
    const oversized = files.find((file) => file.size > MAX_VIDEO_BYTES)
    if (oversized) {
      setError(`${oversized.name}: kila video ya kuanzia isizidi 50 MB.`)
      return
    }
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
    if (totalBytes > MAX_MERGE_SOURCE_BYTES) {
      setError('Jumla ya klipu za kuanzia izidi 150 MB. Chagua klipu chache au ndogo zaidi.')
      return
    }

    setMergingVideo(true)
    setMergeProgress('Inaandaa klipu…')
    setError('')
    try {
      const mergedFile = await mergeVideoFilesInBrowser(files, setMergeProgress)
      if (addCapturedFile(mergedFile)) setMergeProgress('Video moja imeongezwa kwenye post.')
    } catch (mergeFailure) {
      setError(mergeFailure instanceof Error ? mergeFailure.message : 'Imeshindikana kuunganisha video. Jaribu klipu nyingine.')
      setMergeProgress('')
    } finally {
      setMergingVideo(false)
    }
  }

  function removeAttachment(index: number) {
    const item = attachments[index]
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
    setAttachments((current) => current.filter((_, i) => i !== index))
    if (fileRef.current) fileRef.current.value = ''
  }

  async function submit() {
    if (mergingVideo) {
      setError('Subiri kuunganishwa kwa video kumalizike kabla ya kuchapisha.')
      return
    }
    const text = content.trim()
    const rawSocialLink = socialLink.trim()
    let normalizedSocialLink = ''
    if (rawSocialLink) {
      const candidate = rawSocialLink.toLowerCase().startsWith('http://') || rawSocialLink.toLowerCase().startsWith('https://')
        ? rawSocialLink
        : `https://${rawSocialLink}`
      try {
        const parsed = new URL(candidate)
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('Tumia link inayoanza na https:// au http://.')
        normalizedSocialLink = parsed.href
      } catch {
        setError('Link si sahihi. Bandika anwani kamili ya video kutoka YouTube, TikTok, Instagram, Facebook, X, Vimeo au mtandao mwingine.')
        return
      }
    }
    if (text.length < 3 && !normalizedSocialLink) {
      setError('Andika maelezo ya post au weka link ya video/mitandao ya kijamii.')
      return
    }
    const postContent = [text, normalizedSocialLink].filter(Boolean).join('\n\n')
    setBusy(true); setError('')
    const uploadedPaths: string[] = []
    let postInserted = false
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Tafadhali ingia tena.')

      const uploaded: UploadedAttachment[] = []
      for (const item of attachments) {
        const file = item.file
        const ext = (file.name.split('.').pop() || 'file').toLowerCase().replace(/[^a-z0-9]/g, '') || 'file'
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage.from('post-attachments').upload(path, file, {
          cacheControl: '3600', upsert: false, contentType: file.type,
        })
        if (uploadError) throw new Error(`Faili “${file.name}” halikupakiwa. Hakikisha SQL 018 imeendeshwa. ${uploadError.message}`)
        uploadedPaths.push(path)
        const url = supabase.storage.from('post-attachments').getPublicUrl(path).data.publicUrl
        uploaded.push({ url, name: file.name, mime_type: file.type, size_bytes: file.size })
      }
      const firstImage = uploaded.find((file) => file.mime_type.startsWith('image/'))
      const { error: insertError } = await supabase.from('posts').insert({
        author_id: user.id,
        category,
        subject: category === 'academics' && subject ? subject : null,
        content: postContent,
        image_url: firstImage?.url ?? null,
        attachments: uploaded,
        is_anonymous: anonymous,
      })
      if (insertError) throw new Error(insertError.message.includes('attachments')
        ? 'Sehemu ya attachments haipo bado kwenye database. Endesha SQL 018 kisha ujaribu tena.'
        : insertError.message)
      postInserted = true
      reset(); setOpen(false); router.refresh()
    } catch (e) {
      if (!postInserted && uploadedPaths.length) {
        const { error: cleanupError } = await supabase.storage.from('post-attachments').remove(uploadedPaths)
        if (cleanupError) console.warn('SmartNekam attachment cleanup:', cleanupError.message)
      }
      setError(e instanceof Error ? e.message : 'Imeshindikana kuchapisha. Jaribu tena.')
    } finally { setBusy(false) }
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label="Chapisha kitu kipya" className="anim-scale-in anim-delay-3 fixed bottom-24 right-4 z-[45] hidden h-14 w-14 touch-manipulation items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-900/30 transition-all duration-300 hover:scale-105 hover:bg-emerald-500 active:scale-95 lg:bottom-6 lg:right-6 lg:flex"><Plus className="h-7 w-7"/></button>
    {open && <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Funga dirisha la post" onClick={close} className="anim-fade-in absolute inset-0 bg-black/60" />
      <section role="dialog" aria-modal="true" aria-labelledby="create-post-heading" className="geometric-card anim-sheet-up relative z-10 flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl sm:max-w-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-emerald-100 px-4 py-3.5 dark:border-slate-800 sm:px-5"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-700 dark:text-emerald-300">SmartNekam community</p><h2 id="create-post-heading" className="mt-0.5 font-heading text-lg font-black text-slate-950 dark:text-white">Andaa post yako</h2></div><button type="button" onClick={close} disabled={busy} aria-label="Funga" className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5"/></button></div>

        <div className="space-y-4 overflow-y-auto p-4 sm:p-5">
          <div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Aina ya post</p><div className="flex flex-wrap gap-2">{CATEGORIES.map((item) => <button key={item.value} type="button" onClick={() => setCategory(item.value)} className={`rounded-full border px-3.5 py-2 text-sm font-bold transition ${category === item.value ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}>{item.label}</button>)}</div></div>

          {category === 'academics' && <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">Somo (hiari)</span><select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="">Chagua somo</option>{SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>}

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-3 transition hover:border-emerald-300 dark:border-slate-700"><input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="mt-1 h-4 w-4 accent-emerald-600"/><span><span className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900 dark:text-white"><EyeOff className="h-4 w-4 text-emerald-600"/> Chapisha bila kuonyesha jina</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">Jina halitaonekana kwa wanafunzi wengine kwenye post hii.</span></span></label>

          <div><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><label htmlFor="post-content" className="text-xs font-bold uppercase tracking-wide text-slate-500">Maandishi ya post</label><div className="flex flex-wrap gap-1.5"><button type="button" onClick={() => insertSnippet(TABLE_TEMPLATE)} title="Ingiza jedwali" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><Table2 className="h-4 w-4"/> Jedwali</button><button type="button" onClick={() => setShowPreview((v) => !v)} aria-pressed={showPreview} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${showPreview ? 'bg-emerald-600 text-white' : 'border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200'}`}>{showPreview ? <Pencil className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}{showPreview ? 'Hariri' : 'Hakiki'}</button></div></div>

            {showPreview ? <div className="min-h-40 rounded-2xl border border-emerald-200 bg-white p-4 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">{previewContent ? <RichContent text={previewContent} className="leading-7"/> : <p className="text-slate-400">Andika maelezo au weka link ya video ili kuona hakiki.</p>}</div> : <textarea id="post-content" ref={textRef} value={content} onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))} rows={7} placeholder={'Andika swali, ufafanuzi, ushauri au mafanikio yako kwa lugha rahisi. Unaweza kutumia maandishi ya kawaida, mistari na jedwali.'} className="min-h-40 w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm leading-7 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-emerald-900/30"/>}
            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-400"><span>Tumia maandishi rahisi, mistari au jedwali ili ujumbe wako ueleweke kwa urahisi.</span><span className="shrink-0">{content.length}/{MAX_CHARS}</span></div>
          </div>

          <section className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-900 dark:bg-indigo-950/20">
            <label htmlFor="post-social-link" className="flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200"><Link2 className="h-4 w-4" /></span>
              Weka link ya video / mitandao ya kijamii
              <span className="text-xs font-semibold text-slate-500">(hiari)</span>
            </label>
            <input
              id="post-social-link"
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={socialLink}
              onChange={(e) => setSocialLink(e.target.value.slice(0, 2048))}
              placeholder="Bandika link ya YouTube, TikTok, Instagram, Facebook, X, Vimeo..."
              className="mt-3 w-full rounded-xl border border-indigo-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-indigo-900/30"
            />
            <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
              Link itahifadhiwa pamoja na post na kuonyeshwa hapa kwenye Home Feed. Video za YouTube, TikTok, Instagram Reels, Facebook, X, Vimeo na Dailymotion zitachezwa ndani ya post pale mtandao unaporuhusu. Link nyingine itaonekana kama link ya kufungua.
            </p>
          </section>

          <section className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/50 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"><Paperclip className="h-5 w-5"/></span>
                <div><p className="text-sm font-extrabold text-slate-900 dark:text-white">Picha, video fupi na viambatisho</p><p className="mt-0.5 text-xs leading-5 text-slate-500">Picha/nyaraka hadi 10 MB; video moja au video iliyounganishwa hadi 50 MB. Unaweza kuunganisha klipu 2–5 (jumla ya klipu za kuanzia hadi 150 MB). Video ya kamera: sekunde 30.</p></div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => openCamera('photo')} disabled={attachments.length >= MAX_FILES || busy || mergingVideo} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-xs font-extrabold text-emerald-800 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-900 dark:bg-slate-900 dark:text-emerald-200 dark:hover:bg-slate-800"><Camera className="h-4 w-4"/> Piga picha</button>
                <button type="button" onClick={() => openCamera('video')} disabled={attachments.length >= MAX_FILES || busy || mergingVideo} className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-xs font-extrabold text-violet-800 shadow-sm transition hover:border-violet-400 hover:bg-violet-50 disabled:opacity-50 dark:border-violet-900 dark:bg-slate-900 dark:text-violet-200 dark:hover:bg-slate-800"><VideoIcon className="h-4 w-4"/> Rekodi video</button>
                <button type="button" onClick={() => fileRef.current?.click()} disabled={attachments.length >= MAX_FILES || busy || mergingVideo} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"><Upload className="h-4 w-4"/> Kutoka kwenye kifaa</button>
                <button type="button" onClick={() => videoMergeInputRef.current?.click()} disabled={attachments.length >= MAX_FILES || busy || mergingVideo} className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-xs font-extrabold text-indigo-800 shadow-sm transition hover:border-indigo-400 hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200 dark:hover:bg-indigo-950/60">{mergingVideo ? <Loader2 className="h-4 w-4 animate-spin"/> : <VideoIcon className="h-4 w-4"/>} Unganisha video</button>
              </div>
              <input ref={videoMergeInputRef} type="file" multiple accept="video/mp4,video/webm,video/quicktime,video/3gpp,video/x-m4v" onChange={onPickMergeVideos} className="hidden"/>
              {mergingVideo && <p role="status" className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-200">{mergeProgress || 'Inaunganisha klipu…'} Usifunge ukurasa wakati inaendelea.</p>}
              {!mergingVideo && mergeProgress && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">{mergeProgress}</p>}
            </div>
            <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,video/3gpp,video/x-m4v,application/pdf,text/plain,text/csv,application/msword,application/vnd.ms-excel,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange={onPickAttachments} className="hidden"/>
            <input ref={cameraPhotoInputRef} type="file" accept="image/*" capture="environment" onChange={onPickAttachments} className="hidden"/>
            <input ref={cameraVideoInputRef} type="file" accept="video/*" capture="environment" onChange={onPickAttachments} className="hidden"/>
            {attachments.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{attachments.map((item, index) => <div key={`${item.file.name}-${item.file.size}-${index}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-emerald-100 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">{item.file.type.startsWith('image/') && item.previewUrl ? <img src={item.previewUrl} alt={`Preview ${item.file.name}`} className="h-12 w-12 shrink-0 rounded-lg object-cover"/> : item.file.type.startsWith('video/') && item.previewUrl ? <video src={item.previewUrl} aria-label={`Preview ${item.file.name}`} muted playsInline preload="metadata" controls className="h-12 w-16 shrink-0 rounded-lg bg-black object-cover"/> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-emerald-700 dark:bg-slate-800 dark:text-emerald-200">{item.file.type.startsWith('video/') ? <VideoIcon className="h-5 w-5"/> : item.file.type.startsWith('image/') ? <FileImage className="h-5 w-5"/> : item.file.type === 'application/pdf' ? <FileText className="h-5 w-5"/> : <FileIcon className="h-5 w-5"/>}</span>}<span className="min-w-0 flex-1"><span className="block truncate text-xs font-extrabold text-slate-900 dark:text-white">{item.file.name}</span><span className="mt-1 block text-[10px] text-slate-500">{formatBytes(item.file.size)}</span></span><button type="button" onClick={() => removeAttachment(index)} disabled={busy} aria-label={`Ondoa ${item.file.name}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"><X className="h-4 w-4"/></button></div>)}</div>}
          </section>

          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-emerald-100 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/80 sm:px-5"><p className="hidden text-xs text-slate-500 sm:block">Andika kwa lugha iliyo wazi ili kila mwanafunzi aelewe.</p><div className="ml-auto flex gap-2"><button type="button" onClick={close} disabled={busy} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">Ghairi</button><button type="button" onClick={() => void submit()} disabled={busy || mergingVideo || (content.trim().length < 3 && !socialLink.trim())} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-emerald-500 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <Plus className="h-4 w-4"/>}{busy ? 'Inapakia na kuchapisha...' : 'Chapisha post'}</button></div></div>
      </section>
    </div>}
    {cameraOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-5">
      <button type="button" aria-label="Funga kamera" onClick={cancelCamera} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"/>
      <section role="dialog" aria-modal="true" aria-labelledby="camera-dialog-heading" className="relative z-10 flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#121826]">
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
          <div><h2 id="camera-dialog-heading" className="font-heading text-lg font-extrabold text-slate-950 dark:text-white">{cameraMode === 'photo' ? 'Piga picha' : 'Rekodi video fupi'}</h2><p className="mt-0.5 text-xs text-slate-500">Ruhusu kamera ya kifaa. Video: sekunde 30 au MB 10 kwa juu.</p></div>
          <button type="button" onClick={cancelCamera} aria-label="Funga kamera" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5"/></button>
        </header>
        <div className="space-y-3 overflow-y-auto p-3 sm:p-4">
          <div className="relative overflow-hidden rounded-2xl bg-black">
            <video ref={cameraVideoRef} autoPlay playsInline muted className="aspect-[4/3] max-h-[58dvh] w-full object-contain"/>
            {!cameraReady && !cameraError && <div className="absolute inset-0 flex items-center justify-center bg-black/60 px-6 text-center text-sm font-semibold text-white"><Loader2 className="mr-2 h-5 w-5 animate-spin"/>Inaunganisha kamera...</div>}
            {recording && <span className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-red-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-lg"><span className="h-2 w-2 animate-pulse rounded-full bg-white"/> REC {recordingSeconds}s</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => changeCameraMode('photo')} disabled={recording || cameraMode === 'photo'} className={`rounded-full px-3 py-2 text-xs font-extrabold transition ${cameraMode === 'photo' ? 'bg-emerald-600 text-white' : 'border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}><Camera className="mr-1 inline h-3.5 w-3.5"/> Picha</button>
            <button type="button" onClick={() => changeCameraMode('video')} disabled={recording || cameraMode === 'video'} className={`rounded-full px-3 py-2 text-xs font-extrabold transition ${cameraMode === 'video' ? 'bg-violet-600 text-white' : 'border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}><VideoIcon className="mr-1 inline h-3.5 w-3.5"/> Video</button>
          </div>
          {cameraNotice && <p className="rounded-xl bg-indigo-50 px-3 py-2 text-xs leading-5 text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-200">{cameraNotice}</p>}
          {cameraError && <div role="alert" className="space-y-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"><p>{cameraError}</p><button type="button" onClick={() => { const mode = cameraMode; cancelCamera(); if (mode === 'photo') cameraPhotoInputRef.current?.click(); else cameraVideoInputRef.current?.click() }} className="rounded-lg border border-red-300 bg-white px-3 py-2 font-bold text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-slate-900 dark:text-red-200">Tumia kamera ya kifaa / chagua faili</button></div>}
        </div>
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 p-3 dark:border-slate-800 sm:p-4">
          <button type="button" onClick={cancelCamera} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Ghairi</button>
          {cameraMode === 'photo'
            ? <button type="button" onClick={() => void capturePhoto()} disabled={!cameraReady || busy} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-500 disabled:opacity-45"><Camera className="h-4 w-4"/> Piga picha</button>
            : recording
              ? <button type="button" onClick={stopVideoRecording} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-red-500"><CircleStop className="h-4 w-4"/> Simamisha ({recordingSeconds}s)</button>
              : <button type="button" onClick={startVideoRecording} disabled={!cameraReady || busy} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-violet-500 disabled:opacity-45"><VideoIcon className="h-4 w-4"/> Anza kurekodi</button>}
        </footer>
      </section>
    </div>}
  </>
}

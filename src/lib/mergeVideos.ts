const MAX_MERGED_VIDEO_BYTES = 50 * 1024 * 1024
const MAX_VIDEO_CLIPS = 5
const MAX_SOURCE_VIDEO_BYTES = 150 * 1024 * 1024

type MergeProgress = (message: string) => void

function loadVideoMetadata(video: HTMLVideoElement, url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('error', onError)
    }
    const onLoaded = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('Video mojawapo haiwezi kufunguliwa na browser hii. Jaribu MP4 au WebM iliyosanifiwa kwa browser.'))
    }
    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('error', onError)
    video.src = url
    video.load()
  })
}

/**
 * Joins multiple local video clips in-browser by playing them sequentially into
 * one canvas/audio stream. No clips are sent to a server until the user posts.
 * The resulting WebM/MP4 is kept under the Home Feed's 50 MB upload limit.
 */
export async function mergeVideoFilesInBrowser(
  files: File[],
  onProgress: MergeProgress = () => undefined,
): Promise<File> {
  if (files.length < 2) throw new Error('Chagua angalau video 2 ili kuziunganisha.')
  if (files.length > MAX_VIDEO_CLIPS) throw new Error(`Unaweza kuunganisha video zisizozidi ${MAX_VIDEO_CLIPS} kwa wakati mmoja.`)
  if (files.some((file) => !file.type.startsWith('video/'))) throw new Error('Chagua video tu; picha na nyaraka hazihusishwi kwenye kuunganisha video.')
  if (files.some((file) => file.size > MAX_MERGED_VIDEO_BYTES)) throw new Error('Kila video ya kuanzia lazima iwe chini ya 50 MB.')
  const totalSourceBytes = files.reduce((sum, file) => sum + file.size, 0)
  if (totalSourceBytes > MAX_SOURCE_VIDEO_BYTES) throw new Error('Jumla ya video za kuanzia izidi 150 MB. Chagua klipu chache au ndogo ili kifaa kisilemewe.')

  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    throw new Error('Browser hii haiwezi kuunganisha video moja kwa moja. Tumia kifaa/browser ya kisasa au pakia video moja iliyokwisha kuunganishwa.')
  }
  if (typeof HTMLCanvasElement.prototype.captureStream !== 'function') {
    throw new Error('Browser hii haiwezi kurekodi video iliyounganishwa. Tumia browser ya kisasa au pakia video moja iliyokwisha kuunganishwa.')
  }

  const objectUrls = files.map((file) => URL.createObjectURL(file))
  const video = document.createElement('video')
  video.playsInline = true
  video.preload = 'auto'
  video.muted = false
  video.setAttribute('aria-hidden', 'true')
  Object.assign(video.style, { position: 'fixed', left: '-10000px', top: '0', width: '2px', height: '2px', opacity: '0', pointerEvents: 'none' })
  document.body.appendChild(video)

  let audioContext: AudioContext | null = null
  let canvasStream: MediaStream | null = null
  let mergedStream: MediaStream | null = null
  let recorder: MediaRecorder | null = null
  let animationId = 0
  let recordedBlobPromise: Promise<Blob> | null = null
  let sizeLimitReached = false
  let rejectForSize: ((error: Error) => void) | null = null

  try {
    await loadVideoMetadata(video, objectUrls[0])
    const sourceWidth = Math.max(2, video.videoWidth || 1280)
    const sourceHeight = Math.max(2, video.videoHeight || 720)
    const scale = Math.min(1, 1280 / sourceWidth, 1280 / sourceHeight)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(2, Math.floor((sourceWidth * scale) / 2) * 2)
    canvas.height = Math.max(2, Math.floor((sourceHeight * scale) / 2) * 2)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Imeshindikana kuandaa eneo la kuunganisha video.')

    const AudioContextConstructor = window.AudioContext
    if (!AudioContextConstructor) throw new Error('Browser hii haiwezi kuunganisha sauti za video. Tumia browser ya kisasa au pakia video moja.')
    audioContext = new AudioContextConstructor()
    await audioContext.resume()
    const audioSource = audioContext.createMediaElementSource(video)
    const audioDestination = audioContext.createMediaStreamDestination()
    audioSource.connect(audioDestination)

    canvasStream = canvas.captureStream(24)
    mergedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioDestination.stream.getAudioTracks(),
    ])

    const candidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
    ]
    const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type))
    if (!mimeType) throw new Error('Browser hii haina format ya kurekodi video iliyounganishwa inayotumika.')

    const chunks: Blob[] = []
    const sizeLimitPromise = new Promise<never>((_resolve, reject) => { rejectForSize = reject })
    // The race below observes this rejection while the recorder is active.
    sizeLimitPromise.catch(() => undefined)

    recorder = new MediaRecorder(mergedStream, {
      mimeType,
      videoBitsPerSecond: 1_200_000,
      audioBitsPerSecond: 96_000,
    })

    recordedBlobPromise = new Promise<Blob>((resolve, reject) => {
      recorder!.addEventListener('dataavailable', (event: BlobEvent) => {
        if (event.data.size > 0) chunks.push(event.data)
        const currentSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0)
        if (currentSize > MAX_MERGED_VIDEO_BYTES && !sizeLimitReached) {
          sizeLimitReached = true
          rejectForSize?.(new Error('Video iliyounganishwa imezidi 50 MB. Punguza idadi ya klipu au chagua video fupi/ndogo zaidi.'))
          video.pause()
          if (recorder?.state === 'recording') recorder.stop()
        }
      })
      recorder!.addEventListener('stop', () => {
        const type = (recorder?.mimeType || mimeType).split(';')[0]
        resolve(new Blob(chunks, { type }))
      }, { once: true })
      recorder!.addEventListener('error', () => reject(new Error('Kuna hitilafu wakati wa kuunganisha video. Jaribu klipu nyingine.' )), { once: true })
    })

    const drawFrame = () => {
      context.fillStyle = '#000000'
      context.fillRect(0, 0, canvas.width, canvas.height)
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
        const scaleToFit = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight)
        const width = video.videoWidth * scaleToFit
        const height = video.videoHeight * scaleToFit
        context.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
      }
      if (recorder?.state === 'recording') animationId = window.requestAnimationFrame(drawFrame)
    }

    recorder.start(1000)
    drawFrame()

    const playAllClips = async () => {
      for (let index = 0; index < files.length; index += 1) {
        onProgress(`Inaunganisha video ${index + 1} kati ya ${files.length}…`)
        await loadVideoMetadata(video, objectUrls[index])
        const ended = new Promise<void>((resolve, reject) => {
          const cleanup = () => {
            video.removeEventListener('ended', onEnded)
            video.removeEventListener('error', onError)
          }
          const onEnded = () => { cleanup(); resolve() }
          const onError = () => {
            cleanup()
            reject(new Error(`Video ya ${index + 1} haiwezi kucheza. Jaribu MP4 au WebM iliyosanifiwa kwa browser.`))
          }
          video.addEventListener('ended', onEnded)
          video.addEventListener('error', onError)
          video.play().catch(() => {
            cleanup()
            reject(new Error('Imeshindikana kucheza klipu mojawapo. Hakikisha browser inaweza kucheza video hiyo.'))
          })
        })
        await ended
      }
    }

    await Promise.race([playAllClips(), sizeLimitPromise])
    if (recorder.state === 'recording') recorder.stop()
    const blob = await recordedBlobPromise
    if (sizeLimitReached || blob.size > MAX_MERGED_VIDEO_BYTES) {
      throw new Error('Video iliyounganishwa imezidi 50 MB. Punguza idadi ya klipu au chagua video fupi/ndogo zaidi.')
    }
    if (!blob.size) throw new Error('Video iliyounganishwa haina data. Jaribu tena.')
    const outputType = blob.type || mimeType.split(';')[0]
    const extension = outputType === 'video/mp4' ? 'mp4' : 'webm'
    onProgress('Video imeunganishwa tayari.')
    return new File([blob], `smartnekam-video-iliyounganishwa-${Date.now()}.${extension}`, {
      type: outputType,
      lastModified: Date.now(),
    })
  } catch (error) {
    video.pause()
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop() } catch { /* recorder may already be stopped */ }
    }
    if (recordedBlobPromise) await recordedBlobPromise.catch(() => undefined)
    throw error
  } finally {
    if (animationId) window.cancelAnimationFrame(animationId)
    video.pause()
    video.removeAttribute('src')
    video.load()
    mergedStream?.getTracks().forEach((track) => track.stop())
    canvasStream?.getTracks().forEach((track) => track.stop())
    if (audioContext && audioContext.state !== 'closed') await audioContext.close().catch(() => undefined)
    objectUrls.forEach((url) => URL.revokeObjectURL(url))
    video.remove()
  }
}

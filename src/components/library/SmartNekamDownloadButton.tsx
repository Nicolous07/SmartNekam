'use client'

import { useMemo, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { watermarkLibraryDownload } from '@/lib/libraryWatermark'

export default function SmartNekamDownloadButton({ id, type, storagePath, fileName }: { id: string; type: 'notes' | 'past_papers' | 'textbooks'; storagePath: string; fileName: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function download() {
    setBusy(true); setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Ingia ili kupakua nyenzo.')
      let insertError: { code?: string; message: string } | null = null
      if (type === 'notes') {
        const result = await supabase.from('note_downloads').insert({ note_id: id, user_id: user.id })
        insertError = result.error
      } else if (type === 'past_papers') {
        const result = await supabase.from('past_paper_downloads').insert({ past_paper_id: id, user_id: user.id })
        insertError = result.error
      } else {
        const result = await supabase.from('textbook_downloads').insert({ textbook_id: id, user_id: user.id })
        insertError = result.error
      }
      if (insertError && insertError.code !== '23505') throw insertError
      const { data, error: urlError } = await supabase.storage.from('learning-resources').createSignedUrl(storagePath, 300, { download: fileName })
      if (urlError || !data?.signedUrl) throw urlError ?? new Error('Imeshindikana kutengeneza link ya kupakua.')
      const response = await fetch(data.signedUrl)
      if (!response.ok) throw new Error('Imeshindikana kupakua faili kutoka Supabase Storage.')
      const originalFile = await response.blob()
      const watermarked = await watermarkLibraryDownload(originalFile, fileName)
      const objectUrl = URL.createObjectURL(watermarked.blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = watermarked.fileName
      anchor.style.display = 'none'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000)
    } catch (e) { setError(e instanceof Error ? e.message : 'Imeshindikana kupakua.') }
    finally { setBusy(false) }
  }
  return <div><button type="button" disabled={busy} onClick={download} className="flex w-full items-center justify-center gap-2 rounded-xl sn-primary-gradient px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{busy ? 'Inaweka watermark...' : 'Pakua nyenzo'}</button>{error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}</div>
}

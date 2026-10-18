'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { UPLOAD_REWARD_POINTS } from '@/lib/library'

// Kupakua: function ya database hukagua bei, hukata EduPoints (mara ya kwanza tu),
// kisha tunatengeneza signed URL ya muda mfupi.
export async function getDownloadUrl(itemId: string): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient()
  const { data: path, error } = await supabase.rpc('download_library_item', { p_item_id: itemId })
  if (error || !path) return { error: error?.message ?? 'Imeshindikana kupakua.' }

  const { data, error: signErr } = await supabase.storage
    .from('library-files')
    .createSignedUrl(path as string, 120, { download: true })
  if (signErr || !data) return { error: 'Imeshindikana kutengeneza kiungo cha kupakua.' }

  revalidatePath('/library')
  return { url: data.signedUrl }
}

// ===== Uhakiki (Admin / Moderator) =====
export async function approveItem(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const supabase = await createClient()
  await supabase.rpc('approve_library_item', { p_item_id: id, p_reward: UPLOAD_REWARD_POINTS })
  revalidatePath('/admin')
  revalidatePath('/library')
}

export async function rejectItem(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const supabase = await createClient()
  // RLS inaruhusu staff pekee kubadilisha status
  await supabase.from('library_items').update({ status: 'rejected' }).eq('id', id)
  revalidatePath('/admin')
}

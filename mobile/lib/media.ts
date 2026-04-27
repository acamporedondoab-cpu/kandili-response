import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import { supabase } from './supabase/client'

export type MediaItem = {
  uri: string
  type: 'photo' | 'video'
  description: string
}

export type IncidentMedia = {
  id: string
  incident_id: string
  media_url: string
  media_type: 'photo' | 'video'
  description: string | null
  created_at: string
}

export async function uploadIncidentMedia(
  incidentId: string,
  userId: string,
  item: MediaItem
): Promise<{ error?: string }> {
  const ext = item.type === 'photo' ? 'jpg' : 'mp4'
  const path = `${incidentId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const base64 = await FileSystem.readAsStringAsync(item.uri, {
    encoding: 'base64',
  })
  const arrayBuffer = decode(base64)

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('incident-media')
    .upload(path, arrayBuffer, {
      contentType: item.type === 'photo' ? 'image/jpeg' : 'video/mp4',
      upsert: false,
    })

  if (uploadError) {
    console.error('[uploadIncidentMedia] storage:', uploadError.message)
    return { error: uploadError.message }
  }

  // Store the storage path, not a public URL — signed URLs generated at read time
  const { error: dbError } = await supabase.from('incident_media').insert({
    incident_id: incidentId,
    uploaded_by: userId,
    media_url: uploadData.path,
    media_type: item.type,
    description: item.description.trim() || null,
  })

  if (dbError) {
    console.error('[uploadIncidentMedia] db:', dbError.message)
    return { error: dbError.message }
  }

  return {}
}

export async function fetchIncidentMedia(incidentId: string): Promise<IncidentMedia[]> {
  const { data, error } = await supabase
    .from('incident_media')
    .select('id, incident_id, media_url, media_type, description, created_at')
    .eq('incident_id', incidentId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[fetchIncidentMedia]', error.message)
    return []
  }

  const rows = (data ?? []) as IncidentMedia[]
  if (rows.length === 0) return rows

  // Rows stored as a path (post-020) → resolve to public URL
  // Legacy rows already have a full https:// URL → serve as-is
  return rows.map(r => {
    if (r.media_url.startsWith('http')) return r
    const { data: urlData } = supabase.storage
      .from('incident-media')
      .getPublicUrl(r.media_url)
    return { ...r, media_url: urlData.publicUrl }
  })
}

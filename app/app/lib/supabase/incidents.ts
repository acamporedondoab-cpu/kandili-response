import { createClient } from './server'

export interface Incident {
  id: string
  incident_code: string
  emergency_type: 'crime' | 'medical'
  status: string
  priority_level: string
  citizen_lat: number
  citizen_lng: number
  citizen_address: string | null
  notes: string | null
  created_at: string
  updated_at: string
  citizen_id: string
  organization_id: string | null
  assigned_tl_id: string | null
  assigned_responder_id: string | null
}

export async function getOrgIncidents(orgId: string): Promise<Incident[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('incidents')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getOrgIncidents]', error.message)
    return []
  }

  return data ?? []
}

export async function getAllIncidents(): Promise<Incident[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('incidents')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[getAllIncidents]', error.message)
    return []
  }

  return data ?? []
}

export async function getIncidentById(id: string): Promise<Incident | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('incidents')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('[getIncidentById]', error.message)
    return null
  }

  return data
}

export async function getResponderActiveIncident(responderId: string): Promise<Incident | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('incidents')
    .select('*')
    .eq('assigned_responder_id', responderId)
    .in('status', ['assigned', 'accepted', 'en_route', 'arrived', 'pending_citizen_confirmation'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // no rows
    console.error('[getResponderActiveIncident]', error.message)
    return null
  }

  return data
}

export async function getCitizenIncidents(
  citizenId: string
): Promise<Incident[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('incidents')
    .select('*')
    .eq('citizen_id', citizenId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getCitizenIncidents]', error.message)
    return []
  }

  return data ?? []
}
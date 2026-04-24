import { createClient } from './server'
import type { Organization } from '../types/organization'
import type { Profile, UserRole } from '../types/profile'

export async function getOrganizations(): Promise<Organization[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('is_active', true)

  if (error) {
    console.error('[getOrganizations]', error.message)
    return []
  }

  return data ?? []
}

export async function getProfileName(id: string): Promise<string> {
  const supabase = createClient()

  const { data } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', id)
    .single()

  return data?.full_name || id
}

export async function getOrgMembers(
  orgId: string,
  role?: UserRole
): Promise<Profile[]> {
  const supabase = createClient()

  let query = supabase
    .from('profiles')
    .select('*')
    .eq('organization_id', orgId)

  if (role) {
    query = query.eq('role', role)
  }

  const { data, error } = await query

  if (error) {
    console.error('[getOrgMembers]', error.message)
    return []
  }

  return data ?? []
}
'use server'

import { createAdminClient } from '../lib/supabase/admin'
import { createClient } from '../lib/supabase/server'
import type { OrganizationType } from '../lib/types/organization'

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function uploadImage(bucket: string, file: File): Promise<string | null> {
  const admin = createAdminClient()
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const bytes = await file.arrayBuffer()

  const { data, error } = await admin.storage
    .from(bucket)
    .upload(path, bytes, { contentType: file.type, upsert: false })

  if (error) {
    console.error(`[uploadImage] ${bucket}:`, error.message)
    return null
  }

  const { data: urlData } = admin.storage.from(bucket).getPublicUrl(data.path)
  return urlData.publicUrl
}

export async function createOrganizationAction(
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const name = (formData.get('name') as string)?.trim()
  const type = formData.get('type') as OrganizationType
  const base_lat = parseFloat(formData.get('base_lat') as string)
  const base_lng = parseFloat(formData.get('base_lng') as string)
  const coverage_radius_km = parseFloat(formData.get('coverage_radius_km') as string)
  const logoFile = formData.get('logo') as File | null

  if (!name || !type || isNaN(base_lat) || isNaN(base_lng) || isNaN(coverage_radius_km)) {
    return { error: 'All fields are required.' }
  }

  let logo_url: string | null = null
  if (logoFile && logoFile.size > 0) {
    logo_url = await uploadImage('org-logos', logoFile)
  }

  const admin = createAdminClient()
  const { error } = await admin.from('organizations').insert({
    name,
    type,
    base_lat,
    base_lng,
    coverage_radius_km,
    logo_url,
    is_active: true,
    created_by: user.id,
  })

  if (error) {
    console.error('[createOrganizationAction]', error.message)
    return { error: error.message }
  }

  return {}
}

export async function createMemberAction(formData: FormData): Promise<{
  credentials?: { email: string; tempPassword: string }
  error?: string
}> {
  const full_name = (formData.get('full_name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim()
  const phone_number = (formData.get('phone_number') as string)?.trim()
  const role = formData.get('role') as 'team_leader' | 'responder'
  const org_id = formData.get('org_id') as string
  const tl_priority_str = formData.get('tl_priority') as string | null
  const avatarFile = formData.get('avatar') as File | null

  if (!full_name || !email || !phone_number || !role || !org_id) {
    return { error: 'All fields are required.' }
  }

  const admin = createAdminClient()

  if (role === 'responder') {
    const { count } = await admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', org_id)
      .eq('role', 'responder')
      .is('deleted_at', null)

    if ((count ?? 0) >= 10) {
      return { error: 'This organization already has 10 responders (maximum).' }
    }
  }

  let avatar_url: string | null = null
  if (role === 'responder' && avatarFile && avatarFile.size > 0) {
    avatar_url = await uploadImage('responder-avatars', avatarFile)
  }

  const tempPassword = generateTempPassword()

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name },
  })

  if (authError) {
    console.error('[createMemberAction] auth:', authError.message)
    return { error: authError.message }
  }

  const { error: profileError } = await admin.from('profiles').upsert({
    id: authData.user.id,
    full_name,
    phone_number,
    role,
    organization_id: org_id,
    tl_priority: role === 'team_leader' ? (tl_priority_str ? parseInt(tl_priority_str) : 1) : null,
    avatar_url,
  }, { onConflict: 'id' })

  if (profileError) {
    console.error('[createMemberAction] profile:', profileError.message)
    await admin.auth.admin.deleteUser(authData.user.id)
    return { error: profileError.message }
  }

  return { credentials: { email, tempPassword } }
}

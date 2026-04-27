'use server'

import { createAdminClient } from '../../lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function removeOrganization(orgId: string) {
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { error } = await admin
    .from('organizations')
    .update({ deleted_at: now, is_active: false })
    .eq('id', orgId)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/organizations')
}

export async function updateOrganization(data: {
  orgId: string
  name: string
  coverageRadiusKm: number
  baseLat: number
  baseLng: number
  barangay: string | null
  backupTlId: string | null
  primaryTlId: string | null
}) {
  const admin = createAdminClient()

  const { error: orgError } = await admin
    .from('organizations')
    .update({
      name: data.name,
      coverage_radius_km: data.coverageRadiusKm,
      base_lat: data.baseLat,
      base_lng: data.baseLng,
      barangay: data.barangay ? data.barangay.toLowerCase().trim() : null,
      backup_tl_id: data.backupTlId,
    })
    .eq('id', data.orgId)

  if (orgError) throw new Error(orgError.message)

  if (data.primaryTlId) {
    await admin
      .from('profiles')
      .update({ tl_priority: 1 })
      .eq('id', data.primaryTlId)
      .eq('organization_id', data.orgId)

    await admin
      .from('profiles')
      .update({ tl_priority: 2 })
      .eq('organization_id', data.orgId)
      .eq('role', 'team_leader')
      .neq('id', data.primaryTlId)
  }

  revalidatePath(`/admin/organizations/${data.orgId}`)
}

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

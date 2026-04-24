import { getCurrentUserWithProfile } from '../../lib/supabase/profile'
import { requireRole } from '../../lib/auth/guards'
import { createAdminClient } from '../../lib/supabase/admin'
import IncidentCenterClient from './IncidentCenterClient'

const ACTIVE_STATUSES = [
  'pending', 'assigned', 'en_route', 'arrived',
  'escalated', 'pending_citizen_confirmation',
]

export default async function IncidentCenterPage() {
  const current = await getCurrentUserWithProfile()
  requireRole(current, ['super_admin'])

  const supabase = createAdminClient()

  const [orgsResult, membersResult, incidentsResult] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, type, logo_url')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name'),

    supabase
      .from('profiles')
      .select('id, full_name, role, organization_id, tl_priority'),

    supabase
      .from('incidents')
      .select('organization_id, status')
      .in('status', ACTIVE_STATUSES),
  ])

  const orgs = orgsResult.data ?? []
  const members = membersResult.data ?? []
  const incidents = incidentsResult.data ?? []

  const orgData = orgs.map((org) => {
    const tl = members.find(
      (m) => m.organization_id === org.id && m.role === 'team_leader' && m.tl_priority === 1
    ) ?? null
    const activeCount = incidents.filter((i) => i.organization_id === org.id).length
    return { org, tlName: tl?.full_name ?? null, activeCount }
  })

  return <IncidentCenterClient orgData={orgData} />
}

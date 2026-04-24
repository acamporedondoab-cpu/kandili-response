import { getCurrentUserWithProfile } from '../../lib/supabase/profile'
import { requireRole } from '../../lib/auth/guards'
import { createAdminClient } from '../../lib/supabase/admin'
import IncidentHistoryClient from './IncidentHistoryClient'
import type { ResolvedIncident } from '../tl/components/IncidentQueueTable'

export default async function IncidentHistoryPage({
  searchParams,
}: {
  searchParams: { month?: string }
}) {
  const current = await getCurrentUserWithProfile()
  requireRole(current, ['team_leader', 'super_admin'])

  const orgId = current!.profile!.organization_id

  // Parse month param — default to current month
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() + 1

  if (searchParams.month) {
    const parts = searchParams.month.split('-')
    if (parts.length === 2) {
      const y = parseInt(parts[0], 10)
      const m = parseInt(parts[1], 10)
      if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
        year = y
        month = m
      }
    }
  }

  const monthStart = new Date(year, month - 1, 1).toISOString()
  const monthEnd = new Date(year, month, 1).toISOString()
  const currentMonthStr = `${year}-${String(month).padStart(2, '0')}`

  const supabase = createAdminClient()

  let incidentsQuery = supabase
    .from('incidents')
    .select(
      'id, incident_code, emergency_type, status, citizen_address, citizen_lat, citizen_lng, assigned_responder_id, notes, response_time_seconds, resolved_at, en_route_at, arrived_at, created_at, responder_assigned_at, tl_assigned_at, responder_profile:profiles!assigned_responder_id(full_name)'
    )
    .in('status', ['resolved', 'closed'])
    .gte('resolved_at', monthStart)
    .lt('resolved_at', monthEnd)
    .order('resolved_at', { ascending: false })

  let respondersQuery = supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'responder')

  if (orgId) {
    incidentsQuery = incidentsQuery.eq('organization_id', orgId)
    respondersQuery = respondersQuery.eq('organization_id', orgId)
  }

  const [{ data: incidentsData }, { data: respondersData }] = await Promise.all([
    incidentsQuery,
    respondersQuery,
  ])

  return (
    <IncidentHistoryClient
      incidents={(incidentsData ?? []) as unknown as ResolvedIncident[]}
      responders={(respondersData ?? []) as { id: string; full_name: string }[]}
      currentMonth={currentMonthStr}
      role={current!.profile!.role}
      fullName={current!.profile!.full_name ?? ''}
      email={current!.email ?? ''}
    />
  )
}

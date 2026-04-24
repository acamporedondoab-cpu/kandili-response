import { getCurrentUserWithProfile } from '../../lib/supabase/profile'
import { requireRole } from '../../lib/auth/guards'
import { createClient } from '../../lib/supabase/server'
import TLDashboard from './components/TLDashboard'
import type { TLIncident, TLResponder } from './components/IncidentQueueTable'

const ACTIVE_STATUSES = [
  'pending',
  'assigned',
  'en_route',
  'arrived',
  'escalated',
  'pending_citizen_confirmation',
]

export default async function TeamLeaderDashboardPage() {
  const current = await getCurrentUserWithProfile()
  requireRole(current, ['team_leader', 'super_admin'])

  const orgId = current!.profile!.organization_id!
  const tlName = current!.profile!.full_name || current!.email || 'Team Leader'
  const tlIsOnDuty = current!.profile!.is_on_duty ?? false

  const supabase = createClient()

  const tlTimeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Dashboard data fetch timed out. Please try again.')), 8000)
  )

  const [incidentsResult, respondersResult, orgResult, tlsResult] = await Promise.race([
    Promise.all([
      supabase
        .from('incidents')
        .select(
          'id, incident_code, emergency_type, status, citizen_address, citizen_lat, citizen_lng, created_at, assigned_responder_id'
        )
        .eq('organization_id', orgId)
        .in('status', ACTIVE_STATUSES)
        .order('created_at', { ascending: false }),

      supabase
        .from('profiles')
        .select('id, full_name, is_on_duty, last_known_lat, last_known_lng')
        .eq('organization_id', orgId)
        .eq('role', 'responder'),

      supabase
        .from('organizations')
        .select('name, logo_url')
        .eq('id', orgId)
        .single(),

      supabase
        .from('profiles')
        .select('id, is_on_duty')
        .eq('organization_id', orgId)
        .eq('role', 'team_leader')
        .is('deleted_at', null),
    ]),
    tlTimeout,
  ])

  const initialIncidents = (incidentsResult.data ?? []) as TLIncident[]
  const responders = (respondersResult.data ?? []) as TLResponder[]
  const orgName = orgResult.data?.name ?? 'Organization'
  const orgLogoUrl = orgResult.data?.logo_url ?? null
  const tlsOnDutyCount = (tlsResult.data ?? []).filter((t) => t.is_on_duty).length

  return (
    <TLDashboard
      orgId={orgId}
      orgName={orgName}
      tlName={tlName}
      tlIsOnDuty={tlIsOnDuty}
      tlsOnDutyCount={tlsOnDutyCount}
      initialIncidents={initialIncidents}
      responders={responders}
      logoUrl={orgLogoUrl}
    />
  )
}

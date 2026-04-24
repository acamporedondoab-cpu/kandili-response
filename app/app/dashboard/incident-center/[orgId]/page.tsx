import { getCurrentUserWithProfile } from '../../../lib/supabase/profile'
import { requireRole } from '../../../lib/auth/guards'
import { createAdminClient } from '../../../lib/supabase/admin'
import TLDashboard from '../../tl/components/TLDashboard'
import type { TLIncident, TLResponder } from '../../tl/components/IncidentQueueTable'

const ACTIVE_STATUSES = [
  'pending', 'assigned', 'en_route', 'arrived',
  'escalated', 'pending_citizen_confirmation',
]

export default async function OrgQueuePage({ params }: { params: { orgId: string } }) {
  const current = await getCurrentUserWithProfile()
  requireRole(current, ['super_admin'])

  const { orgId } = params
  const supabase = createAdminClient()

  const [incidentsResult, respondersResult, orgResult, tlsResult] = await Promise.all([
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
      .select('id, full_name, is_on_duty, tl_priority')
      .eq('organization_id', orgId)
      .eq('role', 'team_leader')
      .is('deleted_at', null)
      .order('tl_priority', { ascending: true }),
  ])

  const initialIncidents = (incidentsResult.data ?? []) as TLIncident[]
  const responders = (respondersResult.data ?? []) as TLResponder[]
  const orgName = orgResult.data?.name ?? 'Organization'
  const orgLogoUrl = orgResult.data?.logo_url ?? null

  const tls = tlsResult.data ?? []
  const onDutyTL = tls.find((t) => t.is_on_duty)
  const tlName = onDutyTL?.full_name ?? 'No TL On Duty'
  const tlsOnDutyCount = tls.filter((t) => t.is_on_duty).length

  return (
    <TLDashboard
      orgId={orgId}
      orgName={orgName}
      tlName={tlName}
      tlIsOnDuty={!!onDutyTL}
      tlsOnDutyCount={tlsOnDutyCount}
      readOnly
      initialIncidents={initialIncidents}
      responders={responders}
      logoUrl={orgLogoUrl}
      backHref="/dashboard/incident-center"
    />
  )
}

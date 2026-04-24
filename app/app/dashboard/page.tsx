import { redirect } from 'next/navigation'
import { getCurrentUserWithProfile } from '../lib/supabase/profile'
import { createAdminClient } from '../lib/supabase/admin'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const current = await getCurrentUserWithProfile()
  if (!current) redirect('/login')

  const { email, profile } = current
  const role = profile?.role ?? 'citizen'
  const fullName = profile?.full_name || email || 'User'
  const orgId = profile?.organization_id ?? null
  const isAdmin = role === 'super_admin'
  const filterByOrg = !isAdmin && orgId !== null

  const admin = createAdminClient()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  let activeQ = admin.from('incidents').select('*', { count: 'exact', head: true })
    .not('status', 'in', '(resolved,closed,pending_citizen_confirmation)')
  if (filterByOrg) activeQ = activeQ.eq('organization_id', orgId!)

  let enRouteQ = admin.from('incidents').select('*', { count: 'exact', head: true })
    .eq('status', 'en_route')
  if (filterByOrg) enRouteQ = enRouteQ.eq('organization_id', orgId!)

  let criticalQ = admin.from('incidents').select('*', { count: 'exact', head: true })
    .eq('priority_level', 'critical')
    .not('status', 'in', '(resolved,closed)')
  if (filterByOrg) criticalQ = criticalQ.eq('organization_id', orgId!)

  let highQ = admin.from('incidents').select('*', { count: 'exact', head: true })
    .eq('priority_level', 'high')
    .not('status', 'in', '(resolved,closed)')
  if (filterByOrg) highQ = highQ.eq('organization_id', orgId!)

  let avgQ = admin.from('incidents')
    .select('response_time_seconds')
    .not('response_time_seconds', 'is', null)
    .gte('resolved_at', todayStart.toISOString())
    .limit(50)
  if (filterByOrg) avgQ = avgQ.eq('organization_id', orgId!)

  let incQ = admin.from('incidents')
    .select('id, incident_code, emergency_type, status, priority_level, citizen_address, citizen_lat, citizen_lng, created_at, assigned_responder_id, organizations(name)')
    .order('created_at', { ascending: false })
    .limit(10)
  if (filterByOrg) incQ = incQ.eq('organization_id', orgId!)

  const [
    { count: activeIncidents },
    { count: enRouteCount },
    { count: criticalCount },
    { count: highCount },
    { data: avgData },
    { data: incidents },
  ] = await Promise.all([activeQ, enRouteQ, criticalQ, highQ, avgQ, incQ])

  const responderIds = Array.from(new Set((incidents ?? []).map(i => i.assigned_responder_id).filter(Boolean))) as string[]
  const { data: responders } = responderIds.length > 0
    ? await admin.from('profiles').select('id, full_name, last_known_lat, last_known_lng').in('id', responderIds)
    : { data: [] }

  const avgSeconds = avgData && avgData.length > 0
    ? Math.round(avgData.reduce((sum, r) => sum + (r.response_time_seconds ?? 0), 0) / avgData.length)
    : null

  return (
    <DashboardClient
      fullName={fullName}
      email={email ?? ''}
      role={role}
      isAdmin={isAdmin}
      activeIncidents={activeIncidents ?? 0}
      enRouteCount={enRouteCount ?? 0}
      criticalCount={criticalCount ?? 0}
      highCount={highCount ?? 0}
      avgResponseSeconds={avgSeconds}
      incidents={incidents ?? []}
      responders={responders ?? []}
    />
  )
}

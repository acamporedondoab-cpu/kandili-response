import { redirect } from 'next/navigation'
import { getCurrentUserWithProfile } from '../lib/supabase/profile'
import { createAdminClient } from '../lib/supabase/admin'
import DashboardClient, { type Incident } from './DashboardClient'

export default async function DashboardPage() {
  const current = await getCurrentUserWithProfile()
  if (!current) redirect('/login')

  const { email, profile } = current
  const role = profile?.role ?? 'citizen'
  const fullName = profile?.full_name || email || 'User'
  const orgId = profile?.organization_id ?? null
  const isAdmin = role === 'super_admin'

  const admin = createAdminClient()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  let avgQ = admin.from('incidents')
    .select('response_time_seconds')
    .not('response_time_seconds', 'is', null)
    .gte('resolved_at', todayStart.toISOString())
    .limit(50)
  if (!isAdmin && orgId) avgQ = avgQ.eq('organization_id', orgId)

  let incQ = admin.from('incidents')
    .select('id, incident_code, emergency_type, status, priority_level, citizen_address, citizen_lat, citizen_lng, created_at, assigned_responder_id, organizations!organization_id(name), responder_profile:profiles!assigned_responder_id(id, full_name, last_known_lat, last_known_lng)')
    .order('created_at', { ascending: false })
    .limit(50)
  if (!isAdmin && orgId) incQ = incQ.eq('organization_id', orgId)

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Dashboard data fetch timed out. Please try again.')), 8000)
  )

  const [
    { data: avgData, error: avgError },
    { data: incidents, error: incError },
  ] = await Promise.race([
    Promise.all([avgQ, incQ]),
    timeout,
  ])

  if (avgError) console.error('[DashboardPage] avgQ failed:', avgError.message)
  if (incError) console.error('[DashboardPage] incQ failed:', incError.message)

  const avgSeconds = avgData && avgData.length > 0
    ? Math.round(avgData.reduce((sum, r) => sum + (r.response_time_seconds ?? 0), 0) / avgData.length)
    : null

  return (
    <DashboardClient
      fullName={fullName}
      email={email ?? ''}
      role={role}
      isAdmin={isAdmin}
      avgResponseSeconds={avgSeconds}
      incidents={(incidents ?? []) as unknown as Incident[]}
    />
  )
}

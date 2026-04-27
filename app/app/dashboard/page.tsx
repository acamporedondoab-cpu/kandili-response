import { redirect } from 'next/navigation'
import { getCurrentUserWithProfile } from '../lib/supabase/profile'
import { createAdminClient } from '../lib/supabase/admin'
import DashboardClient, { type Incident } from './DashboardClient'

export default async function DashboardPage() {
  const current = await getCurrentUserWithProfile()
  if (!current) redirect('/login')

  const { email, profile } = current
  const role = profile?.role ?? 'citizen'

  if (role === 'responder' || role === 'citizen') {
    redirect(`/login?error=${encodeURIComponent('Responders and citizens use the Kandili Response mobile app.')}`)
  }
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
    .limit(10)
  if (!isAdmin && orgId) incQ = incQ.eq('organization_id', orgId)

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  let resolvedQ = admin.from('incidents')
    .select('*', { count: 'exact', head: true })
    .in('status', ['resolved', 'closed'])
    .gte('created_at', todayStart.toISOString())
  if (!isAdmin && orgId) resolvedQ = resolvedQ.eq('organization_id', orgId)

  let timelineQ = admin.from('incidents')
    .select('created_at, emergency_type')
    .gte('created_at', twentyFourHoursAgo.toISOString())
  if (!isAdmin && orgId) timelineQ = timelineQ.eq('organization_id', orgId)

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Dashboard data fetch timed out. Please try again.')), 8000)
  )

  const [
    { data: avgData, error: avgError },
    { data: incidents, error: incError },
    { count: resolvedCount },
    { data: timelineRaw },
  ] = await Promise.race([
    Promise.all([avgQ, incQ, resolvedQ, timelineQ]),
    timeout,
  ])

  if (avgError) console.error('[DashboardPage] avgQ failed:', avgError.message)
  if (incError) console.error('[DashboardPage] incQ failed:', incError.message)

  const avgSeconds = avgData && avgData.length > 0
    ? Math.round(avgData.reduce((sum, r) => sum + (r.response_time_seconds ?? 0), 0) / avgData.length)
    : null

  // Build 24-hour activity buckets (index 0 = oldest, 23 = current hour)
  const now = Date.now()
  const hourBuckets = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }))
  for (const row of timelineRaw ?? []) {
    const ageMs = now - new Date(row.created_at).getTime()
    const bucketIndex = 23 - Math.floor(ageMs / 3600000)
    if (bucketIndex >= 0 && bucketIndex < 24) hourBuckets[bucketIndex].count++
  }

  // Build type counts from last 24h incidents
  const typeMap: Record<string, number> = {}
  for (const row of timelineRaw ?? []) {
    const t = row.emergency_type ?? 'unknown'
    typeMap[t] = (typeMap[t] ?? 0) + 1
  }
  const typeCounts = Object.entries(typeMap)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)

  return (
    <DashboardClient
      fullName={fullName}
      email={email ?? ''}
      role={role}
      isAdmin={isAdmin}
      avgResponseSeconds={avgSeconds}
      incidents={(incidents ?? []) as unknown as Incident[]}
      resolvedToday={resolvedCount ?? 0}
      timeline={hourBuckets}
      typeCounts={typeCounts}
    />
  )
}

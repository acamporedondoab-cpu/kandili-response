import { getCurrentUserWithProfile } from '../../lib/supabase/profile'
import { requireRole } from '../../lib/auth/guards'
import { createAdminClient } from '../../lib/supabase/admin'
import AnalyticsClient from './AnalyticsClient'

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: { end?: string; view?: string }
}) {
  const current = await getCurrentUserWithProfile()
  requireRole(current, ['team_leader', 'super_admin'])

  const orgId = current!.profile!.organization_id
  const isAdmin = current!.profile!.role === 'super_admin'

  const view = (searchParams.view === 'month' ? 'month' : 'week') as 'week' | 'month'

  const now = new Date()
  let startDay: Date
  let endDay: Date

  if (view === 'week') {
    // Default end = yesterday (today is incomplete)
    const defaultEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    endDay = defaultEnd
    if (searchParams.end) {
      const p = new Date(searchParams.end + 'T00:00:00')
      if (!isNaN(p.getTime())) endDay = new Date(p.getFullYear(), p.getMonth(), p.getDate())
    }
    // 7-day window: endDay (inclusive) back 6 days
    startDay = new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate() - 6)
  } else {
    // Default end = last day of previous month
    const defaultEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    endDay = defaultEnd
    if (searchParams.end) {
      const p = new Date(searchParams.end + 'T00:00:00')
      if (!isNaN(p.getTime())) {
        // Normalize to last day of the month containing that date
        endDay = new Date(p.getFullYear(), p.getMonth() + 1, 0)
      }
    }
    startDay = new Date(endDay.getFullYear(), endDay.getMonth(), 1)
  }

  const rangeStart = startDay.toISOString()
  const rangeEnd = new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate() + 1).toISOString()
  const endDateStr = toDateStr(endDay)

  const supabase = createAdminClient()

  let q = supabase
    .from('incidents')
    .select(
      'id, emergency_type, response_time_seconds, resolved_at, created_at, assigned_responder_id, responder_profile:profiles!assigned_responder_id(full_name), organizations!organization_id(name)'
    )
    .in('status', ['resolved', 'closed'])
    .gte('resolved_at', rangeStart)
    .lt('resolved_at', rangeEnd)
    .order('resolved_at', { ascending: true })

  if (!isAdmin && orgId) {
    q = q.eq('organization_id', orgId)
  }

  const { data: raw } = await q

  type RawIncident = {
    id: string
    emergency_type: string
    response_time_seconds: number | null
    resolved_at: string
    created_at: string
    assigned_responder_id: string | null
    responder_profile: { full_name: string } | { full_name: string }[] | null
    organizations: { name: string } | { name: string }[] | null
  }

  const allResolved = (raw ?? []) as RawIncident[]
  const totalResolved = allResolved.length

  // Only incidents with recorded response time feed the analytics
  const incidents = allResolved.filter(
    (i): i is RawIncident & { response_time_seconds: number } =>
      i.response_time_seconds !== null
  )
  const totalWithTime = incidents.length

  // ── Helpers ──
  function getName(
    obj: { full_name: string } | { full_name: string }[] | null
  ): string | null {
    if (!obj) return null
    if (Array.isArray(obj)) return obj[0]?.full_name ?? null
    return obj.full_name
  }

  function getOrgName(
    obj: { name: string } | { name: string }[] | null
  ): string | null {
    if (!obj) return null
    if (Array.isArray(obj)) return obj[0]?.name ?? null
    return obj.name
  }

  // ── Overall stats ──
  const allTimes = incidents.map((i) => i.response_time_seconds)
  const avgSeconds =
    totalWithTime > 0
      ? Math.round(allTimes.reduce((s, t) => s + t, 0) / totalWithTime)
      : null
  const fastestSeconds = totalWithTime > 0 ? Math.min(...allTimes) : null
  const slowestSeconds = totalWithTime > 0 ? Math.max(...allTimes) : null

  // ── By day — build full range array, fill 0 for missing days ──
  const byDayMap: Record<string, { total: number; count: number }> = {}
  for (const inc of incidents) {
    const day = inc.resolved_at.slice(0, 10)
    byDayMap[day] = byDayMap[day] ?? { total: 0, count: 0 }
    byDayMap[day].total += inc.response_time_seconds
    byDayMap[day].count++
  }

  const daysInRange = view === 'week' ? 7 : endDay.getDate()
  const dailyAvg = Array.from({ length: daysInRange }, (_, i) => {
    const d = new Date(startDay.getFullYear(), startDay.getMonth(), startDay.getDate() + i)
    const day = toDateStr(d)
    const entry = byDayMap[day]
    return {
      day,
      avgSeconds: entry ? Math.round(entry.total / entry.count) : 0,
      count: entry?.count ?? 0,
    }
  })

  // ── By type ──
  const byTypeMap: Record<string, { total: number; count: number }> = {}
  for (const inc of incidents) {
    const t = inc.emergency_type ?? 'unknown'
    byTypeMap[t] = byTypeMap[t] ?? { total: 0, count: 0 }
    byTypeMap[t].total += inc.response_time_seconds
    byTypeMap[t].count++
  }
  const typeAvg = Object.entries(byTypeMap)
    .map(([type, { total, count }]) => ({
      type,
      avgSeconds: Math.round(total / count),
      count,
    }))
    .sort((a, b) => a.avgSeconds - b.avgSeconds)

  // ── Responder leaderboard ──
  const byResponderMap: Record<
    string,
    { name: string; total: number; count: number }
  > = {}
  for (const inc of incidents) {
    if (!inc.assigned_responder_id) continue
    const name = getName(inc.responder_profile) ?? 'Unknown'
    const key = inc.assigned_responder_id
    byResponderMap[key] = byResponderMap[key] ?? { name, total: 0, count: 0 }
    byResponderMap[key].total += inc.response_time_seconds
    byResponderMap[key].count++
  }
  const leaderboard = Object.values(byResponderMap)
    .map((r) => ({
      name: r.name,
      avgSeconds: Math.round(r.total / r.count),
      count: r.count,
    }))
    .sort((a, b) => a.avgSeconds - b.avgSeconds)
    .slice(0, 10)

  // ── By org (admin only) ──
  const byOrgMap: Record<string, { total: number; count: number }> = {}
  if (isAdmin) {
    for (const inc of incidents) {
      const org = getOrgName(inc.organizations) ?? 'Unknown'
      byOrgMap[org] = byOrgMap[org] ?? { total: 0, count: 0 }
      byOrgMap[org].total += inc.response_time_seconds
      byOrgMap[org].count++
    }
  }
  const orgAvg = Object.entries(byOrgMap)
    .map(([org, { total, count }]) => ({
      org,
      avgSeconds: Math.round(total / count),
      count,
    }))
    .sort((a, b) => a.avgSeconds - b.avgSeconds)

  return (
    <AnalyticsClient
      view={view}
      endDate={endDateStr}
      totalResolved={totalResolved}
      totalWithTime={totalWithTime}
      avgSeconds={avgSeconds}
      fastestSeconds={fastestSeconds}
      slowestSeconds={slowestSeconds}
      dailyAvg={dailyAvg}
      typeAvg={typeAvg}
      leaderboard={leaderboard}
      orgAvg={orgAvg}
      isAdmin={isAdmin}
      role={current!.profile!.role}
      fullName={current!.profile!.full_name ?? ''}
      email={current!.email ?? ''}
    />
  )
}

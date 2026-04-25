import { createAdminClient } from '../lib/supabase/admin'
import StatCard from './StatCard'

const STATUS_COLOR: Record<string, string> = {
  pending: '#F59E0B',
  escalated: '#EF4444',
  assigned: '#3B82F6',
  accepted: '#6366F1',
  en_route: '#F97316',
  arrived: '#10B981',
  resolved: '#6B7280',
  closed: '#4B5563',
  pending_citizen_confirmation: '#A78BFA',
}

const TYPE_LABEL: Record<string, string> = {
  crime: 'Crime',
  medical: 'Medical',
}


type RecentIncident = {
  id: string
  incident_code: string
  emergency_type: string
  status: string
  citizen_address: string | null
  citizen_lat: number | null
  citizen_lng: number | null
  created_at: string
  organizations: { name: string } | null
}

export default async function AdminPage() {
  const admin = createAdminClient()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [
    { count: totalOrgs },
    { count: totalMembers },
    { count: activeIncidents },
    { count: resolvedToday },
    { data: recentIncidentsRaw },
    { data: avgRaw },
  ] = await Promise.all([
    admin.from('organizations').select('*', { count: 'exact', head: true }).eq('is_active', true),
    admin.from('profiles').select('*', { count: 'exact', head: true }).neq('role', 'citizen').is('deleted_at', null),
    admin.from('incidents').select('*', { count: 'exact', head: true }).not('status', 'in', '(resolved,closed)'),
    admin
      .from('incidents')
      .select('*', { count: 'exact', head: true })
      .in('status', ['resolved', 'closed'])
      .gte('updated_at', todayStart.toISOString()),
    admin
      .from('incidents')
      .select('id, incident_code, emergency_type, status, citizen_address, citizen_lat, citizen_lng, created_at, organizations!organization_id(name)')
      .order('created_at', { ascending: false })
      .limit(10),
    admin
      .from('incidents')
      .select('created_at, arrived_at')
      .in('status', ['resolved', 'closed'])
      .gte('resolved_at', todayStart.toISOString())
      .not('arrived_at', 'is', null),
  ])

  const recentIncidents = (recentIncidentsRaw ?? []) as unknown as RecentIncident[]

  const avgRows = (avgRaw ?? []) as { created_at: string; arrived_at: string }[]
  let avgResponseLabel = '—'
  if (avgRows.length > 0) {
    const avgMs = avgRows.reduce(
      (sum, r) => sum + (new Date(r.arrived_at).getTime() - new Date(r.created_at).getTime()),
      0
    ) / avgRows.length
    const mins = Math.round(avgMs / 60000)
    avgResponseLabel = mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`
  }

  return (
    <div style={{ padding: '36px 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'white', marginBottom: 4 }}>
          Overview
        </h1>
        <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.40)' }}>
          Platform-wide stats and recent activity
        </p>
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 16,
          marginBottom: 36,
        }}
      >
        <StatCard label="Organizations" value={totalOrgs ?? 0} color="#22D3EE" bg="rgba(34,211,238,0.04)" border="rgba(34,211,238,0.18)" sub="Active on platform" />
        <StatCard label="Total Members" value={totalMembers ?? 0} color="#34D399" bg="rgba(52,211,153,0.04)" border="rgba(52,211,153,0.18)" sub="Across all orgs" />
        <StatCard label="Active Incidents" value={activeIncidents ?? 0} color="#F87171" bg="rgba(248,113,113,0.04)" border="rgba(248,113,113,0.18)" sub="Pending or in progress" />
        <StatCard label="Resolved Today" value={resolvedToday ?? 0} color="#A78BFA" bg="rgba(167,139,250,0.04)" border="rgba(167,139,250,0.18)" sub="Since midnight" />
        <StatCard label="Avg Response Time" value={avgResponseLabel} color="#FBBF24" bg="rgba(251,191,36,0.04)" border="rgba(251,191,36,0.18)" sub="Report → on scene" />
      </div>

      {/* Recent Incidents */}
      <div
        style={{
          background: 'rgba(10,15,30,0.75)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          overflow: 'hidden',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>
            Recent Incidents
          </h2>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
            Last 10 incidents across all organizations
          </p>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['Code', 'Type', 'Location', 'Status', 'Organization', 'Created'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '12px 24px',
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    color: 'rgba(255,255,255,0.35)',
                    textTransform: 'uppercase',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentIncidents.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '32px 24px', textAlign: 'center', color: 'rgba(255,255,255,0.30)', fontSize: 13 }}>
                  No incidents yet
                </td>
              </tr>
            )}
            {recentIncidents.map((inc, i) => {
              const org = inc.organizations
              return (
                <tr
                  key={inc.id}
                  style={{
                    borderBottom: i < recentIncidents.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}
                >
                  <td style={{ padding: '13px 24px', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.80)', fontFamily: 'monospace' }}>
                    {inc.incident_code}
                  </td>
                  <td style={{ padding: '13px 24px', fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
                    {TYPE_LABEL[inc.emergency_type] ?? inc.emergency_type}
                  </td>
                  <td style={{ padding: '13px 24px', fontSize: 12, color: 'rgba(255,255,255,0.50)', maxWidth: 200 }}>
                    <span title={inc.citizen_address ?? ''} style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {inc.citizen_address ?? (inc.citizen_lat && inc.citizen_lng ? `${Number(inc.citizen_lat).toFixed(4)}, ${Number(inc.citizen_lng).toFixed(4)}` : '—')}
                    </span>
                  </td>
                  <td style={{ padding: '13px 24px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontSize: 11.5,
                        fontWeight: 600,
                        background: `${STATUS_COLOR[inc.status] ?? '#6B7280'}18`,
                        color: STATUS_COLOR[inc.status] ?? '#6B7280',
                        border: `1px solid ${STATUS_COLOR[inc.status] ?? '#6B7280'}30`,
                      }}
                    >
                      {inc.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '13px 24px', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
                    {org?.name ?? '—'}
                  </td>
                  <td style={{ padding: '13px 24px', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                    {new Date(inc.created_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

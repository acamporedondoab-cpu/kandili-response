import { getCurrentUserWithProfile } from '../../../lib/supabase/profile'
import { requireRole } from '../../../lib/auth/guards'
import { getOrgIncidents } from '../../../lib/supabase/incidents'

export default async function TLIncidentsPage() {
  const current = await getCurrentUserWithProfile()

  requireRole(current, ['team_leader', 'super_admin'])

  if (!current?.profile?.organization_id) {
    return (
      <main style={{ maxWidth: 700, margin: '80px auto', padding: '0 16px' }}>
        <h1>Incidents</h1>
        <p>No organization assigned.</p>
      </main>
    )
  }

  const incidents = await getOrgIncidents(current.profile.organization_id)

  return (
    <main style={{ maxWidth: 900, margin: '40px auto', padding: '0 16px' }}>
      <h1>Incident Queue</h1>

      <p>
        Organization ID: <code>{current.profile.organization_id}</code>
      </p>

      <p>
        Total incidents: <strong>{incidents.length}</strong>
      </p>

      {incidents.length === 0 ? (
        <p>No incidents yet.</p>
      ) : (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginTop: 16,
          }}
        >
          <thead>
            <tr>
              <th>Code</th>
              <th>Type</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Created</th>
            </tr>
          </thead>

          <tbody>
            {incidents.map((incident) => (
              <tr key={incident.id}>
                <td>
                  <a href={`/dashboard/tl/incidents/${incident.id}`}>
                    {incident.incident_code}
                  </a>
                </td>
                <td>{incident.emergency_type}</td>
                <td>{incident.status}</td>
                <td>{incident.priority_level}</td>
                <td>
                  {new Date(
                    incident.created_at
                  ).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ marginTop: 24 }}>
        <a href="/dashboard/tl">← Back to TL Dashboard</a>
      </p>
    </main>
  )
}
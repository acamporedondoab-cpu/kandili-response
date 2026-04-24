import { getCurrentUserWithProfile } from '../../lib/supabase/profile'
import { requireRole } from '../../lib/auth/guards'
import { getResponderActiveIncident } from '../../lib/supabase/incidents'

export default async function ResponderDashboardPage() {
  const current = await getCurrentUserWithProfile()
  requireRole(current, ['responder', 'super_admin'])

  const incident = await getResponderActiveIncident(current!.userId)

  return (
    <main style={{ maxWidth: 700, margin: '60px auto', padding: '0 16px' }}>
      <h1>Responder Dashboard</h1>

      {!incident ? (
        <p style={{ color: '#666', marginTop: 24 }}>
          No active incident assigned. Stand by.
        </p>
      ) : (
        <div
          style={{
            border: '2px solid #d00',
            borderRadius: 8,
            padding: 24,
            marginTop: 24,
          }}
        >
          <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: 18 }}>
            Active Incident
          </p>
          <p style={{ margin: '0 0 4px' }}>
            Code: <strong>{incident.incident_code}</strong>
          </p>
          <p style={{ margin: '0 0 4px' }}>
            Type: <strong>{incident.emergency_type.toUpperCase()}</strong>
          </p>
          <p style={{ margin: '0 0 4px' }}>
            Status: <strong>{incident.status}</strong>
          </p>
          <p style={{ margin: '0 0 16px' }}>
            Location: <strong>{incident.citizen_lat}, {incident.citizen_lng}</strong>
          </p>
          <a
            href={`/dashboard/responder/incidents/${incident.id}`}
            style={{
              display: 'inline-block',
              padding: '10px 24px',
              background: '#d00',
              color: '#fff',
              borderRadius: 4,
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Open Incident →
          </a>
        </div>
      )}

      <p style={{ marginTop: 32 }}>
        <a href="/dashboard">← Back to Dashboard</a>
      </p>
    </main>
  )
}

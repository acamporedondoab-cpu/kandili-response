import { notFound } from 'next/navigation'
import { getCurrentUserWithProfile } from '../../../../lib/supabase/profile'
import { requireRole } from '../../../../lib/auth/guards'
import { getIncidentById } from '../../../../lib/supabase/incidents'
import { updateIncidentStatus } from '../../../../lib/supabase/incident-actions'

const STATUS_LABELS: Record<string, string> = {
  assigned: 'Accept Incident',
  accepted: 'Mark En Route',
  en_route: 'Mark Arrived',
  arrived: 'Mark Resolved',
}

export default async function ResponderIncidentDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const current = await getCurrentUserWithProfile()
  requireRole(current, ['responder', 'super_admin'])

  const incident = await getIncidentById(params.id)
  if (!incident) notFound()

  if (incident.assigned_responder_id !== current!.userId) {
    notFound()
  }

  const nextActionLabel = STATUS_LABELS[incident.status]
  const isActive = Boolean(nextActionLabel)

  return (
    <main style={{ maxWidth: 700, margin: '60px auto', padding: '0 16px' }}>
      <h1>Incident — {incident.incident_code}</h1>

      <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 32 }}>
        <tbody>
          {[
            ['Code', incident.incident_code],
            ['Type', incident.emergency_type.toUpperCase()],
            ['Status', incident.status],
            ['Priority', incident.priority_level],
            ['Location', `${incident.citizen_lat}, ${incident.citizen_lng}`],
            ['Address', incident.citizen_address ?? '—'],
            ['Notes', incident.notes ?? '—'],
            ['Created', new Date(incident.created_at).toLocaleString()],
          ].map(([label, value]) => (
            <tr key={label as string}>
              <td style={{ padding: '6px 12px 6px 0', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {label}
              </td>
              <td style={{ padding: '6px 0' }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {isActive ? (
        <form action={updateIncidentStatus.bind(null, incident.id, incident.status)}>
          <button
            type="submit"
            style={{
              padding: '12px 32px',
              background: '#d00',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            {nextActionLabel}
          </button>
        </form>
      ) : (
        <p style={{ color: '#666' }}>
          Incident is <strong>{incident.status}</strong> — no further action required.
        </p>
      )}

      <p style={{ marginTop: 32 }}>
        <a href="/dashboard/responder">← Back to Responder Dashboard</a>
      </p>
    </main>
  )
}

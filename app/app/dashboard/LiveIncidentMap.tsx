'use client'

import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps'
import type { Incident } from './DashboardClient'

const MAP_CENTER = { lat: 6.0757, lng: 125.1341 }
const MAP_ZOOM = 14

const INACTIVE_STATUSES = ['resolved', 'closed', 'pending_citizen_confirmation']

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#EF4444',
  high:     '#F97316',
  medium:   '#F59E0B',
  low:      '#10B981',
}

const DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0d1117' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0d1117' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#374151' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#1f2937' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#1e2d40' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#243447' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#4b5563' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#060d18' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#374151' }] },
]

type Props = {
  incidents: Incident[]
  onPinClick: (incident: Incident) => void
  darkMode?: boolean
}

function DotPin({ color, size = 18, pulse = false }: { color: string; size?: number; pulse?: boolean }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, cursor: 'pointer' }}>
      {pulse && (
        <div style={{
          position: 'absolute', inset: -4, borderRadius: '50%',
          background: color, opacity: 0.3,
          animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
        }} />
      )}
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: color,
        border: '2.5px solid rgba(255,255,255,0.85)',
        boxShadow: `0 0 8px ${color}99`,
      }} />
    </div>
  )
}

export default function LiveIncidentMap({ incidents, onPinClick, darkMode = false }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

  const activeIncidents = incidents.filter(
    (inc) => !INACTIVE_STATUSES.includes(inc.status) && inc.citizen_lat && inc.citizen_lng
  )

  const responderPins: { id: string; lat: number; lng: number; name: string }[] = []
  const seenResponders = new Set<string>()
  for (const inc of activeIncidents) {
    const rp = inc.responder_profile
    if (rp && rp.id && rp.last_known_lat && rp.last_known_lng && !seenResponders.has(rp.id)) {
      seenResponders.add(rp.id)
      responderPins.push({ id: rp.id, lat: rp.last_known_lat, lng: rp.last_known_lng, name: rp.full_name })
    }
  }

  return (
    <APIProvider apiKey={apiKey}>
      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <Map
          defaultCenter={MAP_CENTER}
          defaultZoom={MAP_ZOOM}
          gestureHandling="greedy"
          styles={darkMode ? DARK_STYLE : undefined}
          style={{ width: '100%', height: '100%' }}
        >
          {activeIncidents.map((inc) => {
            const color = PRIORITY_COLOR[inc.priority_level] ?? '#10B981'
            const isPriority = inc.priority_level === 'critical' || inc.priority_level === 'high'
            return (
              <AdvancedMarker
                key={inc.id}
                position={{ lat: inc.citizen_lat, lng: inc.citizen_lng }}
                title={`${inc.incident_code} — ${inc.emergency_type} (${inc.priority_level})`}
                onClick={() => onPinClick(inc)}
              >
                <DotPin color={color} size={18} pulse={isPriority} />
              </AdvancedMarker>
            )
          })}

          {responderPins.map((r) => (
            <AdvancedMarker
              key={`responder-${r.id}`}
              position={{ lat: r.lat, lng: r.lng }}
              title={`Responder: ${r.name}`}
            >
              <DotPin color="#3B82F6" size={14} />
            </AdvancedMarker>
          ))}
        </Map>

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 12, left: 12,
          background: darkMode ? 'rgba(10,15,30,0.92)' : 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(10px)',
          border: darkMode ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.12)',
          borderRadius: 9, padding: '8px 12px',
          display: 'flex', flexDirection: 'column', gap: 5,
          pointerEvents: 'none',
        }}>
          {[
            { color: '#EF4444', label: 'Critical' },
            { color: '#F97316', label: 'High' },
            { color: '#F59E0B', label: 'Medium' },
            { color: '#10B981', label: 'Low' },
            { color: '#3B82F6', label: 'Responder' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{
                fontSize: 10.5, fontWeight: 500,
                color: darkMode ? 'rgba(255,255,255,0.60)' : 'rgba(0,0,0,0.55)',
              }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {activeIncidents.length > 0 && (
          <div style={{
            position: 'absolute', top: 12, right: 12,
            background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.40)',
            borderRadius: 8, padding: '4px 10px',
            fontSize: 11.5, fontWeight: 700, color: '#F87171',
            pointerEvents: 'none',
          }}>
            {activeIncidents.length} active
          </div>
        )}
      </div>
    </APIProvider>
  )
}

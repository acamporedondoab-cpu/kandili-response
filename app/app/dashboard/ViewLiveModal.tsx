'use client'

import { useEffect, useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { createClient } from '../lib/supabase/client'
import { X, MapPin, User, Navigation } from 'lucide-react'
import 'leaflet/dist/leaflet.css'

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length === 0) return
    if (positions.length === 1) {
      map.setView(positions[0], 15)
    } else {
      map.fitBounds(positions, { padding: [60, 60] })
    }
  }, [map, positions])
  return null
}

type Incident = {
  id: string
  incident_code: string
  emergency_type: string
  status: string
  priority_level: string
  citizen_address: string | null
  citizen_lat: number
  citizen_lng: number
}

type Responder = {
  id: string
  full_name: string
  last_known_lat: number | null
  last_known_lng: number | null
}

export default function ViewLiveModal({
  incident,
  responder,
  onClose,
}: {
  incident: Incident
  responder: Responder | null
  onClose: () => void
}) {
  const supabase = createClient()
  const [mounted, setMounted] = useState(false)
  const [responderPos, setResponderPos] = useState<{ lat: number; lng: number } | null>(
    responder?.last_known_lat && responder?.last_known_lng
      ? { lat: Number(responder.last_known_lat), lng: Number(responder.last_known_lng) }
      : null
  )

  const incidentIcon = useMemo(() => L.divIcon({
    html: `<div style="width:14px;height:14px;background:#EF4444;border-radius:50%;border:2.5px solid white;box-shadow:0 0 10px #EF4444,0 0 20px #EF444440"></div>`,
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  }), [])

  const responderIcon = useMemo(() => L.divIcon({
    html: `<div style="width:14px;height:14px;background:#3B82F6;border-radius:50%;border:2.5px solid white;box-shadow:0 0 10px #3B82F6,0 0 20px #3B82F640"></div>`,
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  }), [])

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!responder?.id) return
    const channel = supabase
      .channel(`live-responder-${responder.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${responder.id}`,
      }, (payload) => {
        const { last_known_lat, last_known_lng } = payload.new as { last_known_lat: number | null; last_known_lng: number | null }
        if (last_known_lat && last_known_lng) {
          setResponderPos({ lat: Number(last_known_lat), lng: Number(last_known_lng) })
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [responder?.id, supabase])

  const incidentPos: [number, number] = [Number(incident.citizen_lat), Number(incident.citizen_lng)]
  const positions: [number, number][] = [incidentPos]
  if (responderPos) positions.push([responderPos.lat, responderPos.lng])

  const haversineKm = (a: [number, number], b: [number, number]) => {
    const R = 6371, dLat = ((b[0] - a[0]) * Math.PI) / 180, dLng = ((b[1] - a[1]) * Math.PI) / 180
    const x = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
  }

  const distKm = responderPos
    ? haversineKm(incidentPos, [responderPos.lat, responderPos.lng])
    : null
  const etaMin = distKm ? Math.ceil((distKm / 40) * 60) : null

  if (!mounted) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 780,
        background: '#0A0F1E', border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
      }}>
        {/* Modal header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>
              Live View —{' '}
              <span style={{ fontFamily: 'monospace', color: '#00E5FF' }}>{incident.incident_code}</span>
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)', marginTop: 2 }}>
              Real-time responder tracking
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
              cursor: 'pointer', color: 'rgba(255,255,255,0.60)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Info bar */}
        <div style={{
          display: 'flex', gap: 0,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <InfoCell icon={<MapPin size={13} />} label="Incident Location" value={incident.citizen_address ?? `${Number(incident.citizen_lat).toFixed(4)}, ${Number(incident.citizen_lng).toFixed(4)}`} color="#EF4444" />
          <InfoCell icon={<User size={13} />} label="Assigned Responder" value={responder?.full_name ?? 'Unassigned'} color="#3B82F6" border />
          <InfoCell icon={<Navigation size={13} />} label="Distance / ETA" value={distKm !== null ? `${distKm.toFixed(1)} km · ${etaMin} min` : 'No GPS data'} color="#10B981" border />
        </div>

        {/* Map */}
        <div style={{ height: 420, position: 'relative' }}>
          <MapContainer
            center={incidentPos}
            zoom={14}
            style={{ height: '100%', width: '100%', background: '#070B18' }}
            zoomControl={true}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            <FitBounds positions={positions} />
            <Marker position={incidentPos} icon={incidentIcon}>
              <Popup>
                <div style={{ fontSize: 12 }}>
                  <strong>{incident.incident_code}</strong><br />
                  {incident.emergency_type} · {incident.status}
                </div>
              </Popup>
            </Marker>
            {responderPos && (
              <Marker position={[responderPos.lat, responderPos.lng]} icon={responderIcon}>
                <Popup>
                  <div style={{ fontSize: 12 }}>
                    <strong>{responder?.full_name ?? 'Responder'}</strong><br />
                    Live location
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>

          {/* Legend */}
          <div style={{
            position: 'absolute', bottom: 14, left: 14, zIndex: 999,
            background: 'rgba(7,11,24,0.90)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10, padding: '8px 14px', backdropFilter: 'blur(12px)',
            display: 'flex', gap: 14,
          }}>
            <LegendDot color="#EF4444" label="Incident" />
            <LegendDot color="#3B82F6" label="Responder (live)" />
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoCell({ icon, label, value, color, border }: { icon: React.ReactNode; label: string; value: string; color: string; border?: boolean }) {
  return (
    <div style={{
      flex: 1, padding: '12px 18px',
      borderLeft: border ? '1px solid rgba(255,255,255,0.07)' : 'none',
      display: 'flex', gap: 10, alignItems: 'flex-start',
    }}>
      <div style={{ color, marginTop: 1, flexShrink: 0 }}>{icon}</div>
      <div>
        <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{value}</p>
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{label}</span>
    </div>
  )
}

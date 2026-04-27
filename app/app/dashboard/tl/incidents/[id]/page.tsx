'use client'

import { useState, useTransition, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, MapPin, AlertTriangle, User, Shield, Video, X, ChevronDown } from 'lucide-react'
import { acknowledgeTLAction, assignResponderAction } from '../../../../lib/supabase/incident-actions'
import { createClient } from '../../../../lib/supabase/client'

type IncidentMedia = {
  id: string
  media_url: string
  media_type: 'photo' | 'video'
  description: string | null
}

function statusColor(status: string) {
  switch (status) {
    case 'pending': return { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.30)', text: '#FCD34D' }
    case 'escalated': return { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.30)', text: '#FCA5A5' }
    case 'assigned': return { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.30)', text: '#93C5FD' }
    case 'en_route': return { bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.30)', text: '#C4B5FD' }
    case 'arrived': return { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.30)', text: '#6EE7B7' }
    case 'resolved': return { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.30)', text: '#34D399' }
    default: return { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', text: 'rgba(255,255,255,0.55)' }
  }
}

function priorityColor(p: string) {
  if (p === 'critical') return '#FCA5A5'
  if (p === 'high') return '#FCD34D'
  return 'rgba(255,255,255,0.55)'
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ width: 180, flexShrink: 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)' }}>
        {label}
      </span>
      <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.80)' }}>{value}</span>
    </div>
  )
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
  notes: string | null
  created_at: string
  tl_notified_at: string | null
  tl_acknowledged_at: string | null
  acknowledged_by_tl_id: string | null
  assigned_tl_id: string | null
  assigned_responder_id: string | null
  escalated_at: string | null
  transfer_reason: string | null
  citizen_id: string | null
}

type Responder = {
  id: string
  full_name: string
  is_on_duty: boolean
}

const ASSIGN_BLOCKED = ['en_route', 'arrived', 'pending_citizen_confirmation', 'resolved', 'closed']

export default function TLIncidentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [incident, setIncident] = useState<Incident | null>(null)
  const [ackByName, setAckByName] = useState<string | null>(null)
  const [citizenName, setCitizenName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [ackPending, startAck] = useTransition()
  const [ackMsg, setAckMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [media, setMedia] = useState<IncidentMedia[]>([])
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [responders, setResponders] = useState<Responder[]>([])
  const [selectedResponderId, setSelectedResponderId] = useState('')
  const [assignPending, startAssign] = useTransition()
  const [assignMsg, setAssignMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('role, organization_id')
          .eq('id', user.id)
          .single()
        setUserRole(prof?.role ?? null)
        if (prof?.organization_id) {
          const { data: respList } = await supabase
            .from('profiles')
            .select('id, full_name, is_on_duty')
            .eq('role', 'responder')
            .eq('organization_id', prof.organization_id)
            .order('full_name')
          setResponders((respList ?? []) as Responder[])
        }
      }

      const { data } = await supabase
        .from('incidents')
        .select('id, incident_code, emergency_type, status, priority_level, citizen_address, citizen_lat, citizen_lng, notes, created_at, tl_notified_at, tl_acknowledged_at, acknowledged_by_tl_id, assigned_tl_id, assigned_responder_id, escalated_at, transfer_reason, citizen_id')
        .eq('id', id)
        .single()
      if (data) {
        setIncident(data as Incident)
        const lookups = []
        if (data.acknowledged_by_tl_id) {
          lookups.push(
            supabase.from('profiles').select('full_name').eq('id', data.acknowledged_by_tl_id).single()
              .then(({ data: p }) => setAckByName(p?.full_name ?? null))
          )
        }
        if (data.citizen_id) {
          lookups.push(
            supabase.from('profiles').select('full_name').eq('id', data.citizen_id).single()
              .then(({ data: p }) => setCitizenName(p?.full_name ?? null))
          )
        }
        await Promise.all(lookups)
      }
      setLoading(false)
    }
    load()

    // Fetch media separately (no await — non-blocking)
    supabase
      .from('incident_media')
      .select('id, media_url, media_type, description')
      .eq('incident_id', id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        const rows = (data ?? []) as IncidentMedia[]
        setMedia(rows.map(r => {
          if (r.media_url.startsWith('http')) return r
          const { data: urlData } = supabase.storage
            .from('incident-media')
            .getPublicUrl(r.media_url)
          return { ...r, media_url: urlData.publicUrl }
        }))
      })
  }, [id, supabase])

  function handleAcknowledge() {
    setAckMsg(null)
    startAck(async () => {
      const res = await acknowledgeTLAction(id)
      if (res.success) {
        setIncident((prev) => prev ? { ...prev, tl_acknowledged_at: new Date().toISOString() } : prev)
        setAckMsg({ text: 'Incident acknowledged. Escalation timer stopped.', ok: true })
      } else {
        setAckMsg({ text: res.error ?? 'Failed to acknowledge', ok: false })
      }
    })
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#070B18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.30)', fontSize: 13 }}>Loading…</p>
      </div>
    )
  }

  if (!incident) {
    return (
      <div style={{ minHeight: '100vh', background: '#070B18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#FCA5A5', fontSize: 13 }}>Incident not found.</p>
      </div>
    )
  }

  const sc = statusColor(incident.status)
  const isAcknowledged = !!incident.tl_acknowledged_at
  const isAssignable = !ASSIGN_BLOCKED.includes(incident.status) && isAcknowledged
  const canAcknowledge = userRole === 'team_leader'

  function handleAssign() {
    if (!selectedResponderId) return
    setAssignMsg(null)
    startAssign(async () => {
      const res = await assignResponderAction(incident!.id, selectedResponderId)
      if (res.success) {
        setIncident((prev) => prev ? { ...prev, assigned_responder_id: selectedResponderId, status: 'assigned' } : prev)
        setAssignMsg({ text: 'Responder assigned. Notification sent.', ok: true })
      } else {
        setAssignMsg({ text: res.error ?? 'Failed to assign', ok: false })
      }
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#070B18', color: 'white', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{
        height: 60, padding: '0 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(7,11,24,0.97)', backdropFilter: 'blur(14px)',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: 'white', lineHeight: 1 }}>Incident Detail</h1>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', marginTop: 2 }}>{incident.incident_code}</p>
        </div>
        <Link href="/dashboard/tl" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'rgba(255,255,255,0.40)', textDecoration: 'none' }}>
          <ArrowLeft size={14} /> Back to Queue
        </Link>
      </header>

      <main style={{ maxWidth: 700, margin: '0 auto', padding: '32px 24px' }}>

        {/* Status bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderRadius: 12, marginBottom: 24,
          background: sc.bg, border: `1px solid ${sc.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={16} color={sc.text} />
            <span style={{ fontSize: 13, fontWeight: 700, color: sc.text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {incident.status.replace(/_/g, ' ')}
            </span>
          </div>
          <span style={{ fontSize: 12, color: priorityColor(incident.priority_level), fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {incident.priority_level} priority
          </span>
        </div>

        {/* Cross-org transfer notice */}
        {incident.transfer_reason && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 18px', borderRadius: 12, marginBottom: 24,
            background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.28)',
          }}>
            <span style={{ fontSize: 15 }}>↔</span>
            <p style={{ fontSize: 12.5, color: '#C4B5FD' }}>{incident.transfer_reason}</p>
          </div>
        )}

        {/* Acknowledge card — TL only */}
        {!isAcknowledged && canAcknowledge ? (
          <div style={{
            padding: '18px 20px', borderRadius: 12, marginBottom: 24,
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#FCD34D', marginBottom: 4 }}>
                  Action Required — Acknowledge This Incident
                </p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)', lineHeight: 1.5 }}>
                  Acknowledging stops the escalation timer and records your accountability. You must acknowledge before assigning a responder.
                </p>
              </div>
              <button
                onClick={handleAcknowledge}
                disabled={ackPending}
                style={{
                  flexShrink: 0, padding: '10px 20px', borderRadius: 9,
                  background: ackPending ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.18)',
                  border: '1px solid rgba(245,158,11,0.35)',
                  color: ackPending ? 'rgba(245,158,11,0.45)' : '#FCD34D',
                  fontSize: 13, fontWeight: 700, cursor: ackPending ? 'default' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {ackPending ? 'Saving…' : '✓ Acknowledge'}
              </button>
            </div>
            {ackMsg && (
              <p style={{ marginTop: 10, fontSize: 12, color: ackMsg.ok ? '#34D399' : '#FCA5A5' }}>
                {ackMsg.text}
              </p>
            )}
          </div>
        ) : null}

        {isAcknowledged && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 18px', borderRadius: 12, marginBottom: 24,
            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
          }}>
            <CheckCircle size={16} color="#34D399" />
            <div>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: '#34D399' }}>Acknowledged</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                {ackByName ? `By ${ackByName} · ` : ''}{new Date(incident.tl_acknowledged_at!).toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Incident details */}
        <div style={{ background: '#0A0F1E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.30)', textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 4 }}>
            Incident Information
          </h2>
          <Row label="Code" value={<span style={{ fontFamily: 'monospace', color: '#00E5FF' }}>{incident.incident_code}</span>} />
          {citizenName && <Row label="Reported By" value={<span style={{ color: '#C4B5FD' }}>{citizenName}</span>} />}
          <Row label="Type" value={incident.emergency_type.toUpperCase()} />
          <Row label="Location" value={
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={13} color="rgba(255,255,255,0.40)" />
              {incident.citizen_address ?? `${incident.citizen_lat.toFixed(5)}, ${incident.citizen_lng.toFixed(5)}`}
            </span>
          } />
          <Row label="Notes" value={incident.notes ?? '—'} />
          <Row label="Created" value={new Date(incident.created_at).toLocaleString()} />
          {incident.tl_notified_at && <Row label="TL Notified" value={new Date(incident.tl_notified_at).toLocaleString()} />}
          {incident.escalated_at && <Row label="Escalated At" value={<span style={{ color: '#FCA5A5' }}>{new Date(incident.escalated_at).toLocaleString()}</span>} />}
        </div>

        {/* Inline assign responder */}
        {isAssignable && (
          <div style={{
            padding: '18px 20px', borderRadius: 12,
            background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.22)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Shield size={15} color="#93C5FD" />
              <p style={{ fontSize: 13, fontWeight: 700, color: '#93C5FD' }}>
                {incident.assigned_responder_id ? 'Reassign Responder' : 'Assign Responder'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <select
                  value={selectedResponderId}
                  onChange={(e) => setSelectedResponderId(e.target.value)}
                  disabled={assignPending}
                  style={{
                    width: '100%', appearance: 'none',
                    padding: '9px 36px 9px 14px', borderRadius: 9,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.14)',
                    color: selectedResponderId ? 'white' : 'rgba(255,255,255,0.35)',
                    fontSize: 13, cursor: 'pointer', outline: 'none',
                  }}
                >
                  <option value="" disabled style={{ background: '#0D1325' }}>
                    {responders.length === 0 ? 'No responders available' : 'Select responder…'}
                  </option>
                  {responders.filter((r) => r.id !== incident.assigned_responder_id).map((r) => (
                    <option key={r.id} value={r.id} style={{ background: '#0D1325', color: 'white' }}>
                      {r.full_name}{r.is_on_duty ? ' • On Duty' : ' • Off Duty'}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  color="rgba(255,255,255,0.35)"
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                />
              </div>
              <button
                onClick={handleAssign}
                disabled={!selectedResponderId || assignPending}
                style={{
                  flexShrink: 0, padding: '9px 20px', borderRadius: 9,
                  background: !selectedResponderId || assignPending ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.22)',
                  border: '1px solid rgba(59,130,246,0.35)',
                  color: !selectedResponderId || assignPending ? 'rgba(147,197,253,0.40)' : '#93C5FD',
                  fontSize: 13, fontWeight: 700,
                  cursor: !selectedResponderId || assignPending ? 'default' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {assignPending ? 'Assigning…' : 'Assign'}
              </button>
            </div>

            {assignMsg && (
              <p style={{ marginTop: 10, fontSize: 12, color: assignMsg.ok ? '#34D399' : '#FCA5A5' }}>
                {assignMsg.text}
              </p>
            )}
          </div>
        )}

        {incident.assigned_responder_id && ASSIGN_BLOCKED.includes(incident.status) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 18px', borderRadius: 12, marginTop: 16,
            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.20)',
          }}>
            <User size={15} color="#34D399" />
            <p style={{ fontSize: 12.5, color: '#34D399' }}>Responder is on scene — status: {incident.status.replace(/_/g, ' ')}</p>
          </div>
        )}

        {/* Attached media */}
        {media.length > 0 && (
          <div style={{
            background: '#0A0F1E', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, padding: '20px 24px', marginTop: 20,
          }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.30)', textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 16 }}>
              Attached Media ({media.length})
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {media.map((item) => (
                <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 110 }}>
                  {item.media_type === 'photo' ? (
                    <button
                      onClick={() => setLightboxUrl(item.media_url)}
                      style={{
                        width: 100, height: 100, borderRadius: 8, overflow: 'hidden',
                        border: '1px solid rgba(255,255,255,0.12)', padding: 0, cursor: 'pointer',
                        background: 'none',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                  ) : (
                    <a
                      href={item.media_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        width: 100, height: 100, borderRadius: 8,
                        border: '1px solid rgba(59,130,246,0.30)',
                        background: 'rgba(59,130,246,0.08)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', gap: 6, textDecoration: 'none',
                      }}
                    >
                      <Video size={24} color="#3B82F6" />
                      <span style={{ fontSize: 9, color: '#3B82F6', fontWeight: 700, letterSpacing: 1 }}>VIDEO</span>
                    </a>
                  )}
                  {item.description && (
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4, maxWidth: 100 }}>
                      {item.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setLightboxUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt=""
            style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 12, objectFit: 'contain' }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxUrl(null)}
            style={{
              position: 'absolute', top: 20, right: 20,
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)', border: 'none',
              cursor: 'pointer', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  )
}

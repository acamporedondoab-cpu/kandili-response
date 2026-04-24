'use client'

import { useState, useTransition, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, MapPin, AlertTriangle, User, Shield } from 'lucide-react'
import { acknowledgeTLAction } from '../../../../lib/supabase/incident-actions'
import { createClient } from '../../../../lib/supabase/client'

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
}

export default function TLIncidentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [incident, setIncident] = useState<Incident | null>(null)
  const [ackByName, setAckByName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [ackPending, startAck] = useTransition()
  const [ackMsg, setAckMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('incidents')
        .select('id, incident_code, emergency_type, status, priority_level, citizen_address, citizen_lat, citizen_lng, notes, created_at, tl_notified_at, tl_acknowledged_at, acknowledged_by_tl_id, assigned_tl_id, assigned_responder_id, escalated_at')
        .eq('id', id)
        .single()
      if (data) {
        setIncident(data as Incident)
        if (data.acknowledged_by_tl_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', data.acknowledged_by_tl_id)
            .single()
          setAckByName(profile?.full_name ?? null)
        }
      }
      setLoading(false)
    }
    load()
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
  const isAssignable = ['pending', 'escalated'].includes(incident.status) && isAcknowledged

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

        {/* Acknowledge card */}
        {!isAcknowledged ? (
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
        ) : (
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

        {/* Assign responder prompt */}
        {isAssignable && (
          <div style={{
            padding: '16px 20px', borderRadius: 12,
            background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={15} color="#93C5FD" />
                <p style={{ fontSize: 13, fontWeight: 700, color: '#93C5FD' }}>Ready to assign a responder</p>
              </div>
              <button
                onClick={() => router.push(`/dashboard/tl?assign=${incident.id}`)}
                style={{
                  padding: '8px 18px', borderRadius: 9,
                  background: 'rgba(59,130,246,0.18)', border: '1px solid rgba(59,130,246,0.35)',
                  color: '#93C5FD', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Assign Responder →
              </button>
            </div>
          </div>
        )}

        {incident.assigned_responder_id && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 18px', borderRadius: 12, marginTop: 16,
            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.20)',
          }}>
            <User size={15} color="#34D399" />
            <p style={{ fontSize: 12.5, color: '#34D399' }}>Responder has been assigned to this incident.</p>
          </div>
        )}

      </main>
    </div>
  )
}

'use client'

import { useState, useEffect, useTransition } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { updateIncidentStatusAction, resolveWithReportAction } from '../../../../lib/supabase/incident-actions'
import { createClient } from '../../../../lib/supabase/client'

function statusColor(status: string) {
  switch (status) {
    case 'pending':    return { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.30)', text: '#FCD34D' }
    case 'escalated':  return { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.30)',  text: '#FCA5A5' }
    case 'assigned':   return { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.30)', text: '#93C5FD' }
    case 'accepted':   return { bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.30)', text: '#A5B4FC' }
    case 'en_route':   return { bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.30)', text: '#C4B5FD' }
    case 'arrived':    return { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.30)', text: '#6EE7B7' }
    case 'pending_citizen_confirmation': return { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.28)', text: '#FCD34D' }
    case 'resolved':   return { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.30)', text: '#34D399' }
    default:           return { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', text: 'rgba(255,255,255,0.55)' }
  }
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

function Field({
  label, value, onChange, placeholder, multiline, required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
  required?: boolean
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        {label}{required && <span style={{ color: '#FCA5A5', marginLeft: 3 }}>*</span>}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 8, padding: '10px 12px', color: 'white', fontSize: 13.5,
            resize: 'vertical', outline: 'none', boxSizing: 'border-box',
          }}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 8, padding: '10px 12px', color: 'white', fontSize: 13.5,
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      )}
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
  accepted_at: string | null
  en_route_at: string | null
  arrived_at: string | null
}

const ACTION_LABELS: Record<string, string> = {
  assigned: 'Accept Assignment',
  accepted: 'Mark En Route',
  en_route: 'Mark Arrived on Scene',
}

export default function ResponderIncidentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [incident, setIncident] = useState<Incident | null>(null)
  const [loading, setLoading] = useState(true)

  const [actionPending, startAction] = useTransition()
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const [showReport, setShowReport] = useState(false)
  const [noteWhat, setNoteWhat] = useState('')
  const [noteWhen, setNoteWhen] = useState('')
  const [noteWhere, setNoteWhere] = useState('')
  const [noteWho, setNoteWho] = useState('')
  const [noteHow, setNoteHow] = useState('')
  const [submitPending, startSubmit] = useTransition()
  const [submitMsg, setSubmitMsg] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let firstSubscribe = true

    async function load() {
      const { data } = await supabase
        .from('incidents')
        .select('id, incident_code, emergency_type, status, priority_level, citizen_address, citizen_lat, citizen_lng, notes, created_at, accepted_at, en_route_at, arrived_at')
        .eq('id', id)
        .single()
      if (data) setIncident(data as Incident)
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel(`responder-web-incident-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'incidents', filter: `id=eq.${id}` },
        (payload) => setIncident((prev) => prev ? { ...prev, ...(payload.new as Incident) } : prev)
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        if (firstSubscribe) { firstSubscribe = false; return }
        load()
      })

    return () => { supabase.removeChannel(channel) }
  }, [id])

  function handleAction() {
    if (!incident) return
    setActionMsg(null)
    startAction(async () => {
      const res = await updateIncidentStatusAction(incident.id, incident.status)
      if (!res.success) setActionMsg(res.error ?? 'Failed to update status')
    })
  }

  function handleSubmitReport() {
    if (!noteWhat.trim() || !noteHow.trim()) {
      setSubmitMsg({ text: '"What" and "Report Summary" are required.', ok: false })
      return
    }
    const formatted = [
      `What: ${noteWhat.trim()}`,
      `When: ${noteWhen.trim() || new Date().toLocaleString()}`,
      `Where: ${noteWhere.trim() || (incident?.citizen_address ?? 'See coordinates')}`,
      `Who: ${noteWho.trim() || 'Not specified'}`,
      `How / Report Summary: ${noteHow.trim()}`,
    ].join('\n')

    setSubmitMsg(null)
    startSubmit(async () => {
      const res = await resolveWithReportAction(incident!.id, formatted)
      if (res.success) {
        setIncident((prev) => prev ? { ...prev, status: 'pending_citizen_confirmation', notes: formatted } : prev)
        setShowReport(false)
      } else {
        setSubmitMsg({ text: res.error ?? 'Failed to submit report', ok: false })
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
  const actionLabel = ACTION_LABELS[incident.status]
  const isArrived = incident.status === 'arrived'
  const isPending = incident.status === 'pending_citizen_confirmation'
  const isDone = incident.status === 'resolved' || incident.status === 'closed'

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
          <h1 style={{ fontSize: 16, fontWeight: 700, color: 'white', lineHeight: 1 }}>My Incident</h1>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', marginTop: 2 }}>{incident.incident_code}</p>
        </div>
        <Link href="/dashboard/responder" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'rgba(255,255,255,0.40)', textDecoration: 'none' }}>
          <ArrowLeft size={14} /> Back
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
          <span style={{ fontSize: 12, color: incident.priority_level === 'critical' ? '#FCA5A5' : incident.priority_level === 'high' ? '#FCD34D' : 'rgba(255,255,255,0.55)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {incident.priority_level} priority
          </span>
        </div>

        {/* Pending citizen confirmation banner */}
        {isPending && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '14px 18px', borderRadius: 12, marginBottom: 24,
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.28)',
          }}>
            <Clock size={16} color="#FCD34D" />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#FCD34D' }}>Awaiting citizen confirmation</p>
              <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>The citizen has been notified and must confirm the incident was handled.</p>
            </div>
          </div>
        )}

        {/* Resolved banner */}
        {isDone && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '14px 18px', borderRadius: 12, marginBottom: 24,
            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
          }}>
            <CheckCircle size={16} color="#34D399" />
            <p style={{ fontSize: 13, fontWeight: 700, color: '#34D399' }}>Incident resolved and confirmed.</p>
          </div>
        )}

        {/* Incident details */}
        <div style={{ background: '#0A0F1E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.30)', textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 4 }}>
            Incident Information
          </h2>
          <Row label="Code"     value={<span style={{ fontFamily: 'monospace', color: '#00E5FF' }}>{incident.incident_code}</span>} />
          <Row label="Type"     value={incident.emergency_type.toUpperCase()} />
          <Row label="Location" value={
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={13} color="rgba(255,255,255,0.40)" />
              {incident.citizen_address ?? `${incident.citizen_lat.toFixed(5)}, ${incident.citizen_lng.toFixed(5)}`}
            </span>
          } />
          {incident.notes && <Row label="Notes" value={<span style={{ whiteSpace: 'pre-wrap' }}>{incident.notes}</span>} />}
          <Row label="Reported" value={new Date(incident.created_at).toLocaleString()} />
          {incident.accepted_at && <Row label="Accepted"  value={new Date(incident.accepted_at).toLocaleString()} />}
          {incident.en_route_at && <Row label="En Route"  value={new Date(incident.en_route_at).toLocaleString()} />}
          {incident.arrived_at  && <Row label="Arrived"   value={new Date(incident.arrived_at).toLocaleTimeString()} />}
        </div>

        {/* Status action button (assigned / accepted / en_route) */}
        {actionLabel && !isArrived && (
          <div style={{ padding: '16px 20px', borderRadius: 12, background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.22)', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.50)' }}>Next action</p>
              <button
                onClick={handleAction}
                disabled={actionPending}
                style={{
                  padding: '10px 22px', borderRadius: 9,
                  background: actionPending ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.18)',
                  border: '1px solid rgba(59,130,246,0.35)',
                  color: actionPending ? 'rgba(147,197,253,0.45)' : '#93C5FD',
                  fontSize: 13, fontWeight: 700, cursor: actionPending ? 'default' : 'pointer',
                }}
              >
                {actionPending ? 'Updating…' : actionLabel}
              </button>
            </div>
            {actionMsg && <p style={{ marginTop: 10, fontSize: 12, color: '#FCA5A5' }}>{actionMsg}</p>}
          </div>
        )}

        {/* Arrived → show Submit Report button or the report form */}
        {isArrived && !showReport && (
          <div style={{ padding: '16px 20px', borderRadius: 12, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.22)', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#6EE7B7' }}>You have arrived on scene</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>Complete the incident report to submit for citizen confirmation.</p>
              </div>
              <button
                onClick={() => setShowReport(true)}
                style={{
                  padding: '10px 22px', borderRadius: 9,
                  background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.35)',
                  color: '#34D399', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                Submit Report →
              </button>
            </div>
          </div>
        )}

        {/* 5W Report form */}
        {isArrived && showReport && (
          <div style={{ background: '#0A0F1E', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '24px', marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 4 }}>Incident Report</h2>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 20 }}>
              This report is recorded as the official incident log and sent to the Team Leader.
            </p>

            <Field label="What" required value={noteWhat} onChange={setNoteWhat} placeholder="Nature of the emergency…" />
            <Field label="When" value={noteWhen} onChange={setNoteWhen} placeholder={new Date().toLocaleString()} />
            <Field label="Where" value={noteWhere} onChange={setNoteWhere} placeholder={incident.citizen_address ?? 'Location details…'} />
            <Field label="Who" value={noteWho} onChange={setNoteWho} placeholder="Persons involved, witnesses…" />
            <Field label="How / Report Summary" required value={noteHow} onChange={setNoteHow} placeholder="Actions taken, outcome, evidence collected…" multiline />

            {submitMsg && (
              <p style={{ fontSize: 12, color: submitMsg.ok ? '#34D399' : '#FCA5A5', marginBottom: 14 }}>
                {submitMsg.text}
              </p>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowReport(false); setSubmitMsg(null) }}
                disabled={submitPending}
                style={{
                  padding: '10px 20px', borderRadius: 9,
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.45)', fontSize: 13, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={submitPending}
                style={{
                  padding: '10px 24px', borderRadius: 9,
                  background: submitPending ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.18)',
                  border: '1px solid rgba(16,185,129,0.35)',
                  color: submitPending ? 'rgba(52,211,153,0.45)' : '#34D399',
                  fontSize: 13, fontWeight: 700, cursor: submitPending ? 'default' : 'pointer',
                }}
              >
                {submitPending ? 'Submitting…' : 'Submit for Citizen Confirmation'}
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}

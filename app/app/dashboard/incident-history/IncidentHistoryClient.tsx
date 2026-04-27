'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { LayoutDashboard, Siren, Settings, History, ChevronLeft, ChevronRight, Search, ChevronDown } from 'lucide-react'
import { createClient } from '../../lib/supabase/client'
import type { ResolvedIncident } from '../tl/components/IncidentQueueTable'

type IncidentMedia = {
  id: string
  media_url: string
  media_type: 'photo' | 'video'
  description: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTs(ts: string | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function calcResponseTime(inc: ResolvedIncident): string {
  let seconds = inc.response_time_seconds
  if (!seconds && inc.responder_assigned_at && inc.resolved_at) {
    seconds = Math.round(
      (new Date(inc.resolved_at).getTime() - new Date(inc.responder_assigned_at).getTime()) / 1000
    )
  }
  if (!seconds && inc.created_at && inc.resolved_at) {
    seconds = Math.round(
      (new Date(inc.resolved_at).getTime() - new Date(inc.created_at).getTime()) / 1000
    )
  }
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

interface ParsedReport {
  what: string | null
  when: string | null
  where: string | null
  who: string | null
  summary: string | null
}

function parseReport(notes: string | null): ParsedReport {
  if (!notes) return { what: null, when: null, where: null, who: null, summary: null }
  const result: ParsedReport = { what: null, when: null, where: null, who: null, summary: null }
  const labelRe = /(?:^|\s)(What|When|Where|Who|How\s*\/\s*Report\s+Summary|Report\s*\/\s*Summary|Report|Summary)\s*:/gi
  const matches = Array.from(notes.matchAll(labelRe))
  for (let i = 0; i < matches.length; i++) {
    const rawLabel = matches[i][1].toLowerCase()
    const valueStart = matches[i].index! + matches[i][0].length
    const valueEnd = i + 1 < matches.length ? matches[i + 1].index! : notes.length
    const value = notes.slice(valueStart, valueEnd).trim() || null
    if (rawLabel === 'what') result.what = value
    else if (rawLabel === 'when') result.when = value
    else if (rawLabel === 'where') result.where = value
    else if (rawLabel === 'who') result.who = value
    else result.summary = value
  }
  return result
}

function locationLabel(inc: ResolvedIncident): string {
  if (inc.citizen_address) return inc.citizen_address
  if (inc.citizen_lat != null && inc.citizen_lng != null)
    return `${Number(inc.citizen_lat).toFixed(4)}, ${Number(inc.citizen_lng).toFixed(4)}`
  return '—'
}

function escapeHtml(str: string | null): string {
  if (!str) return ''
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function exportPDF(inc: ResolvedIncident, responderName: string) {
  const report = parseReport(inc.notes)
  const resolvedDate = inc.resolved_at
    ? new Date(inc.resolved_at).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })
    : '—'
  const reportRows = [
    report.what ? `<div class="row"><span class="label">What:</span><span class="value">${escapeHtml(report.what)}</span></div>` : '',
    report.when ? `<div class="row"><span class="label">When:</span><span class="value">${escapeHtml(report.when)}</span></div>` : '',
    report.where ? `<div class="row"><span class="label">Where:</span><span class="value">${escapeHtml(report.where)}</span></div>` : '',
    report.who ? `<div class="row"><span class="label">Who:</span><span class="value">${escapeHtml(report.who)}</span></div>` : '',
    report.summary ? `<div class="row"><span class="label">Report/Summary:</span><span class="value">${escapeHtml(report.summary)}</span></div>` : '',
  ].join('')
  const fallbackNotes = !report.what && !report.when && !report.where && !report.who && !report.summary && inc.notes
    ? `<p>${escapeHtml(inc.notes)}</p>` : ''

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>Incident Report — ${escapeHtml(inc.incident_code)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;padding:48px;color:#111;font-size:13px}
    .header{border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:flex-end}
    .header-left h1{font-size:22px;font-weight:800;letter-spacing:-0.02em}
    .header-left p{color:#666;font-size:12px;margin-top:4px}
    .header-right{text-align:right;font-size:11px;color:#888}
    .section{margin-bottom:26px}
    .section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin-bottom:10px;border-bottom:1px solid #e5e5e5;padding-bottom:5px}
    .row{display:flex;gap:12px;margin-bottom:7px}
    .label{color:#777;width:150px;flex-shrink:0;font-weight:600}
    .value{color:#111}
    .timeline{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
    .timeline-item{background:#F3F4F6;padding:4px 10px;border-radius:6px;font-size:12px;color:#444}
    .footer{margin-top:48px;padding-top:12px;border-top:1px solid #e5e5e5;font-size:10px;color:#bbb;display:flex;justify-content:space-between}
    @media print{body{padding:24px}}
  </style></head><body>
  <div class="header">
    <div class="header-left"><h1>Incident Report</h1><p>${escapeHtml(inc.incident_code)} &nbsp;·&nbsp; ${resolvedDate}</p></div>
    <div class="header-right">Kandili Response<br/>Official Record</div>
  </div>
  <div class="section">
    <div class="section-title">Incident Details</div>
    <div class="row"><span class="label">Incident Code:</span><span class="value">${escapeHtml(inc.incident_code)}</span></div>
    <div class="row"><span class="label">Type:</span><span class="value">${inc.emergency_type === 'crime' ? 'Crime' : 'Medical'}</span></div>
    <div class="row"><span class="label">Final Status:</span><span class="value">${escapeHtml(inc.status)}</span></div>
    <div class="row"><span class="label">Location:</span><span class="value">${escapeHtml(locationLabel(inc))}</span></div>
    <div class="row"><span class="label">Assigned Responder:</span><span class="value">${escapeHtml(responderName)}</span></div>
    <div class="row"><span class="label">Response Time:</span><span class="value">${calcResponseTime(inc)}</span></div>
  </div>
  <div class="section">
    <div class="section-title">Timeline</div>
    <div class="timeline">
      <div class="timeline-item">Created: ${formatTs(inc.created_at)}</div>
      ${inc.tl_assigned_at ? `<div class="timeline-item">Acknowledged: ${formatTs(inc.tl_assigned_at)}</div>` : ''}
      ${inc.responder_assigned_at ? `<div class="timeline-item">Assigned: ${formatTs(inc.responder_assigned_at ?? null)}</div>` : ''}
      <div class="timeline-item">En Route: ${formatTs(inc.en_route_at)}</div>
      <div class="timeline-item">Arrived: ${formatTs(inc.arrived_at)}</div>
      <div class="timeline-item">Resolved: ${formatTs(inc.resolved_at)}</div>
    </div>
  </div>
  ${inc.notes ? `<div class="section"><div class="section-title">Responder Report</div>${reportRows || fallbackNotes}</div>` : ''}
  <div class="footer"><span>Generated by Kandili Response</span><span>${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}</span></div>
  </body></html>`

  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }
}

// ── Incident Row ──────────────────────────────────────────────────────────────

function IncidentRow({
  inc,
  expandedId,
  setExpandedId,
  responderMap,
}: {
  inc: ResolvedIncident
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  responderMap: Record<string, string>
}) {
  const isExpanded = expandedId === inc.id
  const joinedName = inc.responder_profile && !Array.isArray(inc.responder_profile)
    ? (inc.responder_profile as { full_name: string }).full_name
    : Array.isArray(inc.responder_profile) && (inc.responder_profile as unknown[]).length > 0
      ? ((inc.responder_profile as { full_name: string }[])[0]).full_name
      : null
  const responderName = inc.assigned_responder_id
    ? (joinedName ?? responderMap[inc.assigned_responder_id] ?? 'Unknown')
    : '—'
  const report = parseReport(inc.notes)
  const [media, setMedia] = useState<IncidentMedia[]>([])
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!isExpanded) return
    const supabase = createClient()
    supabase
      .from('incident_media')
      .select('id, media_url, media_type, description')
      .eq('incident_id', inc.id)
      .order('created_at', { ascending: true })
      .then(({ data }: { data: IncidentMedia[] | null }) => {
        const rows = data ?? []
        setMedia(rows.map(r => {
          if (r.media_url.startsWith('http')) return r
          const { data: urlData } = supabase.storage.from('incident-media').getPublicUrl(r.media_url)
          return { ...r, media_url: urlData.publicUrl }
        }))
      })
  }, [isExpanded, inc.id])

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <button
        onClick={() => setExpandedId(isExpanded ? null : inc.id)}
        style={{
          width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14,
          padding: '12px 24px 12px 40px', background: 'transparent', border: 'none', cursor: 'pointer',
          transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <span style={{
          color: 'rgba(255,255,255,0.28)', fontSize: 10, flexShrink: 0,
          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          display: 'inline-block', transition: 'transform 0.18s',
        }}>▶</span>

        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#00E5FF', fontSize: 13, width: 150, flexShrink: 0 }}>
          {inc.incident_code}
        </span>

        <span style={{
          display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 20,
          fontSize: 11, fontWeight: 700, flexShrink: 0,
          background: inc.emergency_type === 'crime' ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
          color: inc.emergency_type === 'crime' ? '#93C5FD' : '#6EE7B7',
          border: inc.emergency_type === 'crime' ? '1px solid rgba(59,130,246,0.30)' : '1px solid rgba(16,185,129,0.30)',
        }}>
          {inc.emergency_type === 'crime' ? 'Crime' : 'Medical'}
        </span>

        {/* Description + Location stacked */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {report.what && (
            <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {report.what}
            </span>
          )}
          <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.32)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {locationLabel(inc)}
          </span>
        </div>

        <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', flexShrink: 0, width: 140, textAlign: 'right' }}>
          {responderName}
        </span>

        <span style={{ fontSize: 11.5, color: '#34D399', fontWeight: 600, flexShrink: 0, width: 80, textAlign: 'right' }}>
          {formatTs(inc.resolved_at)}
        </span>
      </button>

      {isExpanded && (
        <div style={{
          margin: '0 24px 12px 40px',
          padding: '18px 20px',
          borderRadius: 10,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          {/* Timeline */}
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', marginBottom: 10 }}>
            Timeline
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
            {[
              { label: 'Created', ts: inc.created_at ?? null, color: 'rgba(255,255,255,0.20)' },
              { label: 'Acknowledged', ts: inc.tl_assigned_at ?? null, color: '#0EA5E9' },
              { label: 'Assigned', ts: inc.responder_assigned_at ?? null, color: '#3B82F6' },
              { label: 'En Route', ts: inc.en_route_at ?? null, color: '#8B5CF6' },
              { label: 'Arrived', ts: inc.arrived_at ?? null, color: '#14B8A6' },
              { label: 'Resolved', ts: inc.resolved_at ?? null, color: '#34D399' },
            ].map(({ label, ts, color }) => (
              <span key={label} style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11.5,
                background: ts ? `${color}18` : 'rgba(255,255,255,0.04)',
                color: ts ? color : 'rgba(255,255,255,0.18)',
                border: `1px solid ${ts ? `${color}30` : 'rgba(255,255,255,0.06)'}`,
              }}>
                {label}: {formatTs(ts)}
              </span>
            ))}
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBottom: 18 }}>
            <div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Location</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.80)' }}>{locationLabel(inc)}</p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Responder</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.80)' }}>{responderName}</p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Response Time</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#FBBF24' }}>{calcResponseTime(inc)}</p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Status</p>
              <span style={{
                display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: inc.status === 'resolved' ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.06)',
                color: inc.status === 'resolved' ? '#34D399' : 'rgba(255,255,255,0.40)',
                border: inc.status === 'resolved' ? '1px solid rgba(52,211,153,0.25)' : '1px solid rgba(255,255,255,0.10)',
              }}>
                {inc.status === 'resolved' ? 'Citizen Confirmed' : inc.status === 'closed' ? 'Auto Closed' : inc.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          {/* Report */}
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', marginBottom: 10 }}>
            Responder Report
          </p>
          {inc.notes ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'What', value: report.what },
                { label: 'When', value: report.when },
                { label: 'Where', value: report.where },
                { label: 'Who', value: report.who },
                { label: 'Report / Summary', value: report.summary },
              ].filter(r => r.value).map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', gap: 12 }}>
                  <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.32)', width: 120, flexShrink: 0 }}>{label}:</span>
                  <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.78)' }}>{value}</span>
                </div>
              ))}
              {!report.what && !report.when && !report.where && !report.who && !report.summary && (
                <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)' }}>{inc.notes}</p>
              )}
            </div>
          ) : (
            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.22)', fontStyle: 'italic' }}>No notes recorded</p>
          )}

          {/* Attached media */}
          {media.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', marginBottom: 10 }}>
                Attached Media ({media.length})
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {media.map((item) => (
                  <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 110 }}>
                    {item.media_type === 'photo' ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); setLightboxUrl(item.media_url) }}
                        style={{
                          width: 96, height: 96, borderRadius: 8, overflow: 'hidden',
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
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: 96, height: 96, borderRadius: 8,
                          border: '1px solid rgba(59,130,246,0.30)',
                          background: 'rgba(59,130,246,0.08)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          justifyContent: 'center', gap: 6, textDecoration: 'none',
                        }}
                      >
                        <span style={{ fontSize: 24 }}>🎥</span>
                        <span style={{ fontSize: 9, color: '#3B82F6', fontWeight: 700, letterSpacing: 1 }}>VIDEO</span>
                      </a>
                    )}
                    {item.description && (
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', lineHeight: 1.4, maxWidth: 96 }}>
                        {item.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PDF Export */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button
              onClick={(e) => { e.stopPropagation(); exportPDF(inc, responderName) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.65)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.12s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.10)'
                e.currentTarget.style.color = 'white'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                e.currentTarget.style.color = 'rgba(255,255,255,0.65)'
              }}
            >
              ↓ Export PDF
            </button>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
              position: 'absolute', top: 20, right: 20, width: 40, height: 40,
              borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none',
              cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 18,
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function SidebarLink({
  icon, label, href, active,
}: {
  icon: React.ReactNode
  label: string
  href: string
  active?: boolean
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px', borderRadius: 8, marginBottom: 2,
        textDecoration: 'none',
        background: active ? 'rgba(0,229,255,0.12)' : 'transparent',
        color: active ? '#00E5FF' : 'rgba(255,255,255,0.42)',
        fontSize: 13, fontWeight: active ? 600 : 400,
        borderLeft: active ? '3px solid #00E5FF' : '3px solid transparent',
        transition: 'background 0.12s, color 0.12s',
      }}
    >
      {icon}
      {label}
    </Link>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function IncidentHistoryClient({
  incidents,
  responders,
  currentMonth,
  role,
  fullName,
  email,
}: {
  incidents: ResolvedIncident[]
  responders: { id: string; full_name: string }[]
  currentMonth: string
  role: string
  fullName: string
  email: string
}) {
  const router = useRouter()
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [year, monthNum] = currentMonth.split('-').map(Number)
  const monthLabel = `${MONTH_NAMES[monthNum - 1]} ${year}`

  const now = new Date()
  const isCurrentMonth = year === now.getFullYear() && monthNum === now.getMonth() + 1

  const responderMap = Object.fromEntries(responders.map((r) => [r.id, r.full_name]))

  const isAdmin = role === 'super_admin'
  const isTL = role === 'team_leader' || role === 'super_admin'
  const isSearchActive = search.trim().length > 0

  function navigate(delta: number) {
    const d = new Date(year, monthNum - 1 + delta, 1)
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    setExpandedDates(new Set())
    setExpandedId(null)
    setSearch('')
    router.push(`/dashboard/incident-history?month=${newMonth}`)
  }

  function toggleDate(dateKey: string) {
    setExpandedDates((prev) => {
      const next = new Set(prev)
      if (next.has(dateKey)) {
        next.delete(dateKey)
        // collapse any open incident row that belongs to this date
        setExpandedId(null)
      } else {
        next.add(dateKey)
      }
      return next
    })
  }

  const filtered = incidents.filter((inc) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      inc.incident_code.toLowerCase().includes(q) ||
      (inc.citizen_address ?? '').toLowerCase().includes(q) ||
      inc.emergency_type.toLowerCase().includes(q)
    )
  })

  // Group by date
  const byDate = filtered.reduce<Record<string, ResolvedIncident[]>>((acc, inc) => {
    const dateKey = inc.resolved_at
      ? new Date(inc.resolved_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : 'Unknown Date'
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(inc)
    return acc
  }, {})

  return (
    <>
      <style>{`
        .sb-lnk:hover { background: rgba(255,255,255,0.05) !important; color: rgba(255,255,255,0.75) !important; }
      `}</style>

      <div style={{ display: 'flex', minHeight: '100vh', background: '#070B18', color: 'white', fontFamily: 'system-ui, sans-serif' }}>

        {/* Sidebar */}
        <aside style={{
          width: 220, flexShrink: 0, background: '#0A0F1E',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', flexDirection: 'column',
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 30,
        }}>
          <div style={{ padding: '20px 20px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Image src="/logo/kandili-logo.png" alt="Kandili" width={38} height={38} style={{ borderRadius: 8, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: 'white', letterSpacing: '-0.01em', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                  Kandili Response
                </p>
                <p style={{ fontSize: 10, color: 'rgba(0,229,255,0.55)', letterSpacing: '0.11em', textTransform: 'uppercase', marginTop: 4, lineHeight: 1 }}>
                  {role === 'super_admin' ? 'Super Admin' : 'Team Leader'}
                </p>
              </div>
            </div>
          </div>

          <nav style={{ padding: '14px 10px', flex: 1 }}>
            <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.20)', textTransform: 'uppercase', padding: '0 10px', marginBottom: 6 }}>
              Navigation
            </p>
            <SidebarLink icon={<LayoutDashboard size={15} />} label="Overview" href="/dashboard" />
            {isTL && <SidebarLink icon={<Siren size={15} />} label="Incident Center" href={isAdmin ? '/dashboard/incident-center' : '/dashboard/tl'} />}
            <SidebarLink icon={<History size={15} />} label="Incident History" href="/dashboard/incident-history" active />
            {isAdmin && <SidebarLink icon={<Settings size={15} />} label="Admin Panel" href="/admin" />}
          </nav>

          <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.60)', lineHeight: 1 }}>{fullName}</p>
            <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.28)', marginTop: 3 }}>{email}</p>
          </div>
        </aside>

        {/* Main */}
        <div style={{ flex: 1, marginLeft: 220, display: 'flex', flexDirection: 'column' }}>

          {/* Header */}
          <header style={{
            height: 60, padding: '0 36px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(7,11,24,0.97)', backdropFilter: 'blur(14px)',
            position: 'sticky', top: 0, zIndex: 20,
          }}>
            <div>
              <h1 style={{ fontSize: 17, fontWeight: 700, color: 'white', lineHeight: 1 }}>Incident History</h1>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', marginTop: 2 }}>
                Full archive of resolved incidents
              </p>
            </div>
            <Link
              href="/dashboard"
              style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.40)', textDecoration: 'none', fontWeight: 500 }}
            >
              ← Dashboard
            </Link>
          </header>

          {/* Content */}
          <main style={{ padding: '32px 36px', flex: 1 }}>

            {/* Controls row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>

              {/* Month picker */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 2,
                background: '#0A0F1E', border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 10, overflow: 'hidden',
              }}>
                <button
                  onClick={() => navigate(-1)}
                  style={{
                    padding: '9px 13px', border: 'none', background: 'transparent',
                    color: 'rgba(255,255,255,0.50)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center',
                    borderRight: '1px solid rgba(255,255,255,0.07)',
                    transition: 'color 0.12s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'white')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.50)')}
                >
                  <ChevronLeft size={15} />
                </button>
                <span style={{
                  padding: '9px 18px', fontSize: 13, fontWeight: 600,
                  color: 'white', minWidth: 160, textAlign: 'center',
                }}>
                  {monthLabel}
                </span>
                <button
                  onClick={() => navigate(1)}
                  disabled={isCurrentMonth}
                  style={{
                    padding: '9px 13px', border: 'none', background: 'transparent',
                    color: isCurrentMonth ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.50)',
                    cursor: isCurrentMonth ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center',
                    borderLeft: '1px solid rgba(255,255,255,0.07)',
                    transition: 'color 0.12s',
                  }}
                  onMouseEnter={(e) => { if (!isCurrentMonth) e.currentTarget.style.color = 'white' }}
                  onMouseLeave={(e) => { if (!isCurrentMonth) e.currentTarget.style.color = 'rgba(255,255,255,0.50)' }}
                >
                  <ChevronRight size={15} />
                </button>
              </div>

              {/* Search */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 9, flex: 1, maxWidth: 340,
                background: '#0A0F1E', border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 10, padding: '9px 14px',
              }}>
                <Search size={14} color="rgba(255,255,255,0.28)" />
                <input
                  type="text"
                  placeholder="Search by code, location, or type…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    color: 'white', fontSize: 12.5,
                  }}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Count badge */}
              <span style={{
                fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 500, marginLeft: 'auto',
              }}>
                {filtered.length} incident{filtered.length !== 1 ? 's' : ''}{search ? ' found' : ''}
              </span>
            </div>

            {/* Table */}
            <div style={{
              background: '#0A0F1E',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 14, overflow: 'hidden',
            }}>

              {/* Empty state */}
              {filtered.length === 0 && (
                <div style={{ padding: '64px 24px', textAlign: 'center' }}>
                  <p style={{ fontSize: 28, marginBottom: 12, opacity: 0.25 }}>📋</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.30)' }}>
                    {search ? 'No incidents match your search' : `No incidents resolved in ${monthLabel}`}
                  </p>
                  {!search && (
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.18)', marginTop: 6 }}>
                      Try navigating to a different month
                    </p>
                  )}
                </div>
              )}

              {/* Date groups */}
              {Object.entries(byDate).map(([dateKey, dateIncs], groupIdx) => {
                // When searching, auto-expand all groups so results are visible
                const isDateExpanded = isSearchActive || expandedDates.has(dateKey)

                return (
                  <div key={dateKey} style={{ borderTop: groupIdx > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>

                    {/* Clickable date header */}
                    <button
                      onClick={() => toggleDate(dateKey)}
                      style={{
                        width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '12px 24px', background: 'rgba(0,0,0,0.18)', border: 'none', cursor: 'pointer',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.18)')}
                    >
                      <ChevronDown
                        size={14}
                        color="rgba(255,255,255,0.35)"
                        style={{
                          flexShrink: 0,
                          transform: isDateExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                          transition: 'transform 0.18s',
                        }}
                      />
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.65)', flex: 1 }}>
                        {dateKey}
                      </span>
                      <span style={{
                        fontSize: 11, color: 'rgba(255,255,255,0.28)',
                        background: 'rgba(255,255,255,0.06)',
                        padding: '2px 8px', borderRadius: 10,
                      }}>
                        {dateIncs.length} incident{dateIncs.length !== 1 ? 's' : ''}
                      </span>
                    </button>

                    {/* Incidents (shown when expanded) */}
                    {isDateExpanded && dateIncs.map((inc) => (
                      <IncidentRow
                        key={inc.id}
                        inc={inc}
                        expandedId={expandedId}
                        setExpandedId={setExpandedId}
                        responderMap={responderMap}
                      />
                    ))}
                  </div>
                )
              })}
            </div>
          </main>
        </div>
      </div>
    </>
  )
}

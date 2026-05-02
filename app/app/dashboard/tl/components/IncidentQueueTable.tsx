'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase/client'

type IncidentMedia = {
  id: string
  media_url: string
  media_type: 'photo' | 'video'
  description: string | null
}

export interface TLIncident {
  id: string
  incident_code: string
  emergency_type: 'crime' | 'medical'
  status: string
  citizen_address: string | null
  citizen_lat: number
  citizen_lng: number
  created_at: string
  assigned_responder_id: string | null
}

export interface ResolvedIncident {
  id: string
  incident_code: string
  emergency_type: string
  status: string
  citizen_address: string | null
  citizen_lat: number | null
  citizen_lng: number | null
  assigned_responder_id: string | null
  responder_profile?: { full_name: string } | null
  organizations?: { name: string } | null
  notes: string | null
  response_time_seconds: number | null
  resolved_at: string | null
  en_route_at: string | null
  arrived_at: string | null
  created_at: string
  responder_assigned_at?: string | null
  tl_assigned_at?: string | null
}

export interface TLResponder {
  id: string
  full_name: string
  is_on_duty: boolean
  last_known_lat: number | null
  last_known_lng: number | null
}

interface Props {
  incidents: TLIncident[]
  responders: TLResponder[]
  resolvedIncidents?: ResolvedIncident[]
  onAssign: (incident: TLIncident) => void
}

type Tab = 'all' | 'unassigned' | 'active' | 'escalated' | 'resolved'

const ACTIVE_STATUSES = ['assigned', 'en_route', 'arrived', 'pending_citizen_confirmation']

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  escalated: 'Escalated',
  assigned: 'Assigned',
  en_route: 'En Route',
  arrived: 'Arrived',
  pending_citizen_confirmation: 'Awaiting Confirm',
  resolved: 'Resolved',
  closed: 'Closed',
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-yellow-900/40 text-yellow-300 border border-yellow-700/40',
  escalated: 'bg-red-900/60 text-red-300 border border-red-600/60 animate-pulse',
  assigned: 'bg-blue-900/40 text-blue-300 border border-blue-700/40',
  en_route: 'bg-purple-900/40 text-purple-300 border border-purple-700/40',
  arrived: 'bg-teal-900/40 text-teal-300 border border-teal-700/40',
  pending_citizen_confirmation: 'bg-amber-900/40 text-amber-300 border border-amber-700/40',
  resolved: 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40',
  closed: 'bg-gray-800 text-gray-400 border border-gray-700',
}

function getElapsed(createdAt: string): string {
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}m ago`
}

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

function sortIncidents(list: TLIncident[]): TLIncident[] {
  return [...list].sort((a, b) => {
    const aEsc = a.status === 'escalated' ? 0 : 1
    const bEsc = b.status === 'escalated' ? 0 : 1
    if (aEsc !== bEsc) return aEsc - bEsc
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

function escapeHtml(str: string | null): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function exportIncidentPDF(inc: ResolvedIncident, responderName: string) {
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
    ? `<p>${escapeHtml(inc.notes)}</p>`
    : ''

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Incident Report — ${escapeHtml(inc.incident_code)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; padding: 48px; color: #111; font-size: 13px; }
    .header { border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: flex-end; }
    .header-left h1 { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
    .header-left p { color: #666; font-size: 12px; margin-top: 4px; }
    .header-right { text-align: right; font-size: 11px; color: #888; }
    .section { margin-bottom: 26px; }
    .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #888; margin-bottom: 10px; border-bottom: 1px solid #e5e5e5; padding-bottom: 5px; }
    .row { display: flex; gap: 12px; margin-bottom: 7px; }
    .label { color: #777; width: 150px; flex-shrink: 0; font-weight: 600; }
    .value { color: #111; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
    .badge-crime { background: #DBEAFE; color: #1E40AF; }
    .badge-medical { background: #D1FAE5; color: #065F46; }
    .timeline { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
    .timeline-item { background: #F3F4F6; padding: 4px 10px; border-radius: 6px; font-size: 12px; color: #444; }
    .footer { margin-top: 48px; padding-top: 12px; border-top: 1px solid #e5e5e5; font-size: 10px; color: #bbb; display: flex; justify-content: space-between; }
    @media print { body { padding: 24px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>Incident Report</h1>
      <p>${escapeHtml(inc.incident_code)} &nbsp;·&nbsp; ${resolvedDate}</p>
    </div>
    <div class="header-right">
      Guardian Dispatch<br/>Official Record
    </div>
  </div>

  <div class="section">
    <div class="section-title">Incident Details</div>
    <div class="row"><span class="label">Incident Code:</span><span class="value">${escapeHtml(inc.incident_code)}</span></div>
    <div class="row"><span class="label">Type:</span><span class="value"><span class="badge badge-${inc.emergency_type === 'crime' ? 'crime' : 'medical'}">${inc.emergency_type === 'crime' ? 'Crime' : 'Medical'}</span></span></div>
    <div class="row"><span class="label">Final Status:</span><span class="value">${escapeHtml(inc.status)}</span></div>
    <div class="row"><span class="label">Location:</span><span class="value">${escapeHtml(inc.citizen_address)}</span></div>
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

  ${inc.notes ? `
  <div class="section">
    <div class="section-title">Responder Report</div>
    ${reportRows || fallbackNotes}
  </div>
  ` : ''}

  <div class="footer">
    <span>Generated by Guardian Dispatch</span>
    <span>${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}</span>
  </div>
</body>
</html>`

  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }
}

// Reusable expandable row for resolved incidents (used in both All tab and Resolved Today tab)
function ResolvedRow({
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
  const responderName = inc.assigned_responder_id
    ? (inc.responder_profile?.full_name ?? responderMap[inc.assigned_responder_id] ?? 'Unknown')
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
    <div>
      <button
        onClick={() => setExpandedId(isExpanded ? null : inc.id)}
        className="w-full text-left px-4 py-3 hover:bg-gray-800/40 transition-colors flex items-center gap-3"
      >
        <span
          className="text-gray-500 text-xs shrink-0"
          style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.2s' }}
        >
          ▶
        </span>

        <span className="font-mono font-semibold text-white text-sm w-36 shrink-0">
          {inc.incident_code}
        </span>

        <span className={`inline-block text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${
          inc.emergency_type === 'crime'
            ? 'bg-blue-900/40 text-blue-300 border border-blue-700/40'
            : 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40'
        }`}>
          {inc.emergency_type === 'crime' ? 'Crime' : 'Medical'}
        </span>

        <span className="text-gray-400 text-sm flex-1 truncate">
          {report.what ?? inc.citizen_address ?? '—'}
        </span>

        <span className="text-gray-300 text-sm shrink-0 w-32 text-right">
          {responderName}
        </span>

        <span className="text-emerald-400 text-xs font-semibold shrink-0 w-20 text-right">
          {formatTs(inc.resolved_at)}
        </span>
      </button>

      {isExpanded && (
        <div className="mb-3 rounded-lg bg-gray-800/60 border border-gray-700 p-4 text-sm space-y-3">

          {/* Timeline */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Timeline</p>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="px-2 py-1 rounded bg-gray-900 text-gray-400">Created: {formatTs(inc.created_at)}</span>
              <span className="text-gray-600">→</span>
              <span className={`px-2 py-1 rounded ${inc.tl_assigned_at ? 'bg-sky-900/40 text-sky-300' : 'bg-gray-900 text-gray-600'}`}>
                Acknowledged: {formatTs(inc.tl_assigned_at ?? null)}
              </span>
              <span className="text-gray-600">→</span>
              <span className={`px-2 py-1 rounded ${inc.responder_assigned_at ? 'bg-blue-900/40 text-blue-300' : 'bg-gray-900 text-gray-600'}`}>
                Assigned: {formatTs(inc.responder_assigned_at ?? null)}
              </span>
              <span className="text-gray-600">→</span>
              <span className={`px-2 py-1 rounded ${inc.en_route_at ? 'bg-purple-900/40 text-purple-300' : 'bg-gray-900 text-gray-600'}`}>
                En Route: {formatTs(inc.en_route_at)}
              </span>
              <span className="text-gray-600">→</span>
              <span className={`px-2 py-1 rounded ${inc.arrived_at ? 'bg-teal-900/40 text-teal-300' : 'bg-gray-900 text-gray-600'}`}>
                Arrived: {formatTs(inc.arrived_at)}
              </span>
              <span className="text-gray-600">→</span>
              <span className="px-2 py-1 rounded bg-emerald-900/40 text-emerald-300">
                Resolved: {formatTs(inc.resolved_at)}
              </span>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex gap-6 flex-wrap">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Responder</p>
              <p className="text-white font-medium">{responderName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Response Time</p>
              <p className="text-amber-400 font-medium">{calcResponseTime(inc)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Final Status</p>
              <span className={`inline-block text-xs font-semibold px-2 py-1 rounded-full ${STATUS_STYLE[inc.status] ?? 'bg-gray-800 text-gray-400'}`}>
                {STATUS_LABEL[inc.status] ?? inc.status}
              </span>
            </div>
          </div>

          {/* Responder report */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Responder Report</p>
            {inc.notes ? (
              <div className="space-y-1.5 text-sm">
                {report.what && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 w-28 shrink-0">What:</span>
                    <span className="text-gray-200">{report.what}</span>
                  </div>
                )}
                {report.when && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 w-28 shrink-0">When:</span>
                    <span className="text-gray-200">{report.when}</span>
                  </div>
                )}
                {report.where && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 w-28 shrink-0">Where:</span>
                    <span className="text-gray-200">{report.where}</span>
                  </div>
                )}
                {report.who && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 w-28 shrink-0">Who:</span>
                    <span className="text-gray-200">{report.who}</span>
                  </div>
                )}
                {report.summary && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 w-28 shrink-0">Report/Summary:</span>
                    <span className="text-gray-200">{report.summary}</span>
                  </div>
                )}
                {!report.what && !report.when && !report.where && !report.who && !report.summary && (
                  <p className="text-gray-300">{inc.notes}</p>
                )}
              </div>
            ) : (
              <p className="text-gray-600 italic text-sm">No notes recorded by responder</p>
            )}
          </div>

          {/* Attached media */}
          {media.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
                Attached Media ({media.length})
              </p>
              <div className="flex gap-3 flex-wrap">
                {media.map((item) => (
                  <div key={item.id} className="flex flex-col gap-1.5" style={{ maxWidth: 100 }}>
                    {item.media_type === 'photo' ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); setLightboxUrl(item.media_url) }}
                        className="rounded-lg overflow-hidden border border-gray-600 cursor-pointer p-0 bg-transparent"
                        style={{ width: 90, height: 90 }}
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
                        className="rounded-lg border border-blue-700/40 bg-blue-900/20 flex flex-col items-center justify-center gap-1.5 no-underline"
                        style={{ width: 90, height: 90 }}
                      >
                        <span className="text-2xl">🎥</span>
                        <span className="text-xs text-blue-400 font-bold tracking-widest">VIDEO</span>
                      </a>
                    )}
                    {item.description && (
                      <p className="text-xs text-gray-500 leading-snug" style={{ maxWidth: 90 }}>{item.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PDF Export */}
          <div className="pt-1 flex justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation()
                exportIncidentPDF(inc, responderName)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors"
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
            style={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

export default function IncidentQueueTable({ incidents, responders, resolvedIncidents = [], onAssign }: Props) {
  const [tab, setTab] = useState<Tab>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedDateGroups, setExpandedDateGroups] = useState<Set<string>>(new Set())

  const responderMap = Object.fromEntries(responders.map((r) => [r.id, r.full_name]))

  // Derive today's resolved from the full month dataset
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const resolvedTodayList = resolvedIncidents.filter(
    (inc) => inc.resolved_at && new Date(inc.resolved_at) >= todayStart
  )

  // Group full month resolved by date for All tab
  const resolvedByDate = resolvedIncidents.reduce<Record<string, ResolvedIncident[]>>((acc, inc) => {
    const dateKey = inc.resolved_at
      ? new Date(inc.resolved_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : 'Unknown Date'
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(inc)
    return acc
  }, {})

  const toggleDateGroup = (dateKey: string) => {
    setExpandedDateGroups((prev) => {
      const next = new Set(prev)
      if (next.has(dateKey)) next.delete(dateKey)
      else next.add(dateKey)
      return next
    })
  }

  const filtered = sortIncidents(
    incidents.filter((inc) => {
      if (tab === 'unassigned') return !inc.assigned_responder_id
      if (tab === 'active') return ACTIVE_STATUSES.includes(inc.status)
      if (tab === 'escalated') return inc.status === 'escalated'
      return true
    })
  )

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: incidents.length },
    { key: 'unassigned', label: 'Unassigned', count: incidents.filter((i) => !i.assigned_responder_id).length },
    { key: 'active', label: 'Active', count: incidents.filter((i) => ACTIVE_STATUSES.includes(i.status)).length },
    { key: 'escalated', label: 'Escalated', count: incidents.filter((i) => i.status === 'escalated').length },
    { key: 'resolved', label: 'Resolved Today', count: resolvedTodayList.length },
  ]

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800">
      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 pt-4 pb-0 border-b border-gray-800 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors relative -mb-px ${
              tab === t.key
                ? 'bg-gray-800 text-white border border-gray-700 border-b-gray-800'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span
                className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                  t.key === 'escalated' && t.count > 0
                    ? 'bg-red-700 text-white'
                    : t.key === 'resolved'
                    ? 'bg-emerald-800 text-emerald-300'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Active incidents table — all tabs except Resolved Today */}
      {tab !== 'resolved' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-semibold">Code</th>
                <th className="text-left px-4 py-3 font-semibold">Type</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Location</th>
                <th className="text-left px-4 py-3 font-semibold">Responder</th>
                <th className="text-left px-4 py-3 font-semibold">Elapsed</th>
                <th className="text-right px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-gray-500 py-10">
                    No active incidents
                  </td>
                </tr>
              ) : (
                filtered.map((inc) => {
                  const canAssign = !inc.assigned_responder_id || inc.status === 'escalated'
                  const responderName = inc.assigned_responder_id
                    ? (responderMap[inc.assigned_responder_id] ?? 'Unknown')
                    : '—'

                  return (
                    <tr
                      key={inc.id}
                      className="border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-white">
                        {inc.incident_code}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block text-xs font-semibold px-2 py-1 rounded-full ${
                          inc.emergency_type === 'crime'
                            ? 'bg-blue-900/40 text-blue-300 border border-blue-700/40'
                            : 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40'
                        }`}>
                          {inc.emergency_type === 'crime' ? 'Crime' : 'Medical'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block text-xs font-semibold px-2 py-1 rounded-full ${
                            STATUS_STYLE[inc.status] ?? 'bg-gray-800 text-gray-400'
                          }`}
                        >
                          {STATUS_LABEL[inc.status] ?? inc.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 max-w-[180px] truncate">
                        {inc.citizen_address ?? `${inc.citizen_lat.toFixed(4)}, ${inc.citizen_lng.toFixed(4)}`}
                      </td>
                      <td className="px-4 py-3 text-gray-300">{responderName}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap" suppressHydrationWarning>
                        {getElapsed(inc.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canAssign ? (
                          <button
                            onClick={() => onAssign(inc)}
                            className="px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
                          >
                            Assign
                          </button>
                        ) : (
                          <a
                            href={`/dashboard/tl/incidents/${inc.id}`}
                            className="px-3 py-1.5 text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors"
                          >
                            View
                          </a>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* All tab — month-grouped resolved incidents below active table */}
      {tab === 'all' && (
        <div>
          {resolvedIncidents.length === 0 ? (
            <div className="text-center text-gray-600 py-6 text-sm border-t border-gray-800">
              No resolved incidents this month
            </div>
          ) : (
            <div className="border-t border-gray-800">
              {/* Section header */}
              <div className="px-4 py-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                  This Month&apos;s Resolved
                </p>
                <span className="text-xs text-gray-600">{resolvedIncidents.length} incident{resolvedIncidents.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Date groups */}
              {Object.entries(resolvedByDate).map(([dateKey, dateIncs]) => {
                const isGroupOpen = expandedDateGroups.has(dateKey)
                return (
                  <div key={dateKey} className="border-t border-gray-800/60">
                    {/* Date group header */}
                    <button
                      onClick={() => toggleDateGroup(dateKey)}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-800/20 transition-colors flex items-center gap-3"
                    >
                      <span
                        className="text-gray-600 text-xs shrink-0"
                        style={{ transform: isGroupOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.2s' }}
                      >
                        ▶
                      </span>
                      <span className="text-sm font-semibold text-gray-300">{dateKey}</span>
                      <span className="text-xs text-gray-600 ml-1">
                        — {dateIncs.length} incident{dateIncs.length !== 1 ? 's' : ''}
                      </span>
                    </button>

                    {/* Incidents inside date group */}
                    {isGroupOpen && (
                      <div className="divide-y divide-gray-800/60 bg-gray-900/20">
                        {dateIncs.map((inc) => (
                          <ResolvedRow
                            key={inc.id}
                            inc={inc}
                            expandedId={expandedId}
                            setExpandedId={setExpandedId}
                            responderMap={responderMap}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Resolved Today tab */}
      {tab === 'resolved' && (
        <div>
          {resolvedTodayList.length === 0 ? (
            <div className="text-center text-gray-500 py-12 text-sm">
              No incidents resolved today
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {resolvedTodayList.map((inc) => (
                <ResolvedRow
                  key={inc.id}
                  inc={inc}
                  expandedId={expandedId}
                  setExpandedId={setExpandedId}
                  responderMap={responderMap}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

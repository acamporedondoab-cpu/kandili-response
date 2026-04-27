'use client'

import { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '../lib/supabase/client'
import {
  LayoutDashboard, Siren, Settings, Truck,
  Bell, User, ChevronDown, LogOut, Eye,
  Radio, Clock, AlertTriangle, ChevronRight, History, CheckCircle2,
} from 'lucide-react'
import { logout } from '../lib/auth/actions'

const ViewLiveModal = dynamic(() => import('./ViewLiveModal'), { ssr: false })
const LiveIncidentMap = dynamic(() => import('./LiveIncidentMap'), { ssr: false })

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#10B981',
}

const STATUS_COLOR: Record<string, string> = {
  pending: '#F59E0B',
  escalated: '#EF4444',
  assigned: '#3B82F6',
  accepted: '#6366F1',
  en_route: '#8B5CF6',
  arrived: '#10B981',
  resolved: '#6B7280',
  closed: '#4B5563',
  pending_citizen_confirmation: '#A78BFA',
  acknowledged: '#06B6D4',
}

export type Incident = {
  id: string
  incident_code: string
  emergency_type: string
  status: string
  priority_level: string
  citizen_address: string | null
  citizen_lat: number
  citizen_lng: number
  created_at: string
  assigned_responder_id: string | null
  organizations: unknown
  responder_profile: { id: string; full_name: string; last_known_lat: number | null; last_known_lng: number | null } | null
}

type ViewLivePayload = {
  incident: Incident
  responder: { id: string; full_name: string; last_known_lat: number | null; last_known_lng: number | null } | null
}

function formatTime(d: Date): string {
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${date} \u2022 ${time}`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const INACTIVE_STATUSES = ['resolved', 'closed', 'pending_citizen_confirmation']

const TYPE_COLORS: Record<string, string> = {
  crime: '#3B82F6',
  medical: '#EF4444',
  fire: '#F97316',
  rescue: '#10B981',
  flood: '#06B6D4',
  accident: '#F59E0B',
}

const TYPE_LABELS: Record<string, string> = {
  crime: 'Police',
}

export default function DashboardClient({
  fullName,
  email,
  role,
  avgResponseSeconds,
  incidents,
  isAdmin,
  resolvedToday,
  timeline,
  typeCounts,
}: {
  fullName: string
  email: string
  role: string
  avgResponseSeconds: number | null
  incidents: Incident[]
  isAdmin: boolean
  resolvedToday: number
  timeline: { hour: number; count: number }[]
  typeCounts: { type: string; count: number }[]
}) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [viewLive, setViewLive] = useState<ViewLivePayload | null>(null)
  const [systemTime, setSystemTime] = useState('')
  const [liveIncidents, setLiveIncidents] = useState<Incident[]>(incidents)
  const [mapDark, setMapDark] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const activeCount = liveIncidents.filter(inc => !INACTIVE_STATUSES.includes(inc.status)).length
  const enRouteCount = liveIncidents.filter(inc => inc.status === 'en_route').length
  const criticalCount = liveIncidents.filter(inc =>
    inc.priority_level === 'critical' && !INACTIVE_STATUSES.includes(inc.status)
  ).length
  const highCount = liveIncidents.filter(inc =>
    inc.priority_level === 'high' && !INACTIVE_STATUSES.includes(inc.status)
  ).length
  const pendingDispatch = Math.max(0, activeCount - enRouteCount)

  useEffect(() => {
    setSystemTime(formatTime(new Date()))
    const tick = setInterval(() => setSystemTime(formatTime(new Date())), 60000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const sub = createClient()

    async function refetchAll() {
      const { data } = await sub
        .from('incidents')
        .select('id, incident_code, emergency_type, status, priority_level, citizen_address, citizen_lat, citizen_lng, created_at, assigned_responder_id, organizations!organization_id(name), responder_profile:profiles!assigned_responder_id(id, full_name, last_known_lat, last_known_lng)')
        .order('created_at', { ascending: false })
        .limit(10)
      if (data) setLiveIncidents(data as unknown as Incident[])
    }

    refetchAll()

    const channel = sub
      .channel('admin-dashboard-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incidents' }, async (payload) => {
        const inserted = payload.new as Incident
        setLiveIncidents((prev) => {
          if (prev.some((inc) => inc.id === inserted.id)) return prev
          return [{ ...inserted, organizations: null, responder_profile: null }, ...prev].slice(0, 10)
        })
        const { data } = await sub
          .from('incidents')
          .select('id, incident_code, emergency_type, status, priority_level, citizen_address, citizen_lat, citizen_lng, created_at, assigned_responder_id, organizations!organization_id(name), responder_profile:profiles!assigned_responder_id(id, full_name, last_known_lat, last_known_lng)')
          .eq('id', inserted.id)
          .single()
        if (data) {
          setLiveIncidents((prev) => prev.map((inc) => inc.id === data.id ? data as unknown as Incident : inc))
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'incidents' }, async (payload) => {
        const updated = payload.new as Incident
        setLiveIncidents((prev) => prev.map((inc) => inc.id === updated.id ? { ...inc, ...updated } : inc))
        if (updated.assigned_responder_id) {
          const { data } = await sub
            .from('incidents')
            .select('id, responder_profile:profiles!assigned_responder_id(id, full_name, last_known_lat, last_known_lng)')
            .eq('id', updated.id)
            .single()
          if (data) {
            setLiveIncidents((prev) => prev.map((inc) =>
              inc.id === data.id ? { ...inc, responder_profile: (data as unknown as { responder_profile: Incident['responder_profile'] }).responder_profile } : inc
            ))
          }
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'incidents' }, (payload) => {
        const deleted = payload.old as { id: string }
        setLiveIncidents((prev) => prev.filter((inc) => inc.id !== deleted.id))
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refetchAll()
      })

    // Poll every 10s — guards against realtime events dropped due to RLS
    // evaluation limitations on unfiltered postgres_changes subscriptions.
    const pollId = setInterval(refetchAll, 10000)

    return () => {
      clearInterval(pollId)
      sub.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isTL = role === 'team_leader' || role === 'super_admin'
  const isResponder = role === 'responder'

  const roleLabel = role === 'super_admin' ? 'Super Admin'
    : role === 'team_leader' ? 'Team Leader'
    : role === 'responder' ? 'Responder'
    : 'Dashboard'

  const avgDisplay = avgResponseSeconds
    ? `${Math.floor(avgResponseSeconds / 60).toString().padStart(2, '0')}:${(avgResponseSeconds % 60).toString().padStart(2, '0')} min`
    : '—'

  function handleViewLive(incident: Incident) {
    setViewLive({ incident, responder: incident.responder_profile ?? null })
  }

  return (
    <>
      <style>{`
        @keyframes pulse-ring {
          0%   { box-shadow: inset 0 0 40px rgba(239,68,68,0.10), 0 0 0 0 rgba(239,68,68,0.35); }
          60%  { box-shadow: inset 0 0 40px rgba(239,68,68,0.10), 0 0 0 7px rgba(239,68,68,0); }
          100% { box-shadow: inset 0 0 40px rgba(239,68,68,0.10), 0 0 0 0 rgba(239,68,68,0); }
        }
        @keyframes critical-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.60; }
        }
        @keyframes live-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.45; transform: scale(0.75); }
        }
        .dash-row:hover { background: rgba(255,255,255,0.026) !important; }
        .view-live-btn  { transition: all 0.14s ease; }
        .view-live-btn:hover {
          background: rgba(0,229,255,0.16) !important;
          border-color: rgba(0,229,255,0.50) !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(0,229,255,0.18);
        }
        .sb-link { transition: background 0.12s, color 0.12s; }
        .sb-link:hover:not(.sb-active) {
          background: rgba(255,255,255,0.05) !important;
          color: rgba(255,255,255,0.75) !important;
        }
        .dropdown-item { transition: background 0.10s; }
        .dropdown-item:hover { background: rgba(255,255,255,0.06) !important; }
      `}</style>

      <div style={{ display: 'flex', minHeight: '100vh', background: '#070B18', color: 'white', fontFamily: 'system-ui, sans-serif' }}>

        {/* ── Sidebar ── */}
        <aside style={{
          width: 220, flexShrink: 0, background: '#0A0F1E',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', flexDirection: 'column',
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 30,
        }}>
          {/* Brand */}
          <div style={{ padding: '20px 20px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Image src="/logo/kandili-logo.png" alt="Kandili" width={38} height={38} style={{ borderRadius: 8, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: 'white', letterSpacing: '-0.01em', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                  Kandili Response
                </p>
                <p style={{
                  fontSize: 10, color: 'rgba(0,229,255,0.55)',
                  letterSpacing: '0.11em', textTransform: 'uppercase',
                  marginTop: 4, lineHeight: 1,
                }}>
                  {roleLabel}
                </p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ padding: '14px 10px', flex: 1 }}>
            <p style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em',
              color: 'rgba(255,255,255,0.20)', textTransform: 'uppercase',
              padding: '0 10px', marginBottom: 6,
            }}>
              Navigation
            </p>
            <SidebarItem icon={<LayoutDashboard size={15} />} label="Overview" href="/dashboard" active />
            {role === 'team_leader' && <SidebarItem icon={<Siren size={15} />} label="Incident Center" href="/dashboard/tl" />}
            {isAdmin && <SidebarItem icon={<Siren size={15} />} label="Incident Center" href="/dashboard/incident-center" />}
            {isTL && <SidebarItem icon={<History size={15} />} label="Incident History" href="/dashboard/incident-history" />}
            {isAdmin && <SidebarItem icon={<Settings size={15} />} label="Admin Panel" href="/admin" />}
            {isResponder && <SidebarItem icon={<Truck size={15} />} label="Responder Hub" href="/dashboard/responder" />}
          </nav>
        </aside>

        {/* ── Main ── */}
        <div style={{ flex: 1, marginLeft: 220, display: 'flex', flexDirection: 'column' }}>

          {/* Top bar */}
          <header style={{
            height: 60, padding: '0 36px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(7,11,24,0.97)', backdropFilter: 'blur(14px)',
            position: 'sticky', top: 0, zIndex: 20,
          }}>
            <div>
              <h1 style={{ fontSize: 17, fontWeight: 700, color: 'white', lineHeight: 1 }}>Command Center</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', flexShrink: 0, animation: 'live-pulse 2s ease-in-out infinite' }} />
                <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.38)', fontVariantNumeric: 'tabular-nums' }}>{systemTime}</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button style={{
                width: 36, height: 36, borderRadius: 9,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'rgba(255,255,255,0.38)',
              }}>
                <Bell size={15} />
              </button>

              {/* Profile trigger */}
              <div ref={dropdownRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '5px 10px 5px 6px', borderRadius: 9,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: 'rgba(0,229,255,0.14)', border: '1px solid rgba(0,229,255,0.30)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <User size={12} color="#00E5FF" />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)', lineHeight: 1 }}>
                      {fullName}
                    </p>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.33)', lineHeight: 1, marginTop: 2 }}>
                      {email}
                    </p>
                  </div>
                  <ChevronDown size={11} color="rgba(255,255,255,0.28)" style={{ marginLeft: 2 }} />
                </button>

                {profileOpen && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                    width: 215, background: '#0D1325',
                    border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.75)', backdropFilter: 'blur(20px)',
                    overflow: 'hidden', zIndex: 50,
                  }}>
                    <div style={{ padding: '13px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{fullName}</p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.36)', marginTop: 2 }}>{email}</p>
                      <p style={{ fontSize: 9.5, color: 'rgba(0,229,255,0.48)', marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.10em' }}>
                        {roleLabel}
                      </p>
                    </div>
                    <div style={{ padding: '6px' }}>
                      <Link
                        href="/dashboard/profile"
                        className="dropdown-item"
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                          padding: '8px 10px', borderRadius: 7,
                          textDecoration: 'none',
                          color: 'rgba(255,255,255,0.55)', fontSize: 12.5, fontWeight: 500,
                        }}
                      >
                        <User size={13} /> Profile
                      </Link>
                      <form action={logout}>
                        <button
                          type="submit"
                          className="dropdown-item"
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                            padding: '8px 10px', borderRadius: 7, border: 'none',
                            background: 'transparent', cursor: 'pointer',
                            color: 'rgba(239,68,68,0.82)', fontSize: 12.5, fontWeight: 500,
                            textAlign: 'left',
                          }}
                        >
                          <LogOut size={13} /> Sign Out
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Page content */}
          <main style={{ padding: '34px 36px', flex: 1 }}>

            {/* Metric cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 24 }}>
              <MetricCard
                icon={<AlertTriangle size={19} />}
                iconColor="#EF4444"
                borderColor="#EF4444"
                label="Active Incidents"
                value={String(activeCount)}
                sub={activeCount === 0
                  ? 'No active alerts'
                  : `Critical: ${criticalCount} &nbsp;&middot;&nbsp; High: ${highCount}`}
                pulse={activeCount > 0}
              />
              <MetricCard
                icon={<Radio size={19} />}
                iconColor="#3B82F6"
                borderColor="#3B82F6"
                label="Units En Route"
                value={String(enRouteCount)}
                sub={pendingDispatch === 0
                  ? '0 pending dispatch'
                  : `${pendingDispatch} pending dispatch`}
              />
              <MetricCard
                icon={<Clock size={19} />}
                iconColor="#10B981"
                borderColor="#10B981"
                label="Avg Response Time"
                value={avgDisplay}
                sub={avgResponseSeconds ? 'Target: &lt; 7 min' : 'No data yet'}
              />
              <MetricCard
                icon={<CheckCircle2 size={19} />}
                iconColor="#22C55E"
                borderColor="#22C55E"
                label="Resolved Today"
                value={String(resolvedToday)}
                sub={resolvedToday === 0 ? 'No resolutions yet' : `${resolvedToday} incident${resolvedToday === 1 ? '' : 's'} closed`}
              />
            </div>

            {/* Insights row: live map + charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 18, marginBottom: 24 }}>

              {/* Live incident map */}
              <div style={{
                background: '#0A0F1E',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 14, overflow: 'hidden',
                height: 420,
              }}>
                <div style={{
                  padding: '14px 20px 10px',
                  borderBottom: '1px solid rgba(255,255,255,0.07)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <h2 style={{ fontSize: 13.5, fontWeight: 700, color: 'white', lineHeight: 1 }}>Live Incident Map</h2>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 3 }}>Active incidents &amp; responder locations</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Map style toggle */}
                    <div style={{
                      display: 'flex', borderRadius: 7, overflow: 'hidden',
                      border: '1px solid rgba(255,255,255,0.12)',
                    }}>
                      {(['Map', 'Dark'] as const).map((mode) => {
                        const active = (mode === 'Dark') === mapDark
                        return (
                          <button
                            key={mode}
                            onClick={() => setMapDark(mode === 'Dark')}
                            style={{
                              padding: '4px 11px',
                              fontSize: 11, fontWeight: 600,
                              border: 'none', cursor: 'pointer',
                              background: active ? 'rgba(0,229,255,0.15)' : 'transparent',
                              color: active ? '#00E5FF' : 'rgba(255,255,255,0.35)',
                            }}
                          >
                            {mode}
                          </button>
                        )
                      })}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', animation: 'live-pulse 2s ease-in-out infinite' }} />
                      <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>LIVE</span>
                    </div>
                  </div>
                </div>
                <div style={{ height: 'calc(100% - 51px)' }}>
                  <LiveIncidentMap
                    incidents={liveIncidents}
                    onPinClick={handleViewLive}
                    darkMode={mapDark}
                  />
                </div>
              </div>

              {/* Right column: type breakdown + activity chart stacked */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <TypeBreakdown typeCounts={typeCounts} />
                <ActivityChart timeline={timeline} />
              </div>

            </div>

            {/* Incidents table */}
            <div style={{
              background: '#0A0F1E',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 14, overflow: 'hidden',
            }}>
              <div style={{
                padding: '18px 24px',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>Recent Incidents</h2>
                  <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.28)', marginTop: 2 }}>
                    {isAdmin ? 'Last 10 incidents across all organizations' : 'Last 10 incidents in your organization'}
                  </p>
                </div>
                {isTL && (
                  <Link href="/dashboard/tl" style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: 12, fontWeight: 600, color: '#00E5FF',
                    textDecoration: 'none', opacity: 0.80,
                  }}>
                    Full queue <ChevronRight size={13} />
                  </Link>
                )}
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.18)' }}>
                      {['Code', 'Type', 'Priority', 'Location', 'Status', 'Organization', 'Responder', 'Time', ''].map(h => (
                        <th key={h} style={{
                          padding: '10px 20px', textAlign: 'left',
                          fontSize: 10, fontWeight: 700, letterSpacing: '0.10em',
                          color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase',
                          whiteSpace: 'nowrap',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {liveIncidents.length === 0 && (
                      <tr>
                        <td colSpan={9} style={{ padding: '48px 24px', textAlign: 'center', color: 'rgba(255,255,255,0.18)', fontSize: 13 }}>
                          No incidents recorded
                        </td>
                      </tr>
                    )}
                    {liveIncidents.map((inc, i) => {
                      const org = (inc.organizations as { name: string }[] | { name: string } | null)
                      const orgName = Array.isArray(org) ? org[0]?.name : (org as { name: string } | null)?.name
                      const priority = inc.priority_level ?? 'high'
                      const priorityColor = PRIORITY_COLOR[priority] ?? '#F97316'
                      const statusColor = STATUS_COLOR[inc.status] ?? '#6B7280'
                      const responder = inc.assigned_responder_id
                        ? (inc.responder_profile ?? null)
                        : null
                      const isCritical = priority === 'critical'

                      return (
                        <tr
                          key={inc.id}
                          className="dash-row"
                          style={{
                            borderBottom: i < liveIncidents.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                            transition: 'background 0.12s',
                          }}
                        >
                          <td style={{ padding: '12px 20px', fontSize: 12.5, fontWeight: 700, fontFamily: 'monospace', color: '#00E5FF', whiteSpace: 'nowrap' }}>
                            {inc.incident_code}
                          </td>
                          <td style={{ padding: '12px 20px', fontSize: 12.5, color: 'rgba(255,255,255,0.58)', textTransform: 'capitalize' }}>
                            {inc.emergency_type}
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            <span style={{
                              display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                              fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
                              background: `${priorityColor}22`, color: priorityColor,
                              border: `1px solid ${priorityColor}50`,
                              animation: isCritical ? 'critical-pulse 1.8s ease-in-out infinite' : 'none',
                            }}>
                              {priority}
                            </span>
                          </td>
                          <td style={{ padding: '12px 20px', fontSize: 12, color: 'rgba(255,255,255,0.40)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {inc.citizen_address ?? (inc.citizen_lat && inc.citizen_lng ? `${Number(inc.citizen_lat).toFixed(4)}, ${Number(inc.citizen_lng).toFixed(4)}` : '—')}
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            <span style={{
                              display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                              fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
                              background: `${statusColor}18`, color: statusColor,
                              border: `1px solid ${statusColor}35`,
                              whiteSpace: 'nowrap',
                            }}>
                              {inc.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td style={{ padding: '12px 20px', fontSize: 12, color: 'rgba(255,255,255,0.40)', whiteSpace: 'nowrap' }}>
                            {orgName ?? '—'}
                          </td>
                          <td style={{ padding: '12px 20px', fontSize: 12.5, color: responder ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.20)', whiteSpace: 'nowrap' }}>
                            {responder?.full_name ?? '—'}
                          </td>
                          <td style={{ padding: '12px 20px', fontSize: 11.5, color: 'rgba(255,255,255,0.28)', whiteSpace: 'nowrap' }}>
                            {timeAgo(inc.created_at)}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {!['resolved', 'closed'].includes(inc.status) && (
                              <button
                                className="view-live-btn"
                                onClick={() => handleViewLive(inc)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 5,
                                  padding: '5px 13px', borderRadius: 7,
                                  background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.24)',
                                  cursor: 'pointer', color: '#00E5FF', fontSize: 11.5, fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <Eye size={12} /> View Live
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        </div>

        {viewLive && (
          <ViewLiveModal
            incident={viewLive.incident}
            responder={viewLive.responder}
            onClose={() => setViewLive(null)}
          />
        )}
      </div>
    </>
  )
}

function ActivityChart({ timeline }: { timeline: { hour: number; count: number }[] }) {
  const maxCount = Math.max(...timeline.map((b) => b.count), 1)
  const total = timeline.reduce((s, b) => s + b.count, 0)
  const now = new Date()

  return (
    <div style={{
      background: '#0A0F1E', border: '1px solid rgba(255,255,255,0.09)',
      borderRadius: 14, padding: '20px 24px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>24-Hour Activity</h2>
          <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.28)', marginTop: 2 }}>Incident volume by hour</p>
        </div>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', fontVariantNumeric: 'tabular-nums' }}>
          {total} incident{total !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
        {timeline.map((bucket, i) => {
          const barH = bucket.count === 0 ? 4 : Math.max(6, Math.round((bucket.count / maxCount) * 72))
          const isNewest = i === 23
          const opacity = bucket.count === 0 ? 0.12 : 0.25 + (bucket.count / maxCount) * 0.65
          return (
            <div
              key={i}
              title={`${bucket.count} incident${bucket.count !== 1 ? 's' : ''}`}
              style={{
                flex: 1, height: barH, borderRadius: 3, alignSelf: 'flex-end', cursor: 'default',
                background: isNewest
                  ? 'rgba(0,229,255,0.85)'
                  : `rgba(0,229,255,${opacity})`,
              }}
            />
          )
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        {[24, 18, 12, 6, 0].map((hoursAgo) => {
          const t = new Date(now.getTime() - hoursAgo * 3600000)
          const h = t.getHours()
          const ampm = h >= 12 ? 'PM' : 'AM'
          const h12 = h % 12 || 12
          return (
            <span key={hoursAgo} style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.25)', fontVariantNumeric: 'tabular-nums' }}>
              {hoursAgo === 0 ? 'Now' : `${h12}${ampm}`}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function TypeBreakdown({ typeCounts }: { typeCounts: { type: string; count: number }[] }) {
  const total = typeCounts.reduce((s, t) => s + t.count, 0)

  return (
    <div style={{
      background: '#0A0F1E', border: '1px solid rgba(255,255,255,0.09)',
      borderRadius: 14, padding: '20px 24px',
    }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>By Type</h2>
        <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.28)', marginTop: 2 }}>Last 24 hours</p>
      </div>

      {typeCounts.length === 0 ? (
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.20)', textAlign: 'center', padding: '20px 0' }}>
          No incidents in 24h
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {typeCounts.map(({ type, count }) => {
            const color = TYPE_COLORS[type.toLowerCase()] ?? '#6B7280'
            const pct = total > 0 ? Math.round((count / total) * 100) : 0
            return (
              <div key={type}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)', textTransform: 'capitalize' }}>{TYPE_LABELS[type.toLowerCase()] ?? type}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>{count}</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)' }}>
                  <div style={{ height: '100%', borderRadius: 2, background: color, width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MetricCard({
  icon, iconColor, borderColor, label, value, sub, pulse,
}: {
  icon: React.ReactNode
  iconColor: string
  borderColor: string
  label: string
  value: string
  sub: string
  pulse?: boolean
}) {
  return (
    <div style={{
      background: '#0B1020',
      borderRadius: 14, padding: '22px 24px',
      border: `1px solid ${borderColor}42`,
      borderLeft: `3px solid ${borderColor}`,
      animation: pulse ? 'pulse-ring 2.4s ease-out infinite' : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{
          fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.38)',
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          {label}
        </p>
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: `${iconColor}18`, border: `1px solid ${iconColor}32`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColor,
        }}>
          {icon}
        </div>
      </div>
      <p style={{ fontSize: 32, fontWeight: 800, color: 'white', lineHeight: 1, marginBottom: 8 }}>{value}</p>
      <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.30)' }} dangerouslySetInnerHTML={{ __html: sub }} />
    </div>
  )
}

function SidebarItem({ icon, label, href, active }: { icon: React.ReactNode; label: string; href: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`sb-link${active ? ' sb-active' : ''}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px', borderRadius: 8, marginBottom: 2,
        textDecoration: 'none',
        background: active ? 'rgba(0,229,255,0.12)' : 'transparent',
        color: active ? '#00E5FF' : 'rgba(255,255,255,0.42)',
        fontSize: 13, fontWeight: active ? 600 : 400,
        borderLeft: active ? '3px solid #00E5FF' : '3px solid transparent',
      }}
    >
      {icon}
      {label}
    </Link>
  )
}

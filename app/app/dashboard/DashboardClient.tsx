'use client'

import { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import {
  LayoutDashboard, Siren, Settings, Truck,
  Bell, User, ChevronDown, LogOut, Eye,
  Radio, Clock, AlertTriangle, ChevronRight, History,
} from 'lucide-react'
import { logout } from '../lib/auth/actions'

const ViewLiveModal = dynamic(() => import('./ViewLiveModal'), { ssr: false })

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

type Incident = {
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
}

type Responder = {
  id: string
  full_name: string
  last_known_lat: number | null
  last_known_lng: number | null
}

type ViewLivePayload = {
  incident: Incident
  responder: Responder | null
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

export default function DashboardClient({
  fullName,
  email,
  role,
  activeIncidents,
  enRouteCount,
  criticalCount,
  highCount,
  avgResponseSeconds,
  incidents,
  responders,
  isAdmin,
}: {
  fullName: string
  email: string
  role: string
  activeIncidents: number
  enRouteCount: number
  criticalCount: number
  highCount: number
  avgResponseSeconds: number | null
  incidents: Incident[]
  responders: Responder[]
  isAdmin: boolean
}) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [viewLive, setViewLive] = useState<ViewLivePayload | null>(null)
  const [systemTime, setSystemTime] = useState(() => formatTime(new Date()))
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
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

  const isTL = role === 'team_leader' || role === 'super_admin'
  const isResponder = role === 'responder'

  const roleLabel = role === 'super_admin' ? 'Super Admin'
    : role === 'team_leader' ? 'Team Leader'
    : role === 'responder' ? 'Responder'
    : 'Dashboard'

  const avgDisplay = avgResponseSeconds
    ? `${Math.floor(avgResponseSeconds / 60).toString().padStart(2, '0')}:${(avgResponseSeconds % 60).toString().padStart(2, '0')} min`
    : '—'

  const pendingDispatch = Math.max(0, activeIncidents - enRouteCount)

  function handleViewLive(incident: Incident) {
    const responder = incident.assigned_responder_id
      ? (responders.find(r => r.id === incident.assigned_responder_id) ?? null)
      : null
    setViewLive({ incident, responder })
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginBottom: 36 }}>
              <MetricCard
                icon={<AlertTriangle size={19} />}
                iconColor="#EF4444"
                borderColor="#EF4444"
                label="Active Incidents"
                value={String(activeIncidents)}
                sub={activeIncidents === 0
                  ? 'No active alerts'
                  : `Critical: ${criticalCount} &nbsp;&middot;&nbsp; High: ${highCount}`}
                pulse={activeIncidents > 0}
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
                    {incidents.length === 0 && (
                      <tr>
                        <td colSpan={9} style={{ padding: '48px 24px', textAlign: 'center', color: 'rgba(255,255,255,0.18)', fontSize: 13 }}>
                          No incidents recorded
                        </td>
                      </tr>
                    )}
                    {incidents.map((inc, i) => {
                      const org = (inc.organizations as { name: string }[] | { name: string } | null)
                      const orgName = Array.isArray(org) ? org[0]?.name : (org as { name: string } | null)?.name
                      const priority = inc.priority_level ?? 'high'
                      const priorityColor = PRIORITY_COLOR[priority] ?? '#F97316'
                      const statusColor = STATUS_COLOR[inc.status] ?? '#6B7280'
                      const responder = inc.assigned_responder_id
                        ? responders.find(r => r.id === inc.assigned_responder_id)
                        : null
                      const isCritical = priority === 'critical'

                      return (
                        <tr
                          key={inc.id}
                          className="dash-row"
                          style={{
                            borderBottom: i < incidents.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
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

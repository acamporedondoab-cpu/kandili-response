'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  LayoutDashboard, Siren, Settings, Truck,
  History, TrendingUp, ChevronLeft, ChevronRight,
  User, Trophy, Clock, CheckCircle2, Zap, Activity,
} from 'lucide-react'
import { logout } from '../../lib/auth/actions'

// ── Types ──────────────────────────────────────────────────────────────────

type Props = {
  view: 'week' | 'month'
  endDate: string  // YYYY-MM-DD — last day of window (inclusive); for month = last day of month
  totalResolved: number
  totalWithTime: number
  avgSeconds: number | null
  fastestSeconds: number | null
  slowestSeconds: number | null
  dailyAvg: { day: string; avgSeconds: number; count: number }[]
  typeAvg: { type: string; avgSeconds: number; count: number }[]
  leaderboard: { name: string; avgSeconds: number; count: number }[]
  orgAvg: { org: string; avgSeconds: number; count: number }[]
  isAdmin: boolean
  role: string
  fullName: string
  email: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatSecs(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  if (m > 0) return `${m}m ${sec.toString().padStart(2, '0')}s`
  return `${sec}s`
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Week helpers
function weekRangeLabel(endDateStr: string): string {
  const end = parseDate(endDateStr)
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`
}

function prevWeek(endDateStr: string): string {
  const d = parseDate(endDateStr)
  return toDateStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7))
}

function nextWeek(endDateStr: string): string {
  const d = parseDate(endDateStr)
  return toDateStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7))
}

function isAtLatestWeek(endDateStr: string): boolean {
  const now = new Date()
  const yesterday = toDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  return endDateStr >= yesterday
}

// Month helpers
function monthLabel(endDateStr: string): string {
  const d = parseDate(endDateStr)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function prevMonth(endDateStr: string): string {
  const d = parseDate(endDateStr)
  // last day of the month before d's month
  return toDateStr(new Date(d.getFullYear(), d.getMonth(), 0))
}

function nextMonth(endDateStr: string): string {
  const d = parseDate(endDateStr)
  // last day of the month after d's month
  return toDateStr(new Date(d.getFullYear(), d.getMonth() + 2, 0))
}

function isAtLatestMonth(endDateStr: string): boolean {
  const now = new Date()
  // last day of current month
  const lastDayCurrent = toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  return endDateStr >= lastDayCurrent
}

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

// ── Sub-components ──────────────────────────────────────────────────────────

function SidebarItem({
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
      className="sb-link"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 12px', borderRadius: 8, marginBottom: 2,
        color: active ? 'white' : 'rgba(255,255,255,0.42)',
        background: active ? 'rgba(255,255,255,0.07)' : 'transparent',
        textDecoration: 'none', fontSize: 13, fontWeight: active ? 600 : 400,
      }}
    >
      {icon}
      {label}
    </Link>
  )
}

function StatCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  color: string
}) {
  return (
    <div style={{
      background: '#0A0F1E', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: '18px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: `${color}18`, border: `1px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ color }}>{icon}</span>
        </div>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </p>
      </div>
      <p style={{ fontSize: 26, fontWeight: 700, color: 'white', lineHeight: 1, letterSpacing: '-0.02em' }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 5 }}>{sub}</p>
      )}
    </div>
  )
}

function DailyLineChart({
  data,
  view,
}: {
  data: { day: string; avgSeconds: number; count: number }[]
  view: 'week' | 'month'
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const n = data.length
  const W = 560
  const H = 170
  const PAD = { top: 18, right: 16, bottom: 32, left: 54 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const hasAnyData = data.some((d) => d.count > 0)
  const maxSec = Math.max(...data.filter((d) => d.count > 0).map((d) => d.avgSeconds), 60)
  const yMax = Math.ceil(maxSec / 60) * 60

  const xOf = (i: number) => PAD.left + (i / Math.max(n - 1, 1)) * chartW
  const yOf = (s: number) => PAD.top + (1 - s / yMax) * chartH
  const baseY = H - PAD.bottom

  // Hit area half-width — narrower for month so adjacent slots don't overlap
  const slotW = n > 1 ? chartW / (n - 1) : chartW
  const hitHalfW = Math.min(18, Math.floor(slotW / 2))

  // Dot radius — slightly smaller in month view to avoid clutter
  const dotR = view === 'month' ? 2.5 : 3.5
  const dotRHover = view === 'month' ? 4.5 : 5.5

  // Build consecutive data segments (skip days with no data)
  const segments: { x: number; y: number }[][] = []
  let seg: { x: number; y: number }[] = []
  for (let i = 0; i < n; i++) {
    if (data[i].count > 0) {
      seg.push({ x: xOf(i), y: yOf(data[i].avgSeconds) })
    } else {
      if (seg.length > 0) { segments.push(seg); seg = [] }
    }
  }
  if (seg.length > 0) segments.push(seg)

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    s: Math.round(f * yMax),
    y: yOf(f * yMax),
  }))

  function dayLabel(dayStr: string): string {
    const d = parseDate(dayStr)
    if (view === 'week') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return String(d.getDate())
  }

  // Month view: only label days 1, 8, 15, 22 and last day
  function showLabel(i: number): boolean {
    if (view === 'week') return true
    return i === 0 || (i + 1) % 7 === 1 || i === n - 1
  }

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: H, display: 'block', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#00E5FF" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Y-axis grid lines + labels */}
        {yTicks.map(({ s, y }) => (
          <g key={s}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
              stroke="rgba(255,255,255,0.055)" strokeWidth={1} />
            <text x={PAD.left - 7} y={y + 3.5} textAnchor="end"
              fontSize={9} fill="rgba(255,255,255,0.28)" fontFamily="system-ui,sans-serif">
              {s === 0 ? '0' : formatSecs(s)}
            </text>
          </g>
        ))}

        {/* Fill + line for each consecutive data segment */}
        {segments.map((pts, si) => {
          if (pts.length === 0) return null
          const lp = pts.map((p, j) => `${j === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
          const fp = `${lp} L${pts[pts.length - 1].x.toFixed(1)},${baseY} L${pts[0].x.toFixed(1)},${baseY} Z`
          return (
            <g key={si}>
              <path d={fp} fill="url(#lineAreaGrad)" />
              <path d={lp} fill="none" stroke="rgba(0,229,255,0.85)" strokeWidth={2}
                strokeLinejoin="round" strokeLinecap="round" />
            </g>
          )
        })}

        {/* Per-day: dot (if data), ghost tick (if no data), X label */}
        {data.map((d, i) => {
          const x = xOf(i)
          const hasData = d.count > 0
          const isHovered = hoverIdx === i
          const y = hasData ? yOf(d.avgSeconds) : baseY

          return (
            <g key={i}>
              {/* Hover guide */}
              {isHovered && hasData && (
                <line x1={x} y1={PAD.top} x2={x} y2={baseY}
                  stroke="rgba(0,229,255,0.18)" strokeWidth={1} strokeDasharray="3,3" />
              )}

              {/* Interactive hit area */}
              <rect
                x={x - hitHalfW} y={PAD.top} width={hitHalfW * 2} height={chartH}
                fill="transparent"
                onMouseEnter={() => hasData && setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                style={{ cursor: hasData ? 'default' : 'not-allowed' }}
              />

              {/* Dot — only if has data */}
              {hasData && (
                <circle cx={x} cy={y}
                  r={isHovered ? dotRHover : dotR}
                  fill={isHovered ? '#00E5FF' : '#0D1528'}
                  stroke="#00E5FF"
                  strokeWidth={isHovered ? 2 : 1.5}
                  style={{ pointerEvents: 'none' }}
                />
              )}

              {/* No-data tick mark */}
              {!hasData && (
                <circle cx={x} cy={baseY - 1} r={1.5}
                  fill="rgba(255,255,255,0.10)" />
              )}

              {/* X-axis label — always for week, sparse for month */}
              {showLabel(i) && (
                <text x={x} y={H - PAD.bottom + 18} textAnchor="middle"
                  fontSize={9} fontFamily="system-ui,sans-serif"
                  fill={isHovered ? 'rgba(0,229,255,0.80)' : hasData ? 'rgba(255,255,255,0.40)' : 'rgba(255,255,255,0.18)'}>
                  {dayLabel(d.day)}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Tooltip */}
      {hoverIdx !== null && data[hoverIdx].count > 0 && (() => {
        const d = data[hoverIdx]
        const x = xOf(hoverIdx)
        const y = yOf(d.avgSeconds)
        const leftPct = (x / W) * 100
        const isRight = leftPct > 65
        return (
          <div style={{
            position: 'absolute',
            top: Math.max(4, y - 62),
            left: `${leftPct}%`,
            transform: isRight ? 'translateX(calc(-100% - 6px))' : 'translateX(8px)',
            pointerEvents: 'none',
            background: '#0D1528',
            border: '1px solid rgba(0,229,255,0.28)',
            borderRadius: 8,
            padding: '8px 12px',
            whiteSpace: 'nowrap',
            boxShadow: '0 8px 28px rgba(0,0,0,0.60)',
          }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#00E5FF', marginBottom: 3 }}>
              {formatSecs(d.avgSeconds)}
            </p>
            <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.50)' }}>
              {parseDate(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {d.count} incident{d.count !== 1 ? 's' : ''}
            </p>
          </div>
        )
      })()}

      {/* No-data overlay */}
      {!hasAnyData && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.20)' }}>
            No response time data for this {view === 'week' ? 'week' : 'month'}
          </p>
        </div>
      )}
    </div>
  )
}

function TypeChart({ data, view }: { data: { type: string; avgSeconds: number; count: number }[]; view: 'week' | 'month' }) {
  if (data.length === 0) {
    return <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.20)', padding: '16px 0' }}>No data this {view === 'week' ? 'week' : 'month'}</p>
  }
  const maxSec = Math.max(...data.map((d) => d.avgSeconds), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map(({ type, avgSeconds, count }) => {
        const color = TYPE_COLORS[type.toLowerCase()] ?? '#6B7280'
        const label = TYPE_LABELS[type.toLowerCase()] ?? (type.charAt(0).toUpperCase() + type.slice(1))
        const pct = Math.round((avgSeconds / maxSec) * 100)
        return (
          <div key={type}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,0.75)' }}>{label}</span>
                <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.28)' }}>{count} incidents</span>
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'white', fontVariantNumeric: 'tabular-nums' }}>
                {formatSecs(avgSeconds)}
              </span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.07)' }}>
              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: color, opacity: 0.75 }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Leaderboard({ data, view }: { data: { name: string; avgSeconds: number; count: number }[]; view: 'week' | 'month' }) {
  if (data.length === 0) {
    return <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.20)', padding: '16px 0' }}>No responder data this {view === 'week' ? 'week' : 'month'}</p>
  }

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map(({ name, avgSeconds, count }, i) => (
        <div
          key={name}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 14px', borderRadius: 10,
            background: i === 0 ? 'rgba(251,191,36,0.06)' : 'rgba(255,255,255,0.025)',
            border: i === 0 ? '1px solid rgba(251,191,36,0.18)' : '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: i < 3 ? 14 : 11, fontWeight: 700,
            color: i < 3 ? 'white' : 'rgba(255,255,255,0.35)',
          }}>
            {i < 3 ? medals[i] : `${i + 1}`}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {name}
            </p>
            <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.28)', marginTop: 1 }}>
              {count} incident{count !== 1 ? 's' : ''}
            </p>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: i === 0 ? '#FBE34F' : 'rgba(255,255,255,0.75)', fontVariantNumeric: 'tabular-nums' }}>
              {formatSecs(avgSeconds)}
            </p>
            <p style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.22)', marginTop: 1 }}>avg response</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function OrgTable({ data, view }: { data: { org: string; avgSeconds: number; count: number }[]; view: 'week' | 'month' }) {
  if (data.length === 0) {
    return <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.20)', padding: '16px 0' }}>No data this {view === 'week' ? 'week' : 'month'}</p>
  }
  const maxSec = Math.max(...data.map((d) => d.avgSeconds), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map(({ org, avgSeconds, count }) => {
        const pct = Math.round((avgSeconds / maxSec) * 100)
        return (
          <div key={org}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div>
                <span style={{ fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,0.75)' }}>{org}</span>
                <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.28)', marginLeft: 8 }}>{count} incidents</span>
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'white', fontVariantNumeric: 'tabular-nums' }}>
                {formatSecs(avgSeconds)}
              </span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.07)' }}>
              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: 'rgba(0,229,255,0.55)' }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function AnalyticsClient({
  view,
  endDate,
  totalResolved,
  totalWithTime,
  avgSeconds,
  fastestSeconds,
  slowestSeconds,
  dailyAvg,
  typeAvg,
  leaderboard,
  orgAvg,
  isAdmin,
  role,
  fullName,
  email,
}: Props) {
  const [profileOpen, setProfileOpen] = useState(false)

  const isTL = role === 'team_leader' || role === 'super_admin'
  const roleLabel = role === 'super_admin' ? 'Super Admin' : 'Team Leader'

  // Nav — differ by view
  const prev = view === 'week' ? prevWeek(endDate) : prevMonth(endDate)
  const next = view === 'week' ? nextWeek(endDate) : nextMonth(endDate)
  const atLatest = view === 'week' ? isAtLatestWeek(endDate) : isAtLatestMonth(endDate)
  const navLabel = view === 'week' ? weekRangeLabel(endDate) : monthLabel(endDate)
  const subtitle = view === 'week'
    ? `${weekRangeLabel(endDate)} · 7-day window`
    : `${monthLabel(endDate)} · Monthly view`

  return (
    <>
      <style>{`
        .sb-link { transition: background 0.12s, color 0.12s; }
        .sb-link:hover:not(.sb-active) {
          background: rgba(255,255,255,0.05) !important;
          color: rgba(255,255,255,0.75) !important;
        }
        .dropdown-item { transition: background 0.10s; }
        .dropdown-item:hover { background: rgba(255,255,255,0.06) !important; }
        .nav-btn:hover { background: rgba(255,255,255,0.08) !important; }
      `}</style>

      <div style={{ display: 'flex', minHeight: '100vh', background: '#070B18', color: 'white', fontFamily: 'system-ui, sans-serif' }}>

        {/* ── Sidebar ── */}
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
                  {roleLabel}
                </p>
              </div>
            </div>
          </div>

          <nav style={{ padding: '14px 10px', flex: 1 }}>
            <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.20)', textTransform: 'uppercase', padding: '0 10px', marginBottom: 6 }}>
              Navigation
            </p>
            <SidebarItem icon={<LayoutDashboard size={15} />} label="Overview" href="/dashboard" />
            {role === 'team_leader' && <SidebarItem icon={<Siren size={15} />} label="Incident Center" href="/dashboard/tl" />}
            {isAdmin && <SidebarItem icon={<Siren size={15} />} label="Incident Center" href="/dashboard/incident-center" />}
            {isTL && <SidebarItem icon={<History size={15} />} label="Incident History" href="/dashboard/incident-history" />}
            {isTL && <SidebarItem icon={<TrendingUp size={15} />} label="Analytics" href="/dashboard/analytics" active />}
            {isAdmin && <SidebarItem icon={<Settings size={15} />} label="Admin Panel" href="/admin" />}
          </nav>

          <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <button
              onClick={() => logout()}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                padding: '7px 12px', borderRadius: 8, background: 'transparent',
                border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', fontSize: 13,
              }}
            >
              <Truck size={14} />
              Sign Out
            </button>
          </div>
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
              <h1 style={{ fontSize: 17, fontWeight: 700, color: 'white', lineHeight: 1 }}>Response Time Analytics</h1>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                {subtitle}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

              {/* View toggle */}
              <div style={{
                display: 'flex', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 9, padding: 3, gap: 2,
              }}>
                <Link href={`/dashboard/analytics?view=week&end=${endDate}`} style={{ textDecoration: 'none' }}>
                  <button style={{
                    padding: '4px 13px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    background: view === 'week' ? 'rgba(0,229,255,0.15)' : 'transparent',
                    border: view === 'week' ? '1px solid rgba(0,229,255,0.28)' : '1px solid transparent',
                    color: view === 'week' ? '#00E5FF' : 'rgba(255,255,255,0.38)',
                    cursor: 'pointer', transition: 'all 0.12s',
                  }}>7-Day</button>
                </Link>
                <Link href={`/dashboard/analytics?view=month&end=${endDate}`} style={{ textDecoration: 'none' }}>
                  <button style={{
                    padding: '4px 13px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    background: view === 'month' ? 'rgba(0,229,255,0.15)' : 'transparent',
                    border: view === 'month' ? '1px solid rgba(0,229,255,0.28)' : '1px solid transparent',
                    color: view === 'month' ? '#00E5FF' : 'rgba(255,255,255,0.38)',
                    cursor: 'pointer', transition: 'all 0.12s',
                  }}>Monthly</button>
                </Link>
              </div>

              {/* Period navigator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Link href={`/dashboard/analytics?view=${view}&end=${prev}`}>
                  <button className="nav-btn" style={{
                    width: 30, height: 30, borderRadius: 7,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'rgba(255,255,255,0.50)',
                  }}>
                    <ChevronLeft size={14} />
                  </button>
                </Link>
                <span style={{
                  fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.65)',
                  minWidth: view === 'week' ? 130 : 110, textAlign: 'center',
                }}>
                  {navLabel}
                </span>
                <Link href={`/dashboard/analytics?view=${view}&end=${next}`}>
                  <button className="nav-btn" disabled={atLatest} style={{
                    width: 30, height: 30, borderRadius: 7,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: atLatest ? 'not-allowed' : 'pointer',
                    color: atLatest ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.50)',
                  }}>
                    <ChevronRight size={14} />
                  </button>
                </Link>
              </div>

              {/* Profile */}
              <div style={{ position: 'relative' }}>
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
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)', lineHeight: 1 }}>{fullName}</p>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.33)', lineHeight: 1, marginTop: 2 }}>{email}</p>
                  </div>
                </button>

                {profileOpen && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                    width: 200, background: '#0D1325',
                    border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.75)', backdropFilter: 'blur(20px)',
                    overflow: 'hidden', zIndex: 50,
                  }}>
                    <div style={{ padding: '13px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{fullName}</p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.36)', marginTop: 2 }}>{email}</p>
                    </div>
                    <div style={{ padding: '6px' }}>
                      <button
                        className="dropdown-item"
                        onClick={() => logout()}
                        style={{
                          width: '100%', padding: '8px 10px', borderRadius: 7,
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 8,
                          color: 'rgba(239,68,68,0.80)', fontSize: 12.5, textAlign: 'left',
                        }}
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Content */}
          <main style={{ padding: '28px 36px', flex: 1 }}>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              <StatCard
                icon={<CheckCircle2 size={14} />}
                label="Incidents Resolved"
                value={String(totalResolved)}
                sub={totalWithTime < totalResolved ? `${totalWithTime} of ${totalResolved} have timing data` : 'all have timing data'}
                color="#10B981"
              />
              <StatCard
                icon={<Activity size={14} />}
                label="Avg Response Time"
                value={avgSeconds !== null ? formatSecs(avgSeconds) : '—'}
                sub={totalWithTime > 0 ? `across ${totalWithTime} timed incident${totalWithTime !== 1 ? 's' : ''}` : 'no timing data'}
                color="#00E5FF"
              />
              <StatCard
                icon={<Zap size={14} />}
                label="Fastest Response"
                value={fastestSeconds !== null ? formatSecs(fastestSeconds) : '—'}
                sub="best single incident"
                color="#F59E0B"
              />
              <StatCard
                icon={<Clock size={14} />}
                label="Slowest Response"
                value={slowestSeconds !== null ? formatSecs(slowestSeconds) : '—'}
                sub="longest single incident"
                color="#EF4444"
              />
            </div>

            {/* Charts row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18, marginBottom: 24 }}>

              {/* Daily avg chart */}
              <div style={{
                background: '#0A0F1E', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14, padding: '20px 22px',
              }}>
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 600, color: 'white' }}>Avg Response Time by Day</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 2 }}>
                    {navLabel} — hover a point for details
                  </p>
                </div>
                <DailyLineChart data={dailyAvg} view={view} />
              </div>

              {/* Type breakdown */}
              <div style={{
                background: '#0A0F1E', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14, padding: '20px 22px',
              }}>
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 600, color: 'white' }}>By Emergency Type</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 2 }}>Avg response per category</p>
                </div>
                <TypeChart data={typeAvg} view={view} />
              </div>

            </div>

            {/* Bottom row */}
            <div style={{ display: 'grid', gridTemplateColumns: isAdmin && orgAvg.length > 0 ? '1fr 1fr' : '1fr', gap: 18 }}>

              {/* Responder leaderboard */}
              <div style={{
                background: '#0A0F1E', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14, padding: '20px 22px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Trophy size={15} color="#FBE34F" />
                  <p style={{ fontSize: 13.5, fontWeight: 600, color: 'white' }}>Responder Leaderboard</p>
                  <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.25)', marginLeft: 'auto' }}>
                    fastest avg this {view === 'week' ? 'week' : 'month'}
                  </span>
                </div>
                <Leaderboard data={leaderboard} view={view} />
              </div>

              {/* Org breakdown (admin only) */}
              {isAdmin && orgAvg.length > 0 && (
                <div style={{
                  background: '#0A0F1E', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 14, padding: '20px 22px',
                }}>
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: 'white' }}>By Organization</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 2 }}>
                      Avg response time per unit
                    </p>
                  </div>
                  <OrgTable data={orgAvg} view={view} />
                </div>
              )}

            </div>

            {totalResolved === 0 && (
              <div style={{
                marginTop: 40, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 10,
              }}>
                <TrendingUp size={32} color="rgba(255,255,255,0.12)" />
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.25)' }}>
                  No resolved incidents for {navLabel}
                </p>
              </div>
            )}

          </main>
        </div>
      </div>
    </>
  )
}

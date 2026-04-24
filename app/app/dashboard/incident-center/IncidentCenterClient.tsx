'use client'

import { useState } from 'react'
import Link from 'next/link'

const TYPE_COLOR: Record<string, string> = {
  police: '#3B82F6',
  medical: '#10B981',
  fire: '#EF4444',
  rescue: '#F97316',
}

const TYPE_LABEL: Record<string, string> = {
  police: 'Police',
  medical: 'Medical',
  fire: 'Fire',
  rescue: 'Rescue',
}

type OrgRow = {
  org: { id: string; name: string; type: string; logo_url: string | null }
  tlName: string | null
  activeCount: number
}

export default function IncidentCenterClient({ orgData }: { orgData: OrgRow[] }) {
  const [search, setSearch] = useState('')

  const filtered = orgData.filter((row) =>
    row.org.name.toLowerCase().includes(search.toLowerCase())
  )

  const totalActive = orgData.reduce((s, r) => s + r.activeCount, 0)

  return (
    <>
      <style>{`
        .ic-card:hover { background: #0D1325 !important; border-color: rgba(255,255,255,0.14) !important; }
        .ic-btn:hover { background: rgba(0,229,255,0.14) !important; border-color: rgba(0,229,255,0.40) !important; }
        .ic-search:focus { outline: none; border-color: rgba(0,229,255,0.40) !important; }
      `}</style>

      <div style={{ padding: '34px 36px', fontFamily: 'system-ui, sans-serif', color: 'white', minHeight: '100vh', background: '#070B18' }}>

        {/* Header */}
        <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <a
              href="/dashboard"
              style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.70)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
            >
              ← Back to Dashboard
            </a>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'white', letterSpacing: '-0.02em', lineHeight: 1 }}>
              Incident Center
            </h1>
            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>
              {orgData.length} organization{orgData.length !== 1 ? 's' : ''} &nbsp;·&nbsp;
              <span style={{ color: totalActive > 0 ? '#F97316' : 'rgba(255,255,255,0.35)' }}>
                {totalActive} active incident{totalActive !== 1 ? 's' : ''}
              </span>
            </p>
          </div>

          {/* Search */}
          <input
            className="ic-search"
            type="text"
            placeholder="Search organizations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: 240, padding: '9px 14px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 9, color: 'white', fontSize: 13,
              transition: 'border-color 0.15s',
            }}
          />
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.22)', fontSize: 14 }}>
            No organizations found
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
          }}>
            {filtered.map(({ org, tlName, activeCount }) => {
              const color = TYPE_COLOR[org.type] ?? '#6B7280'
              const initials = org.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

              return (
                <div
                  key={org.id}
                  className="ic-card"
                  style={{
                    background: '#0B1020',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 14, padding: '18px 20px',
                    display: 'flex', flexDirection: 'column', gap: 16,
                    transition: 'background 0.12s, border-color 0.12s',
                  }}
                >
                  {/* Top row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {org.logo_url ? (
                      <img src={org.logo_url} alt={org.name}
                        style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{
                        width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                        background: `${color}20`, border: `2px solid ${color}40`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 700, color,
                      }}>
                        {initials}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {org.name}
                      </p>
                      <span style={{
                        display: 'inline-block', marginTop: 4,
                        padding: '2px 9px', borderRadius: 20,
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
                        background: color, color: 'white',
                      }}>
                        {TYPE_LABEL[org.type] ?? org.type}
                      </span>
                    </div>
                  </div>

                  {/* Info row */}
                  <div style={{
                    display: 'flex', gap: 0,
                    paddingTop: 14,
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    {/* TL */}
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <p style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.30)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 5 }}>
                        Team Leader
                      </p>
                      <p style={{ fontSize: 12.5, fontWeight: 500, color: tlName ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.25)' }}>
                        {tlName ?? 'Not assigned'}
                      </p>
                    </div>

                    <div style={{ width: 1, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

                    {/* Active incidents */}
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <p style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.30)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 5 }}>
                        Active Incidents
                      </p>
                      <p style={{
                        fontSize: 12.5, fontWeight: 700,
                        color: activeCount > 0 ? '#F97316' : 'rgba(255,255,255,0.28)',
                      }}>
                        {activeCount === 0 ? 'None' : activeCount}
                      </p>
                    </div>
                  </div>

                  {/* CTA */}
                  <Link
                    href={`/dashboard/incident-center/${org.id}`}
                    className="ic-btn"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      padding: '10px 14px', borderRadius: 8,
                      background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.22)',
                      color: '#00E5FF', fontSize: 12.5, fontWeight: 700,
                      textDecoration: 'none', letterSpacing: '0.01em',
                      transition: 'background 0.14s, border-color 0.14s',
                    }}
                  >
                    View Queue
                    <span style={{ fontSize: 15, opacity: 0.7 }}>›</span>
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

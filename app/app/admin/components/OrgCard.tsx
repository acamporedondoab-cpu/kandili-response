import Link from 'next/link'
import type { Organization } from '../../lib/types/organization'
import type { Profile } from '../../lib/types/profile'
import RemoveOrgButton from './RemoveOrgButton'

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

const MAX_RESPONDERS = 10

export default function OrgCard({
  org,
  tl,
  responderCount,
}: {
  org: Organization
  tl: Profile | null
  responderCount: number
}) {
  const typeColor = TYPE_COLOR[org.type] ?? '#6B7280'
  const initials = org.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  const pct = Math.round((responderCount / MAX_RESPONDERS) * 100)
  const barColor = responderCount >= MAX_RESPONDERS ? '#EF4444' : responderCount >= 7 ? '#F59E0B' : '#10B981'

  return (
    <div
      style={{
        background: '#0B1020',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Initials avatar */}
        {org.logo_url ? (
          <img
            src={org.logo_url}
            alt={org.name}
            style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: '50%',
              background: `${typeColor}20`,
              border: `2px solid ${typeColor}40`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
              fontWeight: 700,
              color: typeColor,
              flexShrink: 0,
              letterSpacing: '-0.02em',
            }}
          >
            {initials}
          </div>
        )}

        {/* Name */}
        <p
          style={{
            flex: 1,
            fontSize: 15,
            fontWeight: 700,
            color: 'white',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
          }}
        >
          {org.name}
        </p>

        {/* Type badge */}
        <span
          style={{
            flexShrink: 0,
            padding: '3px 10px',
            borderRadius: 20,
            fontSize: 10.5,
            fontWeight: 700,
            background: typeColor,
            color: 'white',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
          }}
        >
          {TYPE_LABEL[org.type]}
        </span>
      </div>

      {/* Info columns */}
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          paddingTop: 16,
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Team Leader */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="12" height="12" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>
              Team Leader
            </span>
          </div>
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              color: tl ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.28)',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {tl?.full_name ?? 'Not assigned'}
          </span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, background: 'rgba(255,255,255,0.07)', margin: '0 2px', flexShrink: 0 }} />

        {/* Area of Operation */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="12" height="12" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>
            </svg>
            <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>
              Area of Operation
            </span>
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,0.80)' }}>
            {org.coverage_radius_km} km radius
          </span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, background: 'rgba(255,255,255,0.07)', margin: '0 2px', flexShrink: 0 }} />

        {/* Responders */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="12" height="12" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>
              Responders
            </span>
          </div>
          <div style={{ width: '100%', paddingInline: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.80)' }}>
                {responderCount} / {MAX_RESPONDERS}
              </span>
              <span style={{ fontSize: 10, fontWeight: 600, color: barColor }}>
                {pct}%
              </span>
            </div>
            <div style={{ height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(pct, 100)}%`,
                  borderRadius: 99,
                  background: barColor,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Link
          href={`/admin/organizations/${org.id}`}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '11px 16px',
            borderRadius: 8,
            background: 'linear-gradient(135deg, #1A6BFF 0%, #0A3FCC 100%)',
            color: 'white',
            fontSize: 13,
            fontWeight: 700,
            textDecoration: 'none',
            letterSpacing: '0.01em',
          }}
        >
          Open Command
          <span style={{ fontSize: 16, lineHeight: 1, opacity: 0.8 }}>›</span>
        </Link>
        <RemoveOrgButton orgId={org.id} orgName={org.name} />
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import CreateMemberModal from './CreateMemberModal'
import type { Organization } from '../../lib/types/organization'
import type { Profile } from '../../lib/types/profile'

const TYPE_COLOR: Record<string, string> = {
  police: '#3B82F6', medical: '#EF4444', fire: '#F97316', rescue: '#10B981',
}
const TYPE_LABEL: Record<string, string> = {
  police: 'Police', medical: 'Medical', fire: 'Fire', rescue: 'Rescue',
}

export default function OrgDetailClient({
  org,
  tls,
  responders,
}: {
  org: Organization
  tls: Profile[]
  responders: Profile[]
}) {
  const [showAddMember, setShowAddMember] = useState(false)
  const router = useRouter()
  const typeColor = TYPE_COLOR[org.type] ?? '#6B7280'
  const initials = org.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  const handleMemberCreated = () => {
    setShowAddMember(false)
    router.refresh()
  }

  return (
    <div style={{ padding: '36px 40px' }}>
      {/* Back */}
      <Link
        href="/admin/organizations"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13, color: 'rgba(255,255,255,0.45)', textDecoration: 'none', marginBottom: 24,
        }}
      >
        ← Back to Organizations
      </Link>

      {/* Org Header */}
      <div
        style={{
          background: 'rgba(10,15,30,0.75)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14, padding: '24px 28px', marginBottom: 28,
          display: 'flex', alignItems: 'center', gap: 20, backdropFilter: 'blur(12px)',
        }}
      >
        {org.logo_url ? (
          <img src={org.logo_url} alt={org.name}
            style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: `${typeColor}22`, border: `2px solid ${typeColor}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700, color: typeColor, flexShrink: 0,
          }}>
            {initials}
          </div>
        )}
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 6 }}>{org.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11.5,
              fontWeight: 600, background: `${typeColor}18`, color: typeColor,
              border: `1px solid ${typeColor}30`, textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {TYPE_LABEL[org.type]}
            </span>
            <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.40)' }}>
              Coverage: {org.coverage_radius_km} km radius
            </span>
            <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.40)' }}>
              {org.base_lat.toFixed(4)}, {org.base_lng.toFixed(4)}
            </span>
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={() => setShowAddMember(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #00E5FF 0%, #3A86FF 100%)',
              color: 'white', fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 16 }}>+</span> Add Member
          </button>
        </div>
      </div>

      {/* Team Leaders */}
      <Section title="Team Leaders" badge={`${tls.length}`}>
        {tls.length === 0 ? (
          <EmptyState label="No team leaders assigned" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tls.map((tl) => (
              <MemberRow key={tl.id} member={tl} />
            ))}
          </div>
        )}
      </Section>

      {/* Responders */}
      <Section
        title="Responders"
        badge={`${responders.length} / 10`}
        badgeColor={responders.length >= 10 ? '#EF4444' : responders.length >= 7 ? '#F59E0B' : '#10B981'}
      >
        {responders.length === 0 ? (
          <EmptyState label="No responders assigned" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {responders.map((r) => (
              <ResponderCard key={r.id} responder={r} />
            ))}
          </div>
        )}
      </Section>

      {showAddMember && (
        <CreateMemberModal
          orgId={org.id}
          onClose={() => setShowAddMember(false)}
          onCreated={handleMemberCreated}
        />
      )}
    </div>
  )
}

function Section({
  title, badge, badgeColor = '#00E5FF', children,
}: {
  title: string; badge: string; badgeColor?: string; children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>{title}</h2>
        <span style={{
          padding: '2px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700,
          background: `${badgeColor}18`, color: badgeColor, border: `1px solid ${badgeColor}30`,
        }}>
          {badge}
        </span>
      </div>
      {children}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div style={{
      padding: '28px', textAlign: 'center',
      background: 'rgba(10,15,30,0.75)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12, color: 'rgba(255,255,255,0.28)', fontSize: 13,
    }}>
      {label}
    </div>
  )
}

function MemberRow({ member }: { member: Profile }) {
  const initials = member.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      background: 'rgba(10,15,30,0.75)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10, padding: '14px 18px', backdropFilter: 'blur(8px)',
    }}>
      {member.avatar_url ? (
        <img src={member.avatar_url} alt={member.full_name}
          style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover' }} />
      ) : (
        <div style={{
          width: 42, height: 42, borderRadius: '50%',
          background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, color: '#00E5FF',
        }}>
          {initials}
        </div>
      )}
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 2 }}>{member.full_name}</p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)' }}>{member.phone_number}</p>
      </div>
      {member.tl_priority && (
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
          background: member.tl_priority === 1 ? 'rgba(0,229,255,0.10)' : 'rgba(255,255,255,0.06)',
          color: member.tl_priority === 1 ? '#00E5FF' : 'rgba(255,255,255,0.40)',
          border: `1px solid ${member.tl_priority === 1 ? 'rgba(0,229,255,0.25)' : 'rgba(255,255,255,0.10)'}`,
        }}>
          {member.tl_priority === 1 ? 'Primary TL' : 'Backup TL'}
        </span>
      )}
    </div>
  )
}

function ResponderCard({ responder }: { responder: Profile }) {
  const initials = responder.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      background: 'rgba(10,15,30,0.75)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10, padding: '16px', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      {responder.avatar_url ? (
        <img src={responder.avatar_url} alt={responder.full_name}
          style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        <div style={{
          width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 700, color: '#818CF8',
        }}>
          {initials}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13.5, fontWeight: 600, color: 'white', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {responder.full_name}
        </p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)', marginBottom: 4 }}>{responder.phone_number}</p>
        <span style={{
          display: 'inline-block', fontSize: 10.5, fontWeight: 600,
          padding: '2px 7px', borderRadius: 20,
          background: responder.is_on_duty ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.06)',
          color: responder.is_on_duty ? '#10B981' : 'rgba(255,255,255,0.35)',
          border: `1px solid ${responder.is_on_duty ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.10)'}`,
        }}>
          {responder.is_on_duty ? 'On Duty' : 'Off Duty'}
        </span>
      </div>
    </div>
  )
}

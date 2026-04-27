'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import CreateMemberModal from './CreateMemberModal'
import EditOrgModal from './EditOrgModal'
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
  const [liveOrg, setLiveOrg] = useState<Organization>(org)
  const [showAddMember, setShowAddMember] = useState(false)
  const [showEditOrg, setShowEditOrg] = useState(false)
  const router = useRouter()
  const typeColor = TYPE_COLOR[liveOrg.type] ?? '#6B7280'
  const initials = liveOrg.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  const handleMemberCreated = () => {
    setShowAddMember(false)
    router.refresh()
  }

  const handleOrgSaved = (updated: Organization) => {
    setLiveOrg(updated)
    setShowEditOrg(false)
    router.refresh()
  }

  const tlsOnDuty = tls.filter((t) => t.is_on_duty)
  const tlsOffDuty = tls.filter((t) => !t.is_on_duty)
  const respondersOnDuty = responders.filter((r) => r.is_on_duty)
  const respondersOffDuty = responders.filter((r) => !r.is_on_duty)

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
        {liveOrg.logo_url ? (
          <img src={liveOrg.logo_url} alt={liveOrg.name}
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
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 6 }}>{liveOrg.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11.5,
              fontWeight: 600, background: `${typeColor}18`, color: typeColor,
              border: `1px solid ${typeColor}30`, textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {TYPE_LABEL[liveOrg.type]}
            </span>
            <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.40)' }}>
              Coverage: {liveOrg.coverage_radius_km} km radius
            </span>
            <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.40)' }}>
              {liveOrg.base_lat.toFixed(4)}, {liveOrg.base_lng.toFixed(4)}
            </span>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <button
            onClick={() => setShowEditOrg(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 18px', borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.80)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer',
            }}
          >
            ✎ Edit
          </button>
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
      <Section
        title="Team Leaders"
        badge={`${tls.length}`}
        summary={`${tlsOnDuty.length} on duty · ${tlsOffDuty.length} off duty`}
      >
        {tls.length === 0 ? (
          <EmptyState label="No team leaders assigned" />
        ) : (
          <>
            {tlsOnDuty.length > 0 && (
              <DutyGroup label="ON DUTY" color="#10B981" count={tlsOnDuty.length}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {tlsOnDuty.map((tl) => <MemberRow key={tl.id} member={tl} />)}
                </div>
              </DutyGroup>
            )}
            {tlsOffDuty.length > 0 && (
              <DutyGroup label="OFF DUTY" color="#6b7280" count={tlsOffDuty.length} dimmed>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {tlsOffDuty.map((tl) => <MemberRow key={tl.id} member={tl} />)}
                </div>
              </DutyGroup>
            )}
          </>
        )}
      </Section>

      {/* Responders */}
      <Section
        title="Responders"
        badge={`${responders.length} / 10`}
        badgeColor={responders.length >= 10 ? '#EF4444' : responders.length >= 7 ? '#F59E0B' : '#10B981'}
        summary={`${respondersOnDuty.length} on duty · ${respondersOffDuty.length} off duty`}
      >
        {responders.length === 0 ? (
          <EmptyState label="No responders assigned" />
        ) : (
          <>
            {respondersOnDuty.length > 0 && (
              <DutyGroup label="ON DUTY" color="#10B981" count={respondersOnDuty.length}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                  {respondersOnDuty.map((r) => <ResponderCard key={r.id} responder={r} />)}
                </div>
              </DutyGroup>
            )}
            {respondersOffDuty.length > 0 && (
              <DutyGroup label="OFF DUTY" color="#6b7280" count={respondersOffDuty.length} dimmed>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                  {respondersOffDuty.map((r) => <ResponderCard key={r.id} responder={r} />)}
                </div>
              </DutyGroup>
            )}
          </>
        )}
      </Section>

      {showAddMember && (
        <CreateMemberModal
          orgId={liveOrg.id}
          onClose={() => setShowAddMember(false)}
          onCreated={handleMemberCreated}
        />
      )}

      {showEditOrg && (
        <EditOrgModal
          org={liveOrg}
          tls={tls}
          onClose={() => setShowEditOrg(false)}
          onSaved={handleOrgSaved}
        />
      )}
    </div>
  )
}

function Section({
  title, badge, badgeColor = '#00E5FF', summary, children,
}: {
  title: string
  badge: string
  badgeColor?: string
  summary?: string
  children: React.ReactNode
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
        {summary && (
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)', marginLeft: 4 }}>{summary}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function DutyGroup({
  label, color, count, dimmed = false, children,
}: {
  label: string
  color: string
  count: number
  dimmed?: boolean
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 16, opacity: dimmed ? 0.55 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
        <span style={{ fontSize: 10.5, fontWeight: 700, color, letterSpacing: '0.10em' }}>{label}</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{count}</span>
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
  const dutyColor = member.is_on_duty ? '#10B981' : '#6b7280'
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: dutyColor }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: dutyColor }}>
            {member.is_on_duty ? 'On Duty' : 'Off Duty'}
          </span>
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

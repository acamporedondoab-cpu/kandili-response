'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import OrgCard from './OrgCard'
import CreateOrgModal from './CreateOrgModal'
import type { Organization } from '../../lib/types/organization'
import type { Profile } from '../../lib/types/profile'

export default function OrgGrid({
  orgs,
  members,
}: {
  orgs: Organization[]
  members: Profile[]
}) {
  const [showCreate, setShowCreate] = useState(false)
  const router = useRouter()

  const handleCreated = () => {
    setShowCreate(false)
    router.refresh()
  }

  return (
    <>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            borderRadius: 10,
            background: 'linear-gradient(135deg, #00E5FF 0%, #3A86FF 100%)',
            border: 'none',
            color: 'white',
            fontWeight: 700,
            fontSize: 13.5,
            cursor: 'pointer',
            letterSpacing: '0.02em',
          }}
        >
          <span style={{ fontSize: 16 }}>+</span> New Organization
        </button>
      </div>

      {/* Grid */}
      {orgs.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '64px 24px',
            background: 'rgba(10,15,30,0.75)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            color: 'rgba(255,255,255,0.35)',
            fontSize: 14,
          }}
        >
          No organizations yet. Create the first one.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 20,
          }}
        >
          {orgs.map((org) => {
            const orgMembers = members.filter((m) => m.organization_id === org.id)
            const tl = orgMembers.find((m) => m.role === 'team_leader' && m.tl_priority === 1)
            const responderCount = orgMembers.filter((m) => m.role === 'responder').length
            return (
              <OrgCard
                key={org.id}
                org={org}
                tl={tl ?? null}
                responderCount={responderCount}
              />
            )
          })}
        </div>
      )}

      {showCreate && (
        <CreateOrgModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
    </>
  )
}

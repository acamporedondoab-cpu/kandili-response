'use client'

import { useState } from 'react'
import { createMemberAction } from '../actions'
import CredentialsModal from './CredentialsModal'

const ROLE_OPTIONS = [
  { value: 'team_leader', label: 'Team Leader' },
  { value: 'responder', label: 'Responder' },
]

export default function CreateMemberModal({
  orgId,
  onClose,
  onCreated,
}: {
  orgId: string
  onClose: () => void
  onCreated: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<'team_leader' | 'responder'>('responder')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<{ email: string; tempPassword: string } | null>(null)

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('org_id', orgId)
    const result = await createMemberAction(formData)
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else if (result.credentials) {
      setCredentials(result.credentials)
    }
  }

  if (credentials) {
    return (
      <CredentialsModal
        email={credentials.email}
        tempPassword={credentials.tempPassword}
        onClose={() => {
          setCredentials(null)
          onCreated()
        }}
      />
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.70)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 24,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: 'rgba(10,15,30,0.96)',
          border: '1px solid rgba(0,229,255,0.18)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 460,
          boxShadow: '0 32px 80px rgba(0,0,0,0.65)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            position: 'sticky',
            top: 0,
            background: 'rgba(10,15,30,0.98)',
            zIndex: 10,
          }}
        >
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>Add Member</h2>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)', marginTop: 2 }}>
              Create a new team leader or responder
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'transparent', color: 'rgba(255,255,255,0.55)',
              cursor: 'pointer', fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
          {/* Role selector */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            {ROLE_OPTIONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value as typeof role)}
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: 8,
                  border: role === r.value
                    ? '1px solid rgba(0,229,255,0.40)'
                    : '1px solid rgba(255,255,255,0.10)',
                  background: role === r.value ? 'rgba(0,229,255,0.10)' : 'rgba(255,255,255,0.04)',
                  color: role === r.value ? '#00E5FF' : 'rgba(255,255,255,0.45)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
          <input type="hidden" name="role" value={role} />

          {/* Avatar upload — only for responder */}
          {role === 'responder' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18, padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
              <label style={{ cursor: 'pointer' }}>
                <div
                  style={{
                    width: 60, height: 60, borderRadius: '50%',
                    border: '2px dashed rgba(0,229,255,0.30)',
                    background: 'rgba(0,229,255,0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', flexShrink: 0,
                  }}
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 24, color: 'rgba(0,229,255,0.40)' }}>👤</span>
                  )}
                </div>
                <input type="file" name="avatar" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
              </label>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.70)', marginBottom: 2 }}>
                  Profile Photo
                </p>
                <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.35)' }}>
                  Optional · Click avatar to upload
                </p>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Full Name" name="full_name" type="text" placeholder="Juan dela Cruz" required />
            <Field label="Email" name="email" type="email" placeholder="juan@unit1.gov.ph" required />
            <Field label="Phone Number" name="phone_number" type="tel" placeholder="+639171234567" required />
            {role === 'team_leader' && (
              <div>
                <label style={labelStyle}>TL Priority</label>
                <select name="tl_priority" style={{ ...inputStyle, colorScheme: 'dark' }}>
                  <option value="1" style={{ background: '#0B1020', color: 'white' }}>1 — Primary TL</option>
                  <option value="2" style={{ background: '#0B1020', color: 'white' }}>2 — Backup TL</option>
                </select>
              </div>
            )}
          </div>

          {error && (
            <div
              style={{
                marginTop: 14, padding: '10px 14px', borderRadius: 8,
                background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)',
                color: '#FCA5A5', fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: '11px', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'transparent', color: 'rgba(255,255,255,0.55)',
                fontWeight: 600, fontSize: 13.5, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 2, padding: '11px', borderRadius: 10, border: 'none',
                background: loading ? 'rgba(0,229,255,0.30)' : 'linear-gradient(135deg, #00E5FF 0%, #3A86FF 100%)',
                color: 'white', fontWeight: 700, fontSize: 13.5,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Creating...' : 'Create & Generate Credentials'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: 'rgba(255,255,255,0.45)', marginBottom: 6,
  letterSpacing: '0.04em', textTransform: 'uppercase',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.05)',
  color: 'white', fontSize: 13.5, outline: 'none', boxSizing: 'border-box',
}

function Field({ label, name, type, placeholder, required }: {
  label: string; name: string; type: string; placeholder: string; required?: boolean
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input name={name} type={type} placeholder={placeholder} required={required} style={inputStyle} />
    </div>
  )
}

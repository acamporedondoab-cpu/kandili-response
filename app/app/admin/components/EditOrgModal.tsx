'use client'

import { useState } from 'react'
import { updateOrganization } from '../organizations/actions'
import type { Organization } from '../../lib/types/organization'
import type { Profile } from '../../lib/types/profile'

export default function EditOrgModal({
  org,
  tls,
  onClose,
  onSaved,
}: {
  org: Organization
  tls: Profile[]
  onClose: () => void
  onSaved: (updated: Organization) => void
}) {
  const currentPrimaryTlId = tls.find((t) => t.tl_priority === 1)?.id ?? tls[0]?.id ?? ''

  const [name, setName] = useState(org.name)
  const [coverageKm, setCoverageKm] = useState(String(org.coverage_radius_km))
  const [baseLat, setBaseLat] = useState(String(org.base_lat))
  const [baseLng, setBaseLng] = useState(String(org.base_lng))
  const [barangay, setBarangay] = useState(org.barangay ?? '')
  const [primaryTlId, setPrimaryTlId] = useState(currentPrimaryTlId)
  const [backupTlId, setBackupTlId] = useState(org.backup_tl_id ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsedCoverage = parseFloat(coverageKm)
    const parsedLat = parseFloat(baseLat)
    const parsedLng = parseFloat(baseLng)

    if (!name.trim()) { setError('Organization name is required.'); return }
    if (isNaN(parsedCoverage) || parsedCoverage <= 0) { setError('Coverage radius must be a positive number.'); return }
    if (isNaN(parsedLat) || isNaN(parsedLng)) { setError('Please enter valid coordinates.'); return }

    setLoading(true)
    setError(null)
    try {
      await updateOrganization({
        orgId: org.id,
        name: name.trim(),
        coverageRadiusKm: parsedCoverage,
        baseLat: parsedLat,
        baseLng: parsedLng,
        barangay: barangay.trim() || null,
        backupTlId: backupTlId || null,
        primaryTlId: primaryTlId || null,
      })
      onSaved({
        ...org,
        name: name.trim(),
        coverage_radius_km: parsedCoverage,
        base_lat: parsedLat,
        base_lng: parsedLng,
        barangay: barangay.trim() || null,
        backup_tl_id: backupTlId || null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update organization.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.70)',
        backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 50, padding: 24,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: 'rgba(10,15,30,0.96)', border: '1px solid rgba(0,229,255,0.18)',
          borderRadius: 16, width: '100%', maxWidth: 480,
          boxShadow: '0 32px 80px rgba(0,0,0,0.65)', maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
            position: 'sticky', top: 0, background: 'rgba(10,15,30,0.98)', zIndex: 10,
          }}
        >
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>Edit Organization</h2>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)', marginTop: 2 }}>
              Update details and team leader assignment
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

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Org Details */}
          <SectionLabel>Organization Details</SectionLabel>

          <Field label="Organization Name" value={name} onChange={setName} placeholder="Metro Police Unit 1" />

          <Field
            label="Barangay"
            value={barangay}
            onChange={setBarangay}
            placeholder="calumpang"
            hint="Lowercase, no prefix — e.g. calumpang, fatima"
          />

          <Field
            label="Coverage Radius (km)"
            value={coverageKm}
            onChange={setCoverageKm}
            placeholder="25"
            inputMode="decimal"
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="HQ Latitude" value={baseLat} onChange={setBaseLat} placeholder="14.5995" inputMode="decimal" />
            <Field label="HQ Longitude" value={baseLng} onChange={setBaseLng} placeholder="120.9842" inputMode="decimal" />
          </div>

          {/* TL Assignment */}
          {tls.length > 0 && (
            <>
              <SectionLabel style={{ marginTop: 4 }}>Team Leader Assignment</SectionLabel>

              <div>
                <label style={labelStyle}>Primary Team Leader</label>
                <select
                  value={primaryTlId}
                  onChange={(e) => setPrimaryTlId(e.target.value)}
                  style={{ ...inputStyle, colorScheme: 'dark' }}
                >
                  <option value="" style={{ background: '#0B1020' }}>— None —</option>
                  {tls.map((tl) => (
                    <option key={tl.id} value={tl.id} style={{ background: '#0B1020', color: 'white' }}>
                      {tl.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Backup TL <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: 400 }}>(receives escalation alerts)</span></label>
                <select
                  value={backupTlId}
                  onChange={(e) => setBackupTlId(e.target.value)}
                  style={{ ...inputStyle, colorScheme: 'dark' }}
                >
                  <option value="" style={{ background: '#0B1020' }}>— None —</option>
                  {tls.map((tl) => (
                    <option key={tl.id} value={tl.id} style={{ background: '#0B1020', color: 'white' }}>
                      {tl.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {error && (
            <div
              style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)',
                color: '#FCA5A5', fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
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
                background: loading
                  ? 'rgba(0,229,255,0.30)'
                  : 'linear-gradient(135deg, #00E5FF 0%, #3A86FF 100%)',
                color: 'white', fontWeight: 700, fontSize: 13.5,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p
      style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.10em',
        color: 'rgba(0,229,255,0.55)', textTransform: 'uppercase', ...style,
      }}
    >
      {children}
    </p>
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

function Field({
  label, value, onChange, placeholder, inputMode, hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  hint?: string
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        style={inputStyle}
      />
      {hint && (
        <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>{hint}</p>
      )}
    </div>
  )
}

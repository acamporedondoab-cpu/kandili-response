'use client'

import { useState, useRef } from 'react'
import { createOrganizationAction } from '../actions'

const ORG_TYPES = [
  { value: 'police', label: 'Police' },
  { value: 'medical', label: 'Medical' },
  { value: 'fire', label: 'Fire' },
  { value: 'rescue', label: 'Rescue' },
]

export default function CreateOrgModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setLogoPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    const result = await createOrganizationAction(formData)
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      onCreated()
    }
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
          maxWidth: 480,
          boxShadow: '0 32px 80px rgba(0,0,0,0.65)',
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
          }}
        >
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>New Organization</h2>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)', marginTop: 2 }}>
              Fill in details to create an organization
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.55)',
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form ref={formRef} onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
          {/* Logo upload */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
            <label style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  border: '2px dashed rgba(0,229,255,0.30)',
                  background: 'rgba(0,229,255,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 28, color: 'rgba(0,229,255,0.40)' }}>🏢</span>
                )}
              </div>
              <span style={{ fontSize: 12, color: 'rgba(0,229,255,0.70)', fontWeight: 500 }}>
                {logoPreview ? 'Change logo' : 'Upload logo (optional)'}
              </span>
              <input type="file" name="logo" accept="image/*" className="hidden" style={{ display: 'none' }} onChange={handleLogoChange} />
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Organization Name" name="name" type="text" placeholder="Metro Police Unit 1" required />

            {/* Type select */}
            <div>
              <label style={labelStyle}>Type</label>
              <select name="type" required style={{ ...inputStyle, colorScheme: 'dark' }}>
                <option value="" style={{ background: '#0B1020', color: 'rgba(255,255,255,0.40)' }}>Select type...</option>
                {ORG_TYPES.map((t) => (
                  <option key={t.value} value={t.value} style={{ background: '#0B1020', color: 'white' }}>{t.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Base Latitude" name="base_lat" type="number" placeholder="14.5995" step="any" required />
              <Field label="Base Longitude" name="base_lng" type="number" placeholder="120.9842" step="any" required />
            </div>

            <Field label="Coverage Radius (km)" name="coverage_radius_km" type="number" placeholder="10" step="any" required />
          </div>

          {error && (
            <div
              style={{
                marginTop: 14,
                padding: '10px 14px',
                borderRadius: 8,
                background: 'rgba(239,68,68,0.10)',
                border: '1px solid rgba(239,68,68,0.25)',
                color: '#FCA5A5',
                fontSize: 13,
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
                flex: 1,
                padding: '11px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'transparent',
                color: 'rgba(255,255,255,0.55)',
                fontWeight: 600,
                fontSize: 13.5,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 2,
                padding: '11px',
                borderRadius: 10,
                border: 'none',
                background: loading ? 'rgba(0,229,255,0.30)' : 'linear-gradient(135deg, #00E5FF 0%, #3A86FF 100%)',
                color: 'white',
                fontWeight: 700,
                fontSize: 13.5,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Creating...' : 'Create Organization'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.45)',
  marginBottom: 6,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.05)',
  color: 'white',
  fontSize: 13.5,
  outline: 'none',
  boxSizing: 'border-box',
}

function Field({
  label,
  name,
  type,
  placeholder,
  required,
  step,
}: {
  label: string
  name: string
  type: string
  placeholder: string
  required?: boolean
  step?: string
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        step={step}
        style={inputStyle}
      />
    </div>
  )
}

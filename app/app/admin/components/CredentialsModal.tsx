'use client'

import { useState } from 'react'

export default function CredentialsModal({
  email,
  tempPassword,
  onClose,
}: {
  email: string
  tempPassword: string
  onClose: () => void
}) {
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [copiedPass, setCopiedPass] = useState(false)

  const copy = async (text: string, which: 'email' | 'pass') => {
    await navigator.clipboard.writeText(text)
    if (which === 'email') {
      setCopiedEmail(true)
      setTimeout(() => setCopiedEmail(false), 2000)
    } else {
      setCopiedPass(true)
      setTimeout(() => setCopiedPass(false), 2000)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        padding: 24,
      }}
    >
      <div
        style={{
          background: 'rgba(10,15,30,0.98)',
          border: '1px solid rgba(0,229,255,0.22)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 32px 80px rgba(0,0,0,0.65)',
          padding: '28px 28px 24px',
          textAlign: 'center',
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(16,185,129,0.12)',
            border: '1px solid rgba(16,185,129,0.30)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            margin: '0 auto 16px',
          }}
        >
          ✅
        </div>

        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'white', marginBottom: 6 }}>
          Account Created
        </h2>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.45)', marginBottom: 24, lineHeight: 1.5 }}>
          Share these credentials with the member. The temporary password is shown only once.
        </p>

        {/* Credentials */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          <CredRow label="Email" value={email} copied={copiedEmail} onCopy={() => copy(email, 'email')} />
          <CredRow label="Temp Password" value={tempPassword} copied={copiedPass} onCopy={() => copy(tempPassword, 'pass')} mono />
        </div>

        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.22)',
            color: 'rgba(245,158,11,0.80)',
            fontSize: 12,
            marginBottom: 20,
            textAlign: 'left',
            lineHeight: 1.5,
          }}
        >
          ⚠️ The member should log in and change their password immediately.
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '11px',
            borderRadius: 10,
            border: 'none',
            background: 'linear-gradient(135deg, #00E5FF 0%, #3A86FF 100%)',
            color: 'white',
            fontWeight: 700,
            fontSize: 13.5,
            cursor: 'pointer',
          }}
        >
          Done
        </button>
      </div>
    </div>
  )
}

function CredRow({
  label,
  value,
  copied,
  onCopy,
  mono,
}: {
  label: string
  value: string
  copied: boolean
  onCopy: () => void
  mono?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div style={{ flex: 1, padding: '10px 14px', textAlign: 'left' }}>
        <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </p>
        <p
          style={{
            fontSize: 13.5,
            color: 'white',
            fontFamily: mono ? 'monospace' : 'inherit',
            fontWeight: mono ? 700 : 500,
            letterSpacing: mono ? '0.08em' : 'normal',
          }}
        >
          {value}
        </p>
      </div>
      <button
        onClick={onCopy}
        style={{
          padding: '0 16px',
          height: '100%',
          minHeight: 56,
          border: 'none',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          background: copied ? 'rgba(16,185,129,0.15)' : 'transparent',
          color: copied ? '#10B981' : 'rgba(0,229,255,0.70)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 200ms ease',
        }}
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  )
}

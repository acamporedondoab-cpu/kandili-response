'use client'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{
      display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center',
      background: '#070B18', color: 'white', fontFamily: 'system-ui, sans-serif',
      flexDirection: 'column', gap: 16, textAlign: 'center', padding: '0 24px',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: '50%',
        background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.30)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, marginBottom: 4,
      }}>
        ⚠
      </div>
      <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Failed to load dashboard</h2>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', margin: 0, maxWidth: 340, lineHeight: 1.5 }}>
        {error.message || 'An unexpected error occurred while fetching data.'}
      </p>
      <button
        onClick={() => reset()}
        style={{
          marginTop: 8, padding: '10px 28px', borderRadius: 10,
          background: 'linear-gradient(135deg, #00E5FF 0%, #3A86FF 100%)',
          border: 'none', color: 'white', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', letterSpacing: '0.04em',
        }}
      >
        Try Again
      </button>
    </div>
  )
}

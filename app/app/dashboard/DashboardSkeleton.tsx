export default function DashboardSkeleton() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#070B18', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -600px 0; }
          100% { background-position: 600px 0; }
        }
        .sk {
          background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.05) 75%);
          background-size: 600px 100%;
          animation: shimmer 1.6s infinite linear;
          border-radius: 8px;
        }
      `}</style>

      {/* Sidebar */}
      <aside style={{
        width: 220, flexShrink: 0, background: '#0A0F1E',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0,
      }}>
        {/* Brand */}
        <div style={{ padding: '20px 20px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="sk" style={{ width: 38, height: 38, borderRadius: 8, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="sk" style={{ height: 13, width: '80%', marginBottom: 7 }} />
            <div className="sk" style={{ height: 9, width: '50%' }} />
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="sk" style={{ height: 8, width: '40%', marginBottom: 8, borderRadius: 4 }} />
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ padding: '8px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="sk" style={{ width: 15, height: 15, borderRadius: 4, flexShrink: 0 }} />
              <div className="sk" style={{ height: 11, width: `${55 + i * 8}%` }} />
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, marginLeft: 220, display: 'flex', flexDirection: 'column' }}>

        {/* Top bar */}
        <header style={{
          height: 60, padding: '0 36px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(7,11,24,0.97)',
        }}>
          <div>
            <div className="sk" style={{ height: 14, width: 160, marginBottom: 6 }} />
            <div className="sk" style={{ height: 10, width: 110 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="sk" style={{ width: 32, height: 32, borderRadius: '50%' }} />
            <div className="sk" style={{ width: 80, height: 11 }} />
          </div>
        </header>

        {/* Body */}
        <main style={{ padding: '28px 36px', flex: 1 }}>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{
                background: '#0A0F1E',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14, padding: 20,
              }}>
                <div className="sk" style={{ height: 10, width: '55%', marginBottom: 14 }} />
                <div className="sk" style={{ height: 28, width: '40%', marginBottom: 10 }} />
                <div className="sk" style={{ height: 9, width: '70%' }} />
              </div>
            ))}
          </div>

          {/* Table card */}
          <div style={{
            background: '#0A0F1E',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16, overflow: 'hidden',
          }}>
            {/* Table header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="sk" style={{ height: 14, width: 160 }} />
              <div className="sk" style={{ height: 11, width: 80 }} />
            </div>

            {/* Table rows */}
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} style={{
                padding: '15px 24px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', gap: 16,
              }}>
                <div className="sk" style={{ width: 80, height: 10, flexShrink: 0 }} />
                <div className="sk" style={{ width: 60, height: 20, borderRadius: 20 }} />
                <div className="sk" style={{ width: 55, height: 20, borderRadius: 20 }} />
                <div className="sk" style={{ flex: 1, height: 10 }} />
                <div className="sk" style={{ width: 90, height: 10 }} />
                <div className="sk" style={{ width: 70, height: 28, borderRadius: 8 }} />
              </div>
            ))}
          </div>

        </main>
      </div>
    </div>
  )
}

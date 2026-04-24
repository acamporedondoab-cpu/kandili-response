'use client'

export default function StatCard({
  label,
  value,
  color,
  bg,
  border,
  sub,
}: {
  label: string
  value: string | number
  color: string
  bg: string
  border: string
  sub: string
}) {
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 16,
        padding: '22px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transition: 'transform 0.15s ease, filter 0.15s ease',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
        ;(e.currentTarget as HTMLDivElement).style.filter = 'brightness(1.1)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
        ;(e.currentTarget as HTMLDivElement).style.filter = 'brightness(1)'
      }}
    >
      <p style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
        {label}
      </p>
      <p style={{ fontSize: 36, fontWeight: 600, color, lineHeight: 1 }}>
        {value}
      </p>
      <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.28)', marginTop: 2 }}>
        {sub}
      </p>
    </div>
  )
}

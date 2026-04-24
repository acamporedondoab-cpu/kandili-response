'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { logout } from '../../lib/auth/actions'

const navItems = [
  { href: '/admin', label: 'Overview', icon: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  )},
  { href: '/admin/organizations', label: 'Organizations', icon: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/>
    </svg>
  )},
]

const backItem = { href: '/dashboard', label: 'Back to Dashboard', icon: (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M19 12H5M12 5l-7 7 7 7"/>
  </svg>
)}

export default function Sidebar({ adminName }: { adminName: string }) {
  const pathname = usePathname()

  return (
    <aside
      style={{
        width: 240,
        minHeight: '100vh',
        background: 'rgba(7,11,24,0.97)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div style={{ padding: '20px 20px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Image
            src="/logo/kandili-logo.png"
            alt="Kandili"
            width={38}
            height={38}
            style={{ borderRadius: 8, flexShrink: 0, objectFit: 'contain' }}
          />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'white', letterSpacing: '-0.01em', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
              Kandili Response
            </p>
            <p style={{ fontSize: 10, color: 'rgba(0,229,255,0.55)', letterSpacing: '0.11em', textTransform: 'uppercase', marginTop: 4, lineHeight: 1, fontWeight: 600 }}>
              Admin Panel
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 12px' }}>
        <p
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.10em',
            color: 'rgba(255,255,255,0.28)',
            textTransform: 'uppercase',
            padding: '4px 8px 12px',
          }}
        >
          Navigation
        </p>
        {navItems.map((item) => {
          const isActive =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                marginBottom: 2,
                textDecoration: 'none',
                fontSize: 13.5,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#00E5FF' : 'rgba(255,255,255,0.55)',
                background: isActive ? 'rgba(0,229,255,0.08)' : 'transparent',
                borderLeft: isActive ? '2px solid #00E5FF' : '2px solid transparent',
                transition: 'all 150ms ease',
              }}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Back to Dashboard */}
      <div style={{ padding: '0 12px 12px' }}>
        <Link
          href={backItem.href}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 8,
            textDecoration: 'none',
            fontSize: 13.5,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.40)',
            background: 'transparent',
            borderLeft: '2px solid transparent',
            transition: 'all 150ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.70)'
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.40)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          {backItem.icon}
          {backItem.label}
        </Link>
      </div>

      {/* Bottom — admin info + sign out */}
      <div
        style={{
          padding: '16px 20px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>
          Signed in as
        </p>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.80)', marginBottom: 12 }}>
          {adminName}
        </p>
        <form action={logout}>
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.55)',
              fontSize: 12.5,
              fontWeight: 500,
              cursor: 'pointer',
              letterSpacing: '0.02em',
            }}
          >
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  )
}

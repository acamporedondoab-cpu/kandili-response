'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { LayoutDashboard, Siren, Settings, History, TrendingUp, Truck, User, ArrowLeft, Check, X } from 'lucide-react'
import { updateProfileAction, updateEmailAction, updatePasswordAction } from './actions'

function SidebarLink({ icon, label, href, active }: { icon: React.ReactNode; label: string; href: string; active?: boolean }) {
  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px', borderRadius: 8, marginBottom: 2,
      textDecoration: 'none',
      background: active ? 'rgba(0,229,255,0.12)' : 'transparent',
      color: active ? '#00E5FF' : 'rgba(255,255,255,0.42)',
      fontSize: 13, fontWeight: active ? 600 : 400,
      borderLeft: active ? '3px solid #00E5FF' : '3px solid transparent',
      transition: 'background 0.12s, color 0.12s',
    }}>
      {icon}{label}
    </Link>
  )
}

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 14px', borderRadius: 9, marginBottom: 14,
      background: type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
      border: `1px solid ${type === 'success' ? 'rgba(16,185,129,0.30)' : 'rgba(239,68,68,0.30)'}`,
      color: type === 'success' ? '#34D399' : '#FCA5A5',
      fontSize: 13,
    }}>
      {type === 'success' ? <Check size={14} /> : <X size={14} />}
      {msg}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 7 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 9,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
  color: 'white', fontSize: 13.5, outline: 'none', boxSizing: 'border-box',
}

function SaveButton({ loading, label = 'Save Changes' }: { loading: boolean; label?: string }) {
  return (
    <button type="submit" disabled={loading} style={{
      padding: '10px 22px', borderRadius: 9,
      background: loading ? 'rgba(0,229,255,0.12)' : 'rgba(0,229,255,0.18)',
      border: '1px solid rgba(0,229,255,0.35)',
      color: loading ? 'rgba(0,229,255,0.45)' : '#00E5FF',
      fontSize: 13, fontWeight: 600, cursor: loading ? 'default' : 'pointer',
      transition: 'all 0.14s',
    }}>
      {loading ? 'Saving…' : label}
    </button>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#0A0F1E', border: '1px solid rgba(255,255,255,0.09)',
      borderRadius: 14, padding: '24px 28px', marginBottom: 20,
    }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

export default function ProfileClient({
  fullName,
  email,
  phone,
  role,
}: {
  fullName: string
  email: string
  phone: string
  role: string
}) {
  const [profileMsg, setProfileMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [emailMsg, setEmailMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [pwMsg, setPwMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const [profilePending, startProfile] = useTransition()
  const [emailPending, startEmail] = useTransition()
  const [pwPending, startPw] = useTransition()

  const isTL = role === 'team_leader' || role === 'super_admin'
  const isAdmin = role === 'super_admin'
  const isResponder = role === 'responder'

  const roleLabel = role === 'super_admin' ? 'Super Admin'
    : role === 'team_leader' ? 'Team Leader'
    : role === 'responder' ? 'Responder'
    : 'Dashboard'

  async function handleProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setProfileMsg(null)
    const fd = new FormData(e.currentTarget)
    startProfile(async () => {
      const res = await updateProfileAction(fd)
      setProfileMsg(res.error ? { text: res.error, type: 'error' } : { text: res.success!, type: 'success' })
    })
  }

  async function handleEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setEmailMsg(null)
    const fd = new FormData(e.currentTarget)
    startEmail(async () => {
      const res = await updateEmailAction(fd)
      setEmailMsg(res.error ? { text: res.error, type: 'error' } : { text: res.success!, type: 'success' })
    })
  }

  async function handlePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPwMsg(null)
    const fd = new FormData(e.currentTarget)
    startPw(async () => {
      const res = await updatePasswordAction(fd)
      setPwMsg(res.error ? { text: res.error, type: 'error' } : { text: res.success!, type: 'success' })
      if (!res.error) (e.target as HTMLFormElement).reset()
    })
  }

  return (
    <>
      <style>{`
        input:focus { border-color: rgba(0,229,255,0.40) !important; box-shadow: 0 0 0 3px rgba(0,229,255,0.08); }
        .sb-lnk:hover { background: rgba(255,255,255,0.05) !important; color: rgba(255,255,255,0.75) !important; }
      `}</style>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#070B18', color: 'white', fontFamily: 'system-ui, sans-serif' }}>

        {/* Sidebar */}
        <aside style={{
          width: 220, flexShrink: 0, background: '#0A0F1E',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', flexDirection: 'column',
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 30,
        }}>
          <div style={{ padding: '20px 20px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Image src="/logo/kandili-logo.png" alt="Kandili" width={38} height={38} style={{ borderRadius: 8, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: 'white', letterSpacing: '-0.01em', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                  Kandili Response
                </p>
                <p style={{ fontSize: 10, color: 'rgba(0,229,255,0.55)', letterSpacing: '0.11em', textTransform: 'uppercase', marginTop: 4, lineHeight: 1 }}>
                  {roleLabel}
                </p>
              </div>
            </div>
          </div>
          <nav style={{ padding: '14px 10px', flex: 1 }}>
            <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.20)', textTransform: 'uppercase', padding: '0 10px', marginBottom: 6 }}>
              Navigation
            </p>
            <SidebarLink icon={<LayoutDashboard size={15} />} label="Overview" href="/dashboard" />
            {(role === 'team_leader') && <SidebarLink icon={<Siren size={15} />} label="Incident Center" href="/dashboard/tl" />}
            {isAdmin && <SidebarLink icon={<Siren size={15} />} label="Incident Center" href="/dashboard/incident-center" />}
            {isTL && <SidebarLink icon={<History size={15} />} label="Incident History" href="/dashboard/incident-history" />}
            {isTL && <SidebarLink icon={<TrendingUp size={15} />} label="Analytics" href="/dashboard/analytics" />}
            {isAdmin && <SidebarLink icon={<Settings size={15} />} label="Admin Panel" href="/admin" />}
            {isResponder && <SidebarLink icon={<Truck size={15} />} label="Responder Hub" href="/dashboard/responder" />}
            <SidebarLink icon={<User size={15} />} label="Profile" href="/dashboard/profile" active />
          </nav>
        </aside>

        {/* Main */}
        <div style={{ flex: 1, marginLeft: 220, display: 'flex', flexDirection: 'column' }}>
          <header style={{
            height: 60, padding: '0 36px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(7,11,24,0.97)', backdropFilter: 'blur(14px)',
            position: 'sticky', top: 0, zIndex: 20,
          }}>
            <div>
              <h1 style={{ fontSize: 17, fontWeight: 700, color: 'white', lineHeight: 1 }}>My Profile</h1>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', marginTop: 2 }}>
                Manage your account details and credentials
              </p>
            </div>
            <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'rgba(255,255,255,0.40)', textDecoration: 'none' }}>
              <ArrowLeft size={14} /> Dashboard
            </Link>
          </header>

          <main style={{ padding: '32px 36px', flex: 1, maxWidth: 640 }}>

            {/* Identity card */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '20px 24px', borderRadius: 14, marginBottom: 24,
              background: '#0A0F1E', border: '1px solid rgba(255,255,255,0.09)',
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'rgba(0,229,255,0.12)', border: '2px solid rgba(0,229,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <User size={22} color="#00E5FF" />
              </div>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>{fullName}</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)', marginTop: 2 }}>{email}</p>
                <span style={{
                  display: 'inline-block', marginTop: 6, padding: '2px 9px', borderRadius: 20,
                  fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                  background: 'rgba(0,229,255,0.10)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.25)',
                }}>
                  {roleLabel}
                </span>
              </div>
            </div>

            {/* Section 1: Profile info */}
            <SectionCard title="Personal Information">
              {profileMsg && <Toast msg={profileMsg.text} type={profileMsg.type} />}
              <form onSubmit={handleProfile}>
                <Field label="Full Name">
                  <input name="full_name" defaultValue={fullName} required style={inputStyle} />
                </Field>
                <Field label="Phone Number">
                  <input name="phone_number" defaultValue={phone} style={inputStyle} />
                </Field>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <SaveButton loading={profilePending} />
                </div>
              </form>
            </SectionCard>

            {/* Section 2: Email */}
            <SectionCard title="Change Email">
              {emailMsg && <Toast msg={emailMsg.text} type={emailMsg.type} />}
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 16, marginTop: -8 }}>
                Current: <span style={{ color: 'rgba(255,255,255,0.60)' }}>{email}</span>
              </p>
              <form onSubmit={handleEmail}>
                <Field label="New Email Address">
                  <input name="email" type="email" required placeholder="new@example.com" style={inputStyle} />
                </Field>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <SaveButton loading={emailPending} label="Update Email" />
                </div>
              </form>
            </SectionCard>

            {/* Section 3: Password */}
            <SectionCard title="Change Password">
              {pwMsg && <Toast msg={pwMsg.text} type={pwMsg.type} />}
              <form onSubmit={handlePassword}>
                <Field label="Current Password">
                  <input name="current_password" type="password" required placeholder="••••••••" style={inputStyle} />
                </Field>
                <Field label="New Password">
                  <input name="new_password" type="password" required placeholder="Min. 8 characters" style={inputStyle} />
                </Field>
                <Field label="Confirm New Password">
                  <input name="confirm_password" type="password" required placeholder="Repeat new password" style={inputStyle} />
                </Field>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <SaveButton loading={pwPending} label="Update Password" />
                </div>
              </form>
            </SectionCard>

          </main>
        </div>
      </div>
    </>
  )
}

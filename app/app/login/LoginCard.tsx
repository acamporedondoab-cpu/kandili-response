'use client'

import { useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Image from 'next/image'
import { login } from '@/app/lib/auth/actions'

export default function LoginCard({ error }: { error?: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 4200)
    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      <style>{`
        @keyframes scanline {
          0%   { top: -2px; opacity: 0; }
          4%   { opacity: 1; }
          30%  { top: 102%; opacity: 0.7; }
          31%  { opacity: 0; }
          100% { top: 102%; opacity: 0; }
        }
        @keyframes logoPulse {
          0%, 100% { filter: drop-shadow(0 0 8px rgba(0,229,255,0.30)); }
          50%       { filter: drop-shadow(0 0 16px rgba(0,229,255,0.55)); }
        }
        @keyframes cardReveal {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        className="relative z-20 w-full max-w-md mx-4"
        style={
          visible
            ? { animation: 'cardReveal 700ms ease-out forwards' }
            : { opacity: 0 }
        }
      >
        {/* Card */}
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(10,15,30,0.75)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: '1px solid rgba(0,229,255,0.22)',
            boxShadow: [
              '0 0 0 1px rgba(0,229,255,0.06)',
              '0 0 90px rgba(0,229,255,0.06)',
              '0 32px 80px rgba(0,0,0,0.65)',
            ].join(', '),
          }}
        >
          {/* Scanning line */}
          <div
            className="absolute left-0 right-0 h-[1px] pointer-events-none z-10"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(0,229,255,0.5) 25%, rgba(0,229,255,0.85) 50%, rgba(0,229,255,0.5) 75%, transparent 100%)',
              animation: 'scanline 6s ease-in-out infinite',
            }}
          />

          {/* Inner padding */}
          <div className="px-8 pt-10 pb-8">
            {/* Logo + branding */}
            <div className="flex flex-col items-center mb-8">
              <div
                className="mb-5"
                style={{ animation: 'logoPulse 3.5s ease-in-out infinite' }}
              >
                <Image
                  src="/logo/kandili-logo.png"
                  alt="Kandili Response"
                  width={110}
                  height={110}
                  className="object-contain"
                  priority
                />
              </div>

              <h1
                className="text-[22px] font-bold text-white leading-tight tracking-tight"
              >
                Kandili Response
              </h1>

              <p
                className="text-[12.5px] mt-2 text-center"
                style={{
                  color: 'rgba(0,229,255,0.80)',
                  letterSpacing: '0.06em',
                }}
              >
                One Tap, We Track, We Respond Fast
              </p>
            </div>

            {/* Divider */}
            <div
              className="mb-7 h-px w-full"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(0,229,255,0.16), transparent)',
              }}
            />

            {/* Error */}
            {error && (
              <div className="mb-5 px-4 py-2.5 rounded-xl bg-red-950/60 border border-red-500/25">
                <p className="text-red-300 text-sm text-center">{error}</p>
              </div>
            )}

            {/* Form */}
            <form action={login} className="space-y-3">
              <InputField
                name="email"
                type="email"
                placeholder="Email address"
                autoComplete="email"
              />
              <InputField
                name="password"
                type="password"
                placeholder="Password"
                autoComplete="current-password"
              />
              <div className="pt-3">
                <SubmitButton />
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}

function InputField({
  name,
  type,
  placeholder,
  autoComplete,
}: {
  name: string
  type: string
  placeholder: string
  autoComplete: string
}) {
  const [focused, setFocused] = useState(false)

  return (
    <input
      name={name}
      type={type}
      required
      autoComplete={autoComplete}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none placeholder-gray-600"
      style={{
        background: 'rgba(255,255,255,0.06)',
        border: focused
          ? '1px solid rgba(0,229,255,0.55)'
          : '1px solid rgba(0,229,255,0.14)',
        boxShadow: focused
          ? '0 0 0 3px rgba(0,229,255,0.08), inset 0 1px 0 rgba(255,255,255,0.04)'
          : 'inset 0 1px 0 rgba(255,255,255,0.04)',
        transition: 'border-color 200ms ease, box-shadow 200ms ease',
      }}
    />
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  const [state, setState] = useState<'idle' | 'hover' | 'active'>('idle')

  return (
    <button
      type="submit"
      disabled={pending}
      onMouseEnter={() => !pending && setState('hover')}
      onMouseLeave={() => setState('idle')}
      onMouseDown={() => !pending && setState('active')}
      onMouseUp={() => setState('hover')}
      className="w-full py-3 rounded-xl font-bold text-white text-sm tracking-[0.12em] uppercase flex items-center justify-center gap-2"
      style={{
        background: pending
          ? 'linear-gradient(135deg, rgba(0,229,255,0.55) 0%, rgba(58,134,255,0.55) 100%)'
          : 'linear-gradient(135deg, #00E5FF 0%, #3A86FF 100%)',
        boxShadow:
          state === 'hover' && !pending
            ? '0 6px 28px rgba(0,229,255,0.40), 0 2px 8px rgba(58,134,255,0.30)'
            : state === 'active' && !pending
            ? '0 2px 10px rgba(0,229,255,0.25)'
            : '0 4px 18px rgba(0,229,255,0.20)',
        transform:
          state === 'hover' && !pending
            ? 'translateY(-2px)'
            : state === 'active' && !pending
            ? 'translateY(1px)'
            : 'translateY(0)',
        transition: 'transform 200ms ease, box-shadow 200ms ease, background 200ms ease',
        cursor: pending ? 'not-allowed' : 'pointer',
      }}
    >
      {pending && (
        <svg
          className="animate-spin"
          width="15" height="15"
          viewBox="0 0 24 24" fill="none"
          style={{ opacity: 0.9 }}
        >
          <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {pending ? 'Signing In…' : 'Sign In'}
    </button>
  )
}

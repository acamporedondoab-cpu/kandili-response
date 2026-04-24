'use client'

import { useTransition, useState, useRef, useEffect } from 'react'
import { removeOrganization } from '../organizations/actions'

const UNDO_SECONDS = 5

export default function RemoveOrgButton({ orgId }: { orgId: string; orgName?: string }) {
  const [, startTransition] = useTransition()
  const [countdown, setCountdown] = useState<number | null>(null)
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  function clearTimers() {
    if (deleteTimer.current) clearTimeout(deleteTimer.current)
    if (tickTimer.current) clearInterval(tickTimer.current)
  }

  function handleRemove() {
    setCountdown(UNDO_SECONDS)

    tickTimer.current = setInterval(() => {
      setCountdown((c) => (c !== null ? c - 1 : null))
    }, 1000)

    deleteTimer.current = setTimeout(() => {
      clearTimers()
      setCountdown(null)
      startTransition(async () => {
        await removeOrganization(orgId)
      })
    }, UNDO_SECONDS * 1000)
  }

  function handleUndo() {
    clearTimers()
    setCountdown(null)
  }

  // Clean up on unmount
  useEffect(() => () => clearTimers(), [])

  if (countdown !== null) {
    return (
      <button
        onClick={handleUndo}
        style={{
          padding: '11px 14px',
          borderRadius: 8,
          background: 'rgba(251,191,36,0.10)',
          border: '1px solid rgba(251,191,36,0.30)',
          color: '#FBBF24',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          flexShrink: 0,
          whiteSpace: 'nowrap',
          letterSpacing: '0.01em',
        }}
      >
        Undo ({countdown}s)
      </button>
    )
  }

  return (
    <button
      onClick={handleRemove}
      style={{
        padding: '11px 16px',
        borderRadius: 8,
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.22)',
        color: '#F87171',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        flexShrink: 0,
        whiteSpace: 'nowrap',
        letterSpacing: '0.01em',
      }}
    >
      Remove
    </button>
  )
}

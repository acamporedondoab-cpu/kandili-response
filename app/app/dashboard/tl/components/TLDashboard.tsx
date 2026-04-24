'use client'

import { useEffect, useState, useCallback, useMemo, useTransition } from 'react'
import { createClient } from '../../../lib/supabase/client'
import StatsRow from './StatsRow'
import IncidentQueueTable from './IncidentQueueTable'
import AssignResponderModal from './AssignResponderModal'
import { toggleTLDutyAction } from '../../../lib/supabase/incident-actions'
import type { TLIncident, TLResponder, ResolvedIncident } from './IncidentQueueTable'

const ACTIVE_STATUSES = [
  'pending',
  'assigned',
  'en_route',
  'arrived',
  'escalated',
  'pending_citizen_confirmation',
]

interface Props {
  orgId: string
  orgName: string
  tlName: string
  tlIsOnDuty: boolean
  tlsOnDutyCount?: number
  initialIncidents: TLIncident[]
  responders: TLResponder[]
  logoUrl?: string | null
  backHref?: string
  readOnly?: boolean
}

export default function TLDashboard({ orgId, orgName, tlName, tlIsOnDuty, tlsOnDutyCount = 0, initialIncidents, responders, logoUrl, backHref = '/dashboard', readOnly = false }: Props) {
  const [incidents, setIncidents] = useState<TLIncident[]>(initialIncidents)
  const [resolvedToday, setResolvedToday] = useState(0)
  const [avgResponseMins, setAvgResponseMins] = useState<number | null>(null)
  const [selectedIncident, setSelectedIncident] = useState<TLIncident | null>(null)
  const [resolvedIncidents, setResolvedIncidents] = useState<ResolvedIncident[]>([])
  const [isOnDuty, setIsOnDuty] = useState(tlIsOnDuty)
  const [tlsOnDuty, setTlsOnDuty] = useState(tlsOnDutyCount)
  const [dutyPending, startDutyTransition] = useTransition()

  const supabase = useMemo(() => createClient(), [])

  function handleDutyToggle() {
    startDutyTransition(async () => {
      const res = await toggleTLDutyAction()
      if (res.success && res.isOnDuty !== undefined) {
        setIsOnDuty(res.isOnDuty)
        setTlsOnDuty((prev) => res.isOnDuty ? prev + 1 : Math.max(0, prev - 1))
      }
    })
  }

  const fetchIncidents = useCallback(async () => {
    const { data } = await supabase
      .from('incidents')
      .select(
        'id, incident_code, emergency_type, status, citizen_address, citizen_lat, citizen_lng, created_at, assigned_responder_id'
      )
      .eq('organization_id', orgId)
      .in('status', ACTIVE_STATUSES)
      .order('created_at', { ascending: false })

    if (data) setIncidents(data as TLIncident[])
  }, [supabase, orgId])

  const fetchResolvedStats = useCallback(async () => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data } = await supabase
      .from('incidents')
      .select(
        'id, incident_code, emergency_type, status, citizen_address, citizen_lat, citizen_lng, assigned_responder_id, notes, response_time_seconds, resolved_at, en_route_at, arrived_at, created_at, responder_assigned_at, tl_assigned_at, responder_profile:profiles!assigned_responder_id(full_name)'
      )
      .eq('organization_id', orgId)
      .in('status', ['resolved', 'closed'])
      .gte('resolved_at', monthStart.toISOString())
      .order('resolved_at', { ascending: false })

    if (!data) return

    setResolvedIncidents(data as unknown as ResolvedIncident[])

    const todayData = data.filter((r) => r.resolved_at && new Date(r.resolved_at) >= todayStart)
    setResolvedToday(todayData.length)

    const withBoth = todayData.filter((r) => r.responder_assigned_at && r.resolved_at)
    if (withBoth.length > 0) {
      const avgMs =
        withBoth.reduce(
          (sum, r) =>
            sum +
            (new Date(r.resolved_at).getTime() - new Date(r.responder_assigned_at).getTime()),
          0
        ) / withBoth.length
      setAvgResponseMins(Math.round(avgMs / 60000))
    }
  }, [supabase, orgId])

  useEffect(() => {
    fetchResolvedStats()
  }, [fetchResolvedStats])

  useEffect(() => {
    // No column filter — column filters require REPLICA IDENTITY FULL on the table.
    // fetchIncidents() already scopes by organization_id in the SQL query.
    const channel = supabase
      .channel(`tl-incidents-${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incidents' },
        () => {
          fetchIncidents()
          fetchResolvedStats()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, orgId, fetchIncidents, fetchResolvedStats])

  const onDutyCount = responders.filter((r) => r.is_on_duty).length

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={orgName}
              className="w-8 h-8 rounded-lg object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white font-bold text-sm">
              {orgName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">Guardian Dispatch</h1>
            <p className="text-xs text-gray-500 leading-tight">{orgName}</p>
          </div>
        </div>

        <h2 className="text-base font-semibold text-white hidden sm:block">Team Leader Dashboard</h2>

        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            TL: <span className="text-white font-medium">{tlName}</span>
          </span>

          {/* On/Off Duty Toggle (hidden for read-only admin view) */}
          {!readOnly && (
            <button
              onClick={handleDutyToggle}
              disabled={dutyPending}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 14px', borderRadius: 20,
                border: `1px solid ${isOnDuty ? 'rgba(16,185,129,0.40)' : 'rgba(255,255,255,0.15)'}`,
                background: isOnDuty ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)',
                color: isOnDuty ? '#34D399' : 'rgba(255,255,255,0.40)',
                fontSize: 12, fontWeight: 600, cursor: dutyPending ? 'default' : 'pointer',
                transition: 'all 0.15s', letterSpacing: '0.04em',
              }}
            >
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: isOnDuty ? '#34D399' : 'rgba(255,255,255,0.25)',
                boxShadow: isOnDuty ? '0 0 6px #34D399' : 'none',
                transition: 'all 0.15s',
              }} />
              {dutyPending ? 'Updating…' : isOnDuty ? 'ON DUTY' : 'OFF DUTY'}
            </button>
          )}
          {readOnly && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', borderRadius: 20,
              border: `1px solid ${isOnDuty ? 'rgba(16,185,129,0.40)' : 'rgba(255,255,255,0.15)'}`,
              background: isOnDuty ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)',
              color: isOnDuty ? '#34D399' : 'rgba(255,255,255,0.40)',
              fontSize: 12, fontWeight: 600, letterSpacing: '0.04em',
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: isOnDuty ? '#34D399' : 'rgba(255,255,255,0.25)',
                boxShadow: isOnDuty ? '0 0 6px #34D399' : 'none',
              }} />
              {isOnDuty ? 'ON DUTY' : 'OFF DUTY'}
            </span>
          )}

          <a
            href={backHref}
            className="text-sm text-gray-500 hover:text-white transition-colors"
          >
            ← Back
          </a>
        </div>
      </header>

      {/* Content */}
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <StatsRow
          activeCount={incidents.length}
          onDutyCount={onDutyCount}
          tlsOnDutyCount={tlsOnDuty}
          resolvedToday={resolvedToday}
          avgResponseMins={avgResponseMins}
        />

        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Incident Queue
          </h3>
          <IncidentQueueTable
            incidents={incidents}
            responders={responders}
            resolvedIncidents={resolvedIncidents}
            onAssign={(incident) => setSelectedIncident(incident)}
          />
        </div>
      </div>

      {selectedIncident && (
        <AssignResponderModal
          incident={selectedIncident}
          responders={responders}
          onClose={() => setSelectedIncident(null)}
          onAssigned={() => {
            setSelectedIncident(null)
            fetchIncidents()
          }}
        />
      )}
    </div>
  )
}

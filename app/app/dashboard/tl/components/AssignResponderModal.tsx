'use client'

import { useState } from 'react'
import { assignResponderAction } from '../../../lib/supabase/incident-actions'
import type { TLIncident, TLResponder } from './IncidentQueueTable'

interface Props {
  incident: TLIncident
  responders: TLResponder[]
  onClose: () => void
  onAssigned: () => void
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

interface ResponderWithDistance extends TLResponder {
  distanceKm: number | null
}

export default function AssignResponderModal({ incident, responders, onClose, onAssigned }: Props) {
  const [assigning, setAssigning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onDuty = responders.filter((r) => r.is_on_duty)

  const withDistance: ResponderWithDistance[] = onDuty
    .map((r) => ({
      ...r,
      distanceKm:
        r.last_known_lat !== null && r.last_known_lng !== null
          ? haversineKm(r.last_known_lat, r.last_known_lng, incident.citizen_lat, incident.citizen_lng)
          : null,
    }))
    .sort((a, b) => {
      if (a.distanceKm === null && b.distanceKm === null) return 0
      if (a.distanceKm === null) return 1
      if (b.distanceKm === null) return -1
      return a.distanceKm - b.distanceKm
    })

  async function handleAssign(responderId: string) {
    setAssigning(responderId)
    setError(null)

    const result = await assignResponderAction(incident.id, responderId)

    if (!result.success) {
      setError(result.error ?? 'Assignment failed')
      setAssigning(null)
      return
    }

    onAssigned()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="text-white font-bold text-lg">Assign Responder</h2>
            <p className="text-gray-400 text-sm mt-0.5">
              {incident.incident_code} ·{' '}
              {incident.emergency_type === 'crime' ? '🚔 Crime' : '🚑 Medical'}
            </p>
            {incident.citizen_address && (
              <p className="text-gray-500 text-xs mt-1 truncate">{incident.citizen_address}</p>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={!!assigning}
            className="text-gray-500 hover:text-white transition text-xl leading-none ml-4 mt-1"
          >
            ✕
          </button>
        </div>

        {/* Responder list */}
        <div className="p-3 max-h-80 overflow-y-auto space-y-2">
          {withDistance.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No on-duty responders available</p>
          ) : (
            withDistance.map((r) => {
              const isAssigning = assigning === r.id
              const anyAssigning = !!assigning

              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3"
                >
                  <div>
                    <p className="text-white font-semibold text-sm">{r.full_name}</p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      {r.distanceKm !== null
                        ? `📍 ${r.distanceKm.toFixed(1)} km away`
                        : '📍 Location unknown'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAssign(r.id)}
                    disabled={anyAssigning}
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                      isAssigning
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : anyAssigning
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-red-600 hover:bg-red-500 text-white'
                    }`}
                  >
                    {isAssigning ? 'Assigning…' : 'Assign'}
                  </button>
                </div>
              )
            })
          )}
        </div>

        {error && (
          <div className="mx-5 mb-4 px-4 py-2 bg-red-900/40 border border-red-700/40 rounded-lg">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            disabled={!!assigning}
            className="w-full py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

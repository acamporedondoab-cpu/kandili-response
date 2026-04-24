'use client'

import { useState } from 'react'
import { createClient } from '../lib/supabase/client'

const EDGE_FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/dispatch-sos`

export default function SosTestButton() {
  const [lat, setLat] = useState('14.5995')
  const [lng, setLng] = useState('120.9842')
  const [emergencyType, setEmergencyType] = useState('crime')
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleTest() {
    setLoading(true)
    setResult(null)

    try {
      // Step 1: Get current session from browser client
      const supabase = createClient()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session) {
        setResult(`ERROR: No active session — ${sessionError?.message ?? 'not logged in'}`)
        setLoading(false)
        return
      }

      // Step 2: Extract raw access_token (this is the JWT Bearer token)
      const accessToken = session.access_token
      console.log('[SosTest] Token prefix:', accessToken.substring(0, 20) + '...')

      // Step 3: POST to Edge Function with Authorization header
      const res = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          emergency_type: emergencyType,
        }),
      })

      const data = await res.json()
      setResult(JSON.stringify({ status: res.status, body: data }, null, 2))
    } catch (err) {
      setResult(`FETCH ERROR: ${String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginTop: 32, padding: 16, border: '1px solid #ccc', borderRadius: 8, maxWidth: 500 }}>
      <h3 style={{ marginTop: 0 }}>SOS Dispatch Test</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        <label style={{ fontSize: 13 }}>
          Latitude
          <input
            type="number"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            style={{ display: 'block', width: '100%', padding: '4px 8px', marginTop: 2 }}
          />
        </label>

        <label style={{ fontSize: 13 }}>
          Longitude
          <input
            type="number"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            style={{ display: 'block', width: '100%', padding: '4px 8px', marginTop: 2 }}
          />
        </label>

        <label style={{ fontSize: 13 }}>
          Emergency Type
          <select
            value={emergencyType}
            onChange={(e) => setEmergencyType(e.target.value)}
            style={{ display: 'block', width: '100%', padding: '4px 8px', marginTop: 2 }}
          >
            <option value="crime">crime</option>
            <option value="medical">medical</option>
          </select>
        </label>
      </div>

      <button
        onClick={handleTest}
        disabled={loading}
        style={{ padding: '8px 20px', cursor: loading ? 'not-allowed' : 'pointer' }}
      >
        {loading ? 'Sending...' : 'Trigger Test SOS'}
      </button>

      {result && (
        <pre style={{
          marginTop: 12,
          padding: 10,
          background: '#f4f4f4',
          borderRadius: 4,
          fontSize: 12,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}>
          {result}
        </pre>
      )}
    </div>
  )
}

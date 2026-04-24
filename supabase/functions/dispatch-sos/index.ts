import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { sendPushToMany } from '../_shared/fcm.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const VALID_EMERGENCY_TYPES = ['crime', 'medical'] as const
type EmergencyType = typeof VALID_EMERGENCY_TYPES[number]

type DispatchResult = {
  result_code: string
  incident_id: string | null
  incident_code: string | null
  organization_id: string | null
  organization_name: string | null
  distance_km: number | null
  sos_attempt_id: string | null
}

type ResponderProfile = {
  id: string
  fcm_token: string | null
  last_known_lat: number | null
  last_known_lng: number | null
  full_name: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
    })
  }

  const requestId = crypto.randomUUID()
  const log = (msg: string, ...args: unknown[]) =>
    console.log(`[dispatch-sos][${requestId}]`, msg, ...args)
  const logError = (msg: string, ...args: unknown[]) =>
    console.error(`[dispatch-sos][${requestId}]`, msg, ...args)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Missing or invalid Authorization header' }, 401)
    }

    // User-scoped client for ES256 JWT validation
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: { user }, error: getUserError } = await userClient.auth.getUser()
    if (getUserError || !user) {
      logError('auth.getUser failed:', getUserError?.message)
      return json({ error: 'Unauthorized - invalid token' }, 401)
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const userId = user.id

    const { data: citizenProfile } = await adminClient
      .from('profiles')
      .select('phone_verified')
      .eq('id', userId)
      .single()

    if (!citizenProfile?.phone_verified) {
      return json({ error: 'Phone number not verified. Please verify your phone before using SOS.' }, 403)
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON body' }, 400)
    }

    const { lat, lng, emergency_type, notes } =
      typeof body === 'object' && body !== null ? body as Record<string, unknown> : {}

    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return json({ error: 'lat and lng must be finite numbers' }, 400)
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return json({ error: 'lat or lng out of valid range' }, 400)
    }
    if (typeof emergency_type !== 'string' || !(VALID_EMERGENCY_TYPES as readonly string[]).includes(emergency_type)) {
      return json({ error: `Invalid emergency_type. Allowed: ${VALID_EMERGENCY_TYPES.join(', ')}` }, 400)
    }

    const safeEmergencyType = emergency_type as EmergencyType
    const safeNotes = typeof notes === 'string' ? notes.trim().slice(0, 500) : null

    const { data: rpcRows, error: rpcError } = await adminClient.rpc('fn_dispatch_sos_atomic', {
      p_citizen_id: userId,
      p_lat: lat,
      p_lng: lng,
      p_emergency_type: safeEmergencyType,
      p_notes: safeNotes,
    })

    if (rpcError) {
      logError('fn_dispatch_sos_atomic failed:', rpcError.message)
      return json({ error: 'Failed to dispatch SOS', request_id: requestId }, 500)
    }

    const result = (rpcRows?.[0] ?? null) as DispatchResult | null
    if (!result) {
      logError('fn_dispatch_sos_atomic returned no rows')
      return json({ error: 'Failed to dispatch SOS', request_id: requestId }, 500)
    }

    switch (result.result_code) {
      case 'created': break
      case 'profile_not_found': return json({ error: 'Profile not found' }, 404)
      case 'forbidden_role': return json({ error: 'Only citizen accounts can trigger SOS' }, 403)
      case 'account_suspended': return json({ error: 'Account is suspended' }, 403)
      case 'abuse_blocked': return json({ error: 'SOS blocked due to repeated abuse. Contact support.' }, 403)
      case 'rate_limited': return json({ error: 'Too many requests. Please wait.' }, 429)
      case 'active_incident_exists':
        return json({ error: 'You already have an active incident', incident_id: result.incident_id, incident_code: result.incident_code }, 409)
      case 'no_org_found': return json({ error: 'No responding organization found in your area' }, 503)
      case 'invalid_coordinates':
      case 'invalid_emergency_type': return json({ error: 'Invalid input' }, 400)
      default:
        logError('Unexpected RPC result_code:', result.result_code)
        return json({ error: 'Failed to dispatch SOS', request_id: requestId }, 500)
    }

    const orgId = result.organization_id!
    const orgName = result.organization_name!
    const incidentId = result.incident_id!
    const incidentCode = result.incident_code!

    if (!incidentId || !orgId || !orgName) {
      logError('Created result missing required fields:', result)
      return json({ error: 'Failed to dispatch SOS', request_id: requestId }, 500)
    }

    // Find primary TL: lowest tl_priority on-duty TL in matched org
    const { data: allTLs } = await adminClient
      .from('profiles')
      .select('id, fcm_token, tl_priority, is_on_duty')
      .eq('organization_id', orgId)
      .eq('role', 'team_leader')
      .eq('is_suspended', false)
      .is('deleted_at', null)
      .order('tl_priority', { ascending: true })

    const primaryTL = allTLs?.find((tl) => tl.is_on_duty) ?? null

    if (primaryTL) {
      // Route to primary TL only — escalation engine handles backup TL if no response
      await adminClient.from('notifications').insert({
        user_id: primaryTL.id,
        incident_id: incidentId,
        type: 'incident_alert',
        title: `New ${safeEmergencyType.toUpperCase()} SOS`,
        body: `Incident ${incidentCode} requires immediate response`,
        delivery_status: 'sent',
      })

      if (primaryTL.fcm_token) {
        await sendPushToMany(
          [primaryTL.fcm_token],
          `New ${safeEmergencyType.toUpperCase()} SOS`,
          `Incident ${incidentCode} requires immediate response`,
          { incident_id: incidentId, type: 'incident_alert' }
        ).catch((e) => logError('FCM push failed:', e))
      }

      log('SOS routed to primary TL:', primaryTL.id, '| priority:', primaryTL.tl_priority)
    } else {
      // No TL on duty — immediately assign nearest on-duty responder (Stage 3 direct)
      log('No on-duty TL for org:', orgId, '— direct responder dispatch')

      const { data: responders } = await adminClient
        .from('profiles')
        .select('id, fcm_token, last_known_lat, last_known_lng, full_name')
        .eq('organization_id', orgId)
        .eq('role', 'responder')
        .eq('is_on_duty', true)
        .is('deleted_at', null)

      if (responders && responders.length > 0) {
        const nearest = pickNearest(responders as ResponderProfile[], lat, lng)

        await adminClient.from('incidents').update({
          assigned_responder_id: nearest.id,
          status: 'assigned',
          responder_assigned_at: new Date().toISOString(),
        }).eq('id', incidentId)

        await adminClient.from('escalation_events').insert({
          incident_id: incidentId,
          escalation_level: 3,
          from_user_id: null,
          to_user_id: nearest.id,
          reason: 'no_tl_on_duty',
          timeout_seconds: 0,
        })

        await adminClient.from('notifications').insert({
          user_id: nearest.id,
          incident_id: incidentId,
          type: 'assignment',
          title: `🚨 Emergency Assignment`,
          body: `Incident ${incidentCode} assigned to you. Respond immediately.`,
          delivery_status: 'sent',
        })

        if (nearest.fcm_token) {
          await sendPushToMany(
            [nearest.fcm_token],
            `🚨 Emergency Assignment`,
            `Incident ${incidentCode} assigned to you. Respond immediately.`,
            { incident_id: incidentId, type: 'assignment' }
          ).catch((e) => logError('FCM direct responder failed:', e))
        }

        log('Direct responder assigned:', nearest.id)
      } else {
        log('No on-duty responders either — escalation engine will handle cross-org transfer')
      }
    }

    return json({
      success: true,
      request_id: requestId,
      incident_id: incidentId,
      incident_code: incidentCode,
      organization_name: orgName,
      distance_km: result.distance_km,
    }, 200)

  } catch (err) {
    logError('Unexpected error:', err)
    return json({ error: 'Internal server error', request_id: requestId }, 500)
  }
})

function pickNearest(items: ResponderProfile[], lat: number, lng: number): ResponderProfile {
  return items.reduce((best, r) => {
    if (!r.last_known_lat || !r.last_known_lng) return best
    const distR = haversineKm(lat, lng, r.last_known_lat, r.last_known_lng)
    if (!best.last_known_lat || !best.last_known_lng) return r
    const distB = haversineKm(lat, lng, best.last_known_lat, best.last_known_lng)
    return distR < distB ? r : best
  }, items[0])
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' },
  })
}

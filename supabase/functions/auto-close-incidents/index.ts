import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// How long (seconds) to wait before auto-closing a pending_citizen_confirmation incident.
// Override via AUTO_CLOSE_TIMEOUT_SECONDS env var. Default: 1800 (30 minutes).
const TIMEOUT_SECONDS = parseInt(Deno.env.get('AUTO_CLOSE_TIMEOUT_SECONDS') ?? '1800', 10)

serve(async (req) => {
  // Shared-secret auth — same pattern as escalate-incidents
  const cronSecret = Deno.env.get('ESCALATION_CRON_SECRET')
  if (cronSecret) {
    const auth = req.headers.get('Authorization') ?? ''
    if (auth !== `Bearer ${cronSecret}`) {
      return json({ error: 'Unauthorized' }, 401)
    }
  }

  const requestId = crypto.randomUUID()
  const log = (msg: string, ...args: unknown[]) =>
    console.log(`[auto-close-incidents][${requestId}]`, msg, ...args)
  const logError = (msg: string, ...args: unknown[]) =>
    console.error(`[auto-close-incidents][${requestId}]`, msg, ...args)

  log('Auto-close check started — timeout:', TIMEOUT_SECONDS, 'seconds')

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const cutoff = new Date(Date.now() - TIMEOUT_SECONDS * 1000).toISOString()

  // Find incidents waiting for citizen confirmation past the timeout.
  // Uses arrived_at as the primary reference; falls back to updated_at if arrived_at is NULL.
  const { data: staleIncidents, error: queryError } = await admin
    .from('incidents')
    .select('id, incident_code, responder_assigned_at, arrived_at, updated_at')
    .eq('status', 'pending_citizen_confirmation')
    .is('citizen_confirmed', null)
    .or(`arrived_at.lt.${cutoff},and(arrived_at.is.null,updated_at.lt.${cutoff})`)

  if (queryError) {
    logError('Query failed:', queryError.message)
    return json({ error: queryError.message }, 500)
  }

  const incidents = staleIncidents ?? []
  log(`Found ${incidents.length} incident(s) to auto-close`)

  let closedCount = 0

  for (const incident of incidents) {
    const now = new Date().toISOString()

    const updatePayload: Record<string, string | number | boolean> = {
      status: 'closed',
      citizen_confirmed: false,
      resolved_at: now,
    }

    // Write response_time_seconds if we have the assignment timestamp
    if (incident.responder_assigned_at) {
      const diffMs = new Date(now).getTime() - new Date(incident.responder_assigned_at).getTime()
      updatePayload['response_time_seconds'] = Math.round(diffMs / 1000)
    }

    const { error: updateError } = await admin
      .from('incidents')
      .update(updatePayload)
      .eq('id', incident.id)
      .eq('status', 'pending_citizen_confirmation') // guard against race conditions

    if (updateError) {
      logError('Failed to close incident:', incident.incident_code, updateError.message)
      continue
    }

    log('Auto-closed incident:', incident.incident_code)
    closedCount++
  }

  log(`Done — auto-closed: ${closedCount}`)
  return json({ ok: true, closed: closedCount }, 200)
})

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

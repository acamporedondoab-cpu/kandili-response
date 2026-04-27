import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendPush } from '../_shared/fcm.ts'

// Dispatch rule timeouts (seconds)
const TL_REMINDER = 30         // Reminder: re-notify primary TL at 30s if still pending
const TL_TIMEOUT = 60          // Stage 1 & 2: TL must acknowledge within 60s
const ASSIGN_WINDOW = 120      // Rule 4: TL must assign responder within 120s of acknowledging
const RESPONDER_TIMEOUT = 45   // Stage 3/4: responder must accept within 45s

type ResponderRow = {
  id: string
  fcm_token: string | null
  last_known_lat: number | null
  last_known_lng: number | null
  full_name: string
}

serve(async (req) => {
  const cronSecret = Deno.env.get('ESCALATION_CRON_SECRET')
  if (cronSecret) {
    const auth = req.headers.get('Authorization') ?? ''
    if (auth !== `Bearer ${cronSecret}`) {
      return json({ error: 'Unauthorized' }, 401)
    }
  }

  const requestId = crypto.randomUUID()
  const log = (...args: unknown[]) => console.log(`[escalate][${requestId}]`, ...args)
  const logError = (...args: unknown[]) => console.error(`[escalate][${requestId}]`, ...args)

  log('Escalation check started')

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const counts = { reminder: 0, stage1: 0, stage2: 0, assignWindow: 0, stage34: 0, stage5: 0 }

  // ── Reminder: re-notify primary TL at 30s if incident still pending ───────────
  {
    const reminderCutoff = new Date(Date.now() - TL_REMINDER * 1000).toISOString()
    const tlTimeoutCutoff = new Date(Date.now() - TL_TIMEOUT * 1000).toISOString()

    const { data: incidents, error } = await admin
      .from('incidents')
      .select('id, incident_code, organization_id')
      .eq('status', 'pending')
      .not('tl_notified_at', 'is', null)
      .is('tl_assigned_at', null)
      .lt('tl_notified_at', reminderCutoff)
      .gt('tl_notified_at', tlTimeoutCutoff)

    if (error) logError('Reminder query error:', error.message)

    for (const inc of incidents ?? []) {
      // Dedup: skip if reminder already sent for this incident
      const { count } = await admin.from('escalation_events')
        .select('id', { count: 'exact', head: true })
        .eq('incident_id', inc.id).eq('reason', 'tl_reminder_30s')
      if ((count ?? 0) > 0) continue

      // Find primary on-duty TL for this org
      const { data: tl } = await admin.from('profiles')
        .select('id, fcm_token')
        .eq('organization_id', inc.organization_id)
        .eq('role', 'team_leader')
        .eq('is_on_duty', true)
        .is('deleted_at', null)
        .order('tl_priority', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (!tl) continue

      await admin.from('escalation_events').insert({
        incident_id: inc.id,
        escalation_level: 0,
        from_user_id: null,
        to_user_id: tl.id,
        reason: 'tl_reminder_30s',
        timeout_seconds: TL_REMINDER,
      })

      if (tl.fcm_token) {
        await sendPush(
          tl.fcm_token,
          '⏰ Reminder — SOS Unacknowledged',
          `Incident ${inc.incident_code} still needs your response.`,
          { incident_id: inc.id, type: 'reminder' }
        ).catch((e) => logError('FCM reminder:', e))
      }

      log('Reminder → primary TL notified:', inc.incident_code, tl.id)
      counts.reminder++
    }
  }

  // ── Stage 1: pending → escalated (primary TL timed out, notify backup TL) ────
  {
    const cutoff = new Date(Date.now() - TL_TIMEOUT * 1000).toISOString()
    const { data: incidents, error } = await admin
      .from('incidents')
      .select('id, incident_code, organization_id, organizations!inner(name, backup_tl_id)')
      .eq('status', 'pending')
      .not('tl_notified_at', 'is', null)
      .is('tl_assigned_at', null)
      .lt('tl_notified_at', cutoff)

    if (error) logError('Stage1 query error:', error.message)

    for (const inc of incidents ?? []) {
      // Dedup: skip if stage 1 already fired for this incident
      const { count } = await admin.from('escalation_events')
        .select('id', { count: 'exact', head: true })
        .eq('incident_id', inc.id).eq('escalation_level', 1)
      if ((count ?? 0) > 0) continue

      const org = inc.organizations as { name: string; backup_tl_id: string | null }
      const backupTL = await findBackupTL(admin, inc.organization_id, org.backup_tl_id)

      await admin.from('incidents').update({
        status: 'escalated',
        escalated_at: new Date().toISOString(),
      }).eq('id', inc.id)

      await admin.from('escalation_events').insert({
        incident_id: inc.id,
        escalation_level: 1,
        from_user_id: null,
        to_user_id: backupTL?.id ?? null,
        reason: backupTL ? 'primary_tl_timeout' : 'primary_tl_timeout_no_backup',
        timeout_seconds: TL_TIMEOUT,
      })

      if (backupTL) {
        await insertNotification(admin, backupTL.id, inc.id, 'escalation',
          '🚨 Escalated — Backup TL Required',
          `Incident ${inc.incident_code} not acknowledged. Action needed now.`)
        if (backupTL.fcm_token) {
          await sendPush(backupTL.fcm_token, '🚨 Escalated — Backup TL Required',
            `Incident ${inc.incident_code} not acknowledged. Action needed now.`,
            { incident_id: inc.id, type: 'escalation' }
          ).catch((e) => logError('FCM stage1:', e))
        }
        log('Stage1 → backup TL notified:', inc.incident_code, backupTL.id)
      } else {
        log('Stage1 → no backup TL on duty, escalated:', inc.incident_code)
      }
      counts.stage1++
    }
  }

  // ── Stage 2: escalated → direct responder (backup TL also timed out) ─────────
  {
    const cutoff = new Date(Date.now() - TL_TIMEOUT * 1000).toISOString()
    const { data: incidents, error } = await admin
      .from('incidents')
      .select('id, incident_code, organization_id, citizen_lat, citizen_lng')
      .eq('status', 'escalated')
      .not('escalated_at', 'is', null)
      .is('tl_assigned_at', null)
      .lt('escalated_at', cutoff)

    if (error) logError('Stage2 query error:', error.message)

    for (const inc of incidents ?? []) {
      // Dedup: skip if stage 2 already fired
      const { count } = await admin.from('escalation_events')
        .select('id', { count: 'exact', head: true })
        .eq('incident_id', inc.id).eq('escalation_level', 2)
      if ((count ?? 0) > 0) continue

      const triedIds = await getTriedResponderIds(admin, inc.id)
      const responder = await findNextResponder(admin, inc.organization_id, inc.citizen_lat, inc.citizen_lng, triedIds)

      await admin.from('escalation_events').insert({
        incident_id: inc.id,
        escalation_level: 2,
        from_user_id: null,
        to_user_id: responder?.id ?? null,
        reason: responder ? 'tl_chain_unresponsive' : 'tl_chain_unresponsive_no_responders',
        timeout_seconds: TL_TIMEOUT,
      })

      if (!responder) {
        log('Stage2 → no responders in org, Stage5 will handle next tick:', inc.incident_code)
        continue
      }

      await admin.from('incidents').update({
        assigned_responder_id: responder.id,
        status: 'assigned',
        responder_assigned_at: new Date().toISOString(),
      }).eq('id', inc.id)

      await notifyResponder(admin, responder, inc.id, inc.incident_code, logError)
      log('Stage2 → responder auto-assigned:', inc.incident_code, responder.id)
      counts.stage2++
    }
  }

  // ── Assign window: TL acknowledged but no responder assigned within 120s ──────
  {
    const cutoff = new Date(Date.now() - ASSIGN_WINDOW * 1000).toISOString()
    const { data: incidents, error } = await admin
      .from('incidents')
      .select('id, incident_code, organization_id, citizen_lat, citizen_lng')
      .in('status', ['pending', 'escalated', 'acknowledged'])
      .not('tl_assigned_at', 'is', null)
      .is('responder_assigned_at', null)
      .lt('tl_assigned_at', cutoff)

    if (error) logError('AssignWindow query error:', error.message)

    for (const inc of incidents ?? []) {
      // Dedup: skip if already auto-assigned via this window
      const { count } = await admin.from('escalation_events')
        .select('id', { count: 'exact', head: true })
        .eq('incident_id', inc.id).eq('reason', 'tl_assign_window_expired')
      if ((count ?? 0) > 0) continue

      const responder = await findNextResponder(admin, inc.organization_id, inc.citizen_lat, inc.citizen_lng, [])
      if (!responder) continue

      await admin.from('incidents').update({
        assigned_responder_id: responder.id,
        status: 'assigned',
        responder_assigned_at: new Date().toISOString(),
      }).eq('id', inc.id)

      await admin.from('escalation_events').insert({
        incident_id: inc.id,
        escalation_level: 3,
        from_user_id: null,
        to_user_id: responder.id,
        reason: 'tl_assign_window_expired',
        timeout_seconds: ASSIGN_WINDOW,
      })

      await notifyResponder(admin, responder, inc.id, inc.incident_code, logError)
      log('AssignWindow → auto-assigned responder:', inc.incident_code, responder.id)
      counts.assignWindow++
    }
  }

  // ── Stage 3/4/5: assigned responder timed out → next responder or cross-org ──
  {
    const cutoff = new Date(Date.now() - RESPONDER_TIMEOUT * 1000).toISOString()
    const { data: incidents, error } = await admin
      .from('incidents')
      .select('id, incident_code, organization_id, citizen_lat, citizen_lng, assigned_responder_id, organizations!inner(type)')
      .eq('status', 'assigned')
      .not('responder_assigned_at', 'is', null)
      .is('accepted_at', null)
      .lt('responder_assigned_at', cutoff)

    if (error) logError('Stage3/4/5 query error:', error.message)

    for (const inc of incidents ?? []) {
      const triedIds = await getTriedResponderIds(admin, inc.id, inc.assigned_responder_id)
      const nextInOrg = await findNextResponder(admin, inc.organization_id, inc.citizen_lat, inc.citizen_lng, triedIds)

      if (nextInOrg) {
        // Stage 3/4 — try next nearest responder in same org
        await admin.from('incidents').update({
          assigned_responder_id: nextInOrg.id,
          responder_assigned_at: new Date().toISOString(),
        }).eq('id', inc.id)

        await admin.from('escalation_events').insert({
          incident_id: inc.id,
          escalation_level: 3,
          from_user_id: inc.assigned_responder_id,
          to_user_id: nextInOrg.id,
          reason: 'responder_timeout',
          timeout_seconds: RESPONDER_TIMEOUT,
        })

        await notifyResponder(admin, nextInOrg, inc.id, inc.incident_code, logError)
        log('Stage3/4 → next responder assigned:', inc.incident_code, nextInOrg.id)
        counts.stage34++
        continue
      }

      // Stage 5 — no more responders in org, cross-org transfer
      const { count: s5Count } = await admin.from('escalation_events')
        .select('id', { count: 'exact', head: true })
        .eq('incident_id', inc.id).eq('escalation_level', 5)
      if ((s5Count ?? 0) > 0) continue

      const orgType = (inc.organizations as { type: string }).type

      // Find nearest active org of SAME TYPE with at least 1 on-duty responder
      const { data: otherOrgs } = await admin
        .from('organizations')
        .select('id, name, base_lat, base_lng')
        .eq('type', orgType)
        .eq('is_active', true)
        .is('deleted_at', null)
        .neq('id', inc.organization_id)

      if (!otherOrgs?.length) {
        log('Stage5 → no other orgs of type:', orgType, 'for:', inc.incident_code)
        continue
      }

      // Sort by distance to incident, find first org with an on-duty responder
      const sortedOrgs = otherOrgs.sort((a, b) =>
        haversineKm(inc.citizen_lat, inc.citizen_lng, a.base_lat, a.base_lng) -
        haversineKm(inc.citizen_lat, inc.citizen_lng, b.base_lat, b.base_lng)
      )

      let transferOrg: typeof otherOrgs[0] | null = null
      let transferResponder: ResponderRow | null = null

      for (const org of sortedOrgs) {
        const r = await findNextResponder(admin, org.id, inc.citizen_lat, inc.citizen_lng, [])
        if (r) { transferOrg = org; transferResponder = r; break }
      }

      if (!transferOrg || !transferResponder) {
        log('Stage5 → no available org/responder found for:', inc.incident_code)
        continue
      }

      const originalOrgId = inc.organization_id

      await admin.from('incidents').update({
        organization_id: transferOrg.id,
        assigned_responder_id: transferResponder.id,
        responder_assigned_at: new Date().toISOString(),
      }).eq('id', inc.id)

      await admin.from('escalation_events').insert({
        incident_id: inc.id,
        escalation_level: 5,
        from_user_id: null,
        to_user_id: transferResponder.id,
        reason: `cross_org_transfer`,
        timeout_seconds: 0,
      })

      // Notify original org's primary on-duty TL about the transfer
      const { data: originalTL } = await admin
        .from('profiles')
        .select('id, fcm_token')
        .eq('organization_id', originalOrgId)
        .eq('role', 'team_leader')
        .eq('is_on_duty', true)
        .is('deleted_at', null)
        .order('tl_priority', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (originalTL) {
        await insertNotification(admin, originalTL.id, inc.id, 'escalation',
          '⚠️ Incident Transferred',
          `Incident ${inc.incident_code} transferred to ${transferOrg.name} — no available responders in your org.`)
        if (originalTL.fcm_token) {
          await sendPush(originalTL.fcm_token, '⚠️ Incident Transferred',
            `Incident ${inc.incident_code} transferred to ${transferOrg.name} — no available responders in your org.`,
            { incident_id: inc.id, type: 'escalation' }
          ).catch((e) => logError('FCM stage5 TL:', e))
        }
      }

      await notifyResponder(admin, transferResponder, inc.id, inc.incident_code, logError)
      log('Stage5 → transferred to:', transferOrg.name, 'responder:', transferResponder.id, 'for:', inc.incident_code)
      counts.stage5++
    }
  }

  log('Done:', counts)
  return json({ ok: true, ...counts }, 200)
})

// ── Helpers ──────────────────────────────────────────────────────────────────

async function findBackupTL(
  admin: SupabaseClient,
  orgId: string,
  backupTlId: string | null
): Promise<{ id: string; fcm_token: string | null } | null> {
  // Check designated backup_tl_id first
  if (backupTlId) {
    const { data } = await admin.from('profiles')
      .select('id, fcm_token')
      .eq('id', backupTlId)
      .eq('is_on_duty', true)
      .is('deleted_at', null)
      .maybeSingle()
    if (data) return data
  }
  // Fallback: lowest tl_priority > 1 that is on duty
  const { data } = await admin.from('profiles')
    .select('id, fcm_token')
    .eq('organization_id', orgId)
    .eq('role', 'team_leader')
    .gt('tl_priority', 1)
    .eq('is_on_duty', true)
    .is('deleted_at', null)
    .order('tl_priority', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data
}

async function getTriedResponderIds(
  admin: SupabaseClient,
  incidentId: string,
  currentId?: string | null
): Promise<string[]> {
  const { data } = await admin.from('escalation_events')
    .select('to_user_id')
    .eq('incident_id', incidentId)
  const ids = (data ?? [])
    .map((e: { to_user_id: string | null }) => e.to_user_id)
    .filter(Boolean) as string[]
  if (currentId) ids.push(currentId)
  return Array.from(new Set(ids))
}

async function findNextResponder(
  admin: SupabaseClient,
  orgId: string,
  lat: number,
  lng: number,
  excludeIds: string[]
): Promise<ResponderRow | null> {
  let query = admin.from('profiles')
    .select('id, fcm_token, last_known_lat, last_known_lng, full_name')
    .eq('organization_id', orgId)
    .eq('role', 'responder')
    .eq('is_on_duty', true)
    .is('deleted_at', null)

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`)
  }

  const { data: responders } = await query
  if (!responders?.length) return null

  return responders.reduce((best: ResponderRow | null, r: ResponderRow) => {
    if (!r.last_known_lat || !r.last_known_lng) return best ?? r
    if (!best?.last_known_lat || !best?.last_known_lng) return r
    return haversineKm(lat, lng, r.last_known_lat, r.last_known_lng) <
      haversineKm(lat, lng, best.last_known_lat, best.last_known_lng) ? r : best
  }, null)
}

async function insertNotification(
  admin: SupabaseClient,
  userId: string,
  incidentId: string,
  type: string,
  title: string,
  body: string
) {
  await admin.from('notifications').insert({
    user_id: userId, incident_id: incidentId, type, title, body, delivery_status: 'sent',
  })
}

async function notifyResponder(
  admin: SupabaseClient,
  responder: ResponderRow,
  incidentId: string,
  incidentCode: string,
  logError: (...args: unknown[]) => void
) {
  await insertNotification(admin, responder.id, incidentId, 'assignment',
    '🚨 Emergency Assignment',
    `Incident ${incidentCode} assigned to you. Respond immediately.`)
  if (responder.fcm_token) {
    await sendPush(responder.fcm_token, '🚨 Emergency Assignment',
      `Incident ${incidentCode} assigned to you. Respond immediately.`,
      { incident_id: incidentId, type: 'assignment' }
    ).catch((e) => logError('FCM responder notify:', e))
  }
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

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}

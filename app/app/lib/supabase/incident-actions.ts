'use server'

import { redirect } from 'next/navigation'
import { createClient } from './server'
import { getCurrentUserWithProfile } from './profile'
import { sendPush } from '../notifications/fcm'

export async function toggleTLDutyAction(): Promise<{ success: boolean; isOnDuty?: boolean; error?: string }> {
  const current = await getCurrentUserWithProfile()
  if (!current || (current.profile?.role !== 'team_leader' && current.profile?.role !== 'super_admin')) {
    return { success: false, error: 'Unauthorized' }
  }

  const supabase = createClient()
  const newStatus = !current.profile?.is_on_duty

  const { error } = await supabase
    .from('profiles')
    .update({ is_on_duty: newStatus })
    .eq('id', current.userId)

  if (error) return { success: false, error: error.message }
  return { success: true, isOnDuty: newStatus }
}

export async function acknowledgeTLAction(incidentId: string): Promise<{ success: boolean; error?: string }> {
  const current = await getCurrentUserWithProfile()
  if (!current || current.profile?.role !== 'team_leader') {
    return { success: false, error: 'Unauthorized' }
  }

  const supabase = createClient()

  const { error } = await supabase
    .from('incidents')
    .update({
      tl_acknowledged_at: new Date().toISOString(),
      acknowledged_by_tl_id: current.userId,
    })
    .eq('id', incidentId)
    .is('tl_acknowledged_at', null)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

const STATUS_TIMESTAMP_FIELD: Record<string, string> = {
  en_route: 'en_route_at',
  arrived:  'arrived_at',
  resolved: 'resolved_at',
}

// Statuses where a responder is already in motion or the incident is closed — assignment must be blocked.
const ASSIGN_BLOCKED_STATUSES = ['en_route', 'arrived', 'pending_citizen_confirmation', 'resolved', 'closed']

// Web-responder status transitions that stop before resolve.
// arrived → pending_citizen_confirmation goes through resolveWithReportAction instead.
const WEB_STATUS_TRANSITIONS: Record<string, string> = {
  assigned: 'accepted',
  accepted: 'en_route',
  en_route: 'arrived',
}

export async function updateIncidentStatusAction(
  incidentId: string,
  currentStatus: string
): Promise<{ success: boolean; error?: string }> {
  const current = await getCurrentUserWithProfile()
  if (!current || current.profile?.role !== 'responder') {
    return { success: false, error: 'Unauthorized' }
  }

  const nextStatus = WEB_STATUS_TRANSITIONS[currentStatus]
  if (!nextStatus) return { success: false, error: `No transition from status: ${currentStatus}` }

  const supabase = createClient()
  const now = new Date().toISOString()

  const updatePayload: Record<string, string> = { status: nextStatus }
  const tsField = STATUS_TIMESTAMP_FIELD[nextStatus]
  if (tsField) updatePayload[tsField] = now

  const { error } = await supabase
    .from('incidents')
    .update(updatePayload)
    .eq('id', incidentId)
    .eq('assigned_responder_id', current.userId)

  if (error) {
    console.error('[updateIncidentStatusAction] failed:', error.message)
    return { success: false, error: 'Failed to update status' }
  }

  return { success: true }
}

export async function resolveWithReportAction(
  incidentId: string,
  notes: string
): Promise<{ success: boolean; error?: string }> {
  const current = await getCurrentUserWithProfile()
  if (!current || current.profile?.role !== 'responder') {
    return { success: false, error: 'Unauthorized' }
  }

  const supabase = createClient()
  const now = new Date().toISOString()

  const { data: inc } = await supabase
    .from('incidents')
    .select('responder_assigned_at, citizen_id, incident_code')
    .eq('id', incidentId)
    .single()

  const updatePayload: Record<string, string | number> = {
    status: 'pending_citizen_confirmation',
    notes,
    resolved_by: current.userId,
  }

  if (inc?.responder_assigned_at) {
    const diffMs = new Date(now).getTime() - new Date(inc.responder_assigned_at).getTime()
    updatePayload.response_time_seconds = Math.round(diffMs / 1000)
  }

  const { error } = await supabase
    .from('incidents')
    .update(updatePayload)
    .eq('id', incidentId)
    .eq('assigned_responder_id', current.userId)

  if (error) {
    console.error('[resolveWithReportAction] failed:', error.message)
    return { success: false, error: 'Failed to submit report' }
  }

  if (inc?.citizen_id) {
    const { data: citizenProfile } = await supabase
      .from('profiles')
      .select('fcm_token')
      .eq('id', inc.citizen_id)
      .single()

    if (citizenProfile?.fcm_token && inc.incident_code) {
      await sendPush(
        citizenProfile.fcm_token,
        '✅ Emergency Handled',
        `Responder has resolved incident ${inc.incident_code}. Please confirm if your emergency was handled.`,
        { incident_id: incidentId, type: 'citizen_confirmation' }
      ).catch((err) => console.error('[resolveWithReportAction] FCM push failed:', err))
    }
  }

  return { success: true }
}

export async function assignResponder(incidentId: string, responderId: string) {
  const current = await getCurrentUserWithProfile()

  if (!current || (current.profile?.role !== 'team_leader' && current.profile?.role !== 'super_admin')) {
    redirect('/dashboard')
  }

  const supabase = createClient()

  const { data: existing } = await supabase
    .from('incidents')
    .select('status')
    .eq('id', incidentId)
    .single()
  if (!existing || ASSIGN_BLOCKED_STATUSES.includes(existing.status)) {
    throw new Error('Cannot assign: incident is already in progress or resolved')
  }

  const now = new Date().toISOString()

  const { error } = await supabase
    .from('incidents')
    .update({
      assigned_responder_id: responderId,
      assigned_tl_id: current.userId,
      status: 'assigned',
      tl_assigned_at: now,
      responder_assigned_at: now,
    })
    .eq('id', incidentId)

  if (error) {
    console.error('[assignResponder] update failed:', error.message)
    throw new Error('Failed to assign responder')
  }

  // Fetch responder FCM token and incident code for push notification
  const { data: responderProfile } = await supabase
    .from('profiles')
    .select('fcm_token, full_name')
    .eq('id', responderId)
    .single()

  const { data: incidentRow } = await supabase
    .from('incidents')
    .select('incident_code')
    .eq('id', incidentId)
    .single()

  if (responderProfile?.fcm_token && incidentRow?.incident_code) {
    await sendPush(
      responderProfile.fcm_token,
      '🚨 Incident Assigned',
      `You have been assigned to incident ${incidentRow.incident_code}`,
      { incident_id: incidentId, type: 'assignment' }
    ).catch((err) => console.error('[assignResponder] FCM push failed:', err))
  }

  redirect(`/dashboard/tl/incidents/${incidentId}`)
}

export async function assignResponderAction(
  incidentId: string,
  responderId: string
): Promise<{ success: boolean; error?: string }> {
  const current = await getCurrentUserWithProfile()

  if (!current || (current.profile?.role !== 'team_leader' && current.profile?.role !== 'super_admin')) {
    return { success: false, error: 'Unauthorized' }
  }

  const supabase = createClient()

  const { data: existing } = await supabase
    .from('incidents')
    .select('status, assigned_responder_id, incident_code')
    .eq('id', incidentId)
    .single()
  if (!existing || ASSIGN_BLOCKED_STATUSES.includes(existing.status)) {
    return { success: false, error: 'Cannot assign: incident is already in progress or resolved' }
  }

  const previousResponderId = existing.assigned_responder_id ?? null
  const incidentCode = existing.incident_code

  const now = new Date().toISOString()

  const { error } = await supabase
    .from('incidents')
    .update({
      assigned_responder_id: responderId,
      assigned_tl_id: current.userId,
      status: 'assigned',
      tl_assigned_at: now,
      responder_assigned_at: now,
    })
    .eq('id', incidentId)

  if (error) {
    console.error('[assignResponderAction] update failed:', error.message)
    return { success: false, error: 'Failed to assign responder' }
  }

  // Notify previously assigned responder they have been unassigned
  if (previousResponderId && previousResponderId !== responderId) {
    const { data: prevProfile } = await supabase
      .from('profiles')
      .select('fcm_token')
      .eq('id', previousResponderId)
      .single()
    if (prevProfile?.fcm_token) {
      await sendPush(
        prevProfile.fcm_token,
        'Assignment Cancelled',
        `You have been unassigned from incident ${incidentCode}. Stand by.`,
        { incident_id: incidentId, type: 'unassignment' }
      ).catch((err) => console.error('[assignResponderAction] FCM unassign push failed:', err))
    }
  }

  // Notify newly assigned responder
  const { data: responderProfile } = await supabase
    .from('profiles')
    .select('fcm_token')
    .eq('id', responderId)
    .single()

  if (responderProfile?.fcm_token) {
    await sendPush(
      responderProfile.fcm_token,
      '🚨 Incident Assigned',
      `You have been assigned to incident ${incidentCode}`,
      { incident_id: incidentId, type: 'assignment' }
    ).catch((err) => console.error('[assignResponderAction] FCM assign push failed:', err))
  }

  return { success: true }
}

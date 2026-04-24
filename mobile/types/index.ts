export type UserRole = 'citizen' | 'responder' | 'team_leader' | 'super_admin'

export type EmergencyType = 'crime' | 'medical'

export type IncidentStatus =
  | 'pending'
  | 'escalated'
  | 'acknowledged'
  | 'assigned'
  | 'accepted'
  | 'en_route'
  | 'arrived'
  | 'pending_citizen_confirmation'
  | 'resolved'
  | 'closed'

export interface Profile {
  id: string
  full_name: string | null
  role: UserRole
  organization_id: string | null
  is_on_duty: boolean
  is_suspended: boolean
  fcm_token: string | null
  abuse_strike_count: number
  phone_number: string | null
  phone_verified: boolean
  email: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Incident {
  id: string
  incident_code: string
  status: IncidentStatus
  emergency_type: EmergencyType
  citizen_id: string
  organization_id: string | null
  assigned_responder_id: string | null
  assigned_tl_id: string | null
  citizen_lat: number | null
  citizen_lng: number | null
  citizen_address: string | null
  notes: string | null
  created_at: string
  tl_notified_at: string | null
  escalated_at: string | null
  responder_assigned_at: string | null
  accepted_at: string | null
  en_route_at: string | null
  arrived_at: string | null
  resolved_at: string | null
  closed_at: string | null
  resolved_by: string | null
  responder_lat: number | null
  responder_lng: number | null
  citizen_confirmed: boolean | null
  citizen_confirmed_at: string | null
}

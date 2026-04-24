export type UserRole =
  | 'citizen'
  | 'team_leader'
  | 'responder'
  | 'super_admin'

export interface Profile {
  id: string
  full_name: string
  phone_number: string
  phone_verified: boolean
  role: UserRole
  organization_id: string | null
  tl_priority: number | null
  is_on_duty: boolean
  last_known_lat: number | null
  last_known_lng: number | null
  last_location_updated_at: string | null
  last_seen_at: string | null
  avatar_url: string | null
  fcm_token: string | null
  abuse_strike_count: number
  is_suspended: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}
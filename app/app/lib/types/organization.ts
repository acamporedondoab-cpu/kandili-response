export type OrganizationType = 'police' | 'medical' | 'fire' | 'rescue'

export interface Organization {
  id: string
  name: string
  type: OrganizationType
  base_lat: number
  base_lng: number
  coverage_radius_km: number
  backup_tl_id: string | null
  is_active: boolean
  logo_url: string | null
  deleted_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}
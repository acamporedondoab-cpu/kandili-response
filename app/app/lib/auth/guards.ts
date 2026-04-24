import { redirect } from 'next/navigation'
import type { UserRole } from '../types/profile'
import type { UserWithProfile } from '../supabase/profile'

export function requireRole(
  current: UserWithProfile | null,
  allowedRoles: UserRole[]
): void {
  if (!current || !current.profile) {
    redirect('/login')
  }

  if (!allowedRoles.includes(current.profile.role)) {
    redirect('/dashboard')
  }
}
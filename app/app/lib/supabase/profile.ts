import { createClient } from './server'
import type { Profile } from '../types/profile'

export interface UserWithProfile {
  userId: string
  email: string | undefined
  profile: Profile | null
}

export async function getCurrentUserWithProfile(): Promise<UserWithProfile | null> {
  const supabase = createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return null
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.error('[getCurrentUserWithProfile] profile fetch failed:', profileError.message)
  }

  return {
    userId: user.id,
    email: user.email,
    profile: profile ?? null,
  }
}
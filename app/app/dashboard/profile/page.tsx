import { redirect } from 'next/navigation'
import { getCurrentUserWithProfile } from '../../lib/supabase/profile'
import ProfileClient from './ProfileClient'

export default async function ProfilePage() {
  const current = await getCurrentUserWithProfile()
  if (!current) redirect('/login')

  const { email, profile } = current
  if (!profile) redirect('/login')

  return (
    <ProfileClient
      fullName={profile.full_name ?? ''}
      email={email ?? ''}
      phone={profile.phone_number ?? ''}
      role={profile.role}
    />
  )
}

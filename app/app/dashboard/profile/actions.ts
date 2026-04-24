'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../lib/supabase/server'

export async function updateProfileAction(formData: FormData): Promise<{ error?: string; success?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const full_name = (formData.get('full_name') as string)?.trim()
  const phone_number = (formData.get('phone_number') as string)?.trim()

  if (!full_name) return { error: 'Full name is required.' }

  const { error } = await supabase
    .from('profiles')
    .update({ full_name, phone_number })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/profile')
  return { success: 'Profile updated.' }
}

export async function updateEmailAction(formData: FormData): Promise<{ error?: string; success?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const email = (formData.get('email') as string)?.trim().toLowerCase()
  if (!email || !email.includes('@')) return { error: 'Enter a valid email address.' }

  const { error } = await supabase.auth.updateUser({ email })
  if (error) return { error: error.message }

  return { success: 'Confirmation sent to new email. Check your inbox.' }
}

export async function updatePasswordAction(formData: FormData): Promise<{ error?: string; success?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const current_password = (formData.get('current_password') as string)
  const new_password = (formData.get('new_password') as string)
  const confirm_password = (formData.get('confirm_password') as string)

  if (!current_password || !new_password || !confirm_password) return { error: 'All password fields are required.' }
  if (new_password.length < 8) return { error: 'New password must be at least 8 characters.' }
  if (new_password !== confirm_password) return { error: 'Passwords do not match.' }

  // Verify current password by re-authenticating
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: current_password,
  })
  if (signInError) return { error: 'Current password is incorrect.' }

  const { error } = await supabase.auth.updateUser({ password: new_password })
  if (error) return { error: error.message }

  return { success: 'Password updated successfully.' }
}

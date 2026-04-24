import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-citizen-auth-secret',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const secret = Deno.env.get('CITIZEN_AUTH_SECRET')
  if (secret) {
    const provided = req.headers.get('x-citizen-auth-secret') ?? ''
    if (provided !== secret) {
      return json({ error: 'Unauthorized' }, 401)
    }
  }

  const requestId = crypto.randomUUID()
  const log = (msg: string, ...args: unknown[]) =>
    console.log(`[citizen-auth][${requestId}]`, msg, ...args)
  const logError = (msg: string, ...args: unknown[]) =>
    console.error(`[citizen-auth][${requestId}]`, msg, ...args)

  let body: { phone?: string; firebase_uid?: string; full_name?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { phone, firebase_uid, full_name } = body

  if (!phone || !firebase_uid) {
    return json({ error: 'phone and firebase_uid are required' }, 400)
  }

  if (!/^\+\d{10,15}$/.test(phone)) {
    return json({ error: 'Invalid phone format. Expected E.164, e.g. +639171234567' }, 400)
  }

  log('Request for phone:', phone.slice(0, 6) + '****')

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const syntheticEmail = `firebase_${firebase_uid}@guardian.internal`
  const syntheticPassword = firebase_uid

  // Look up existing citizen profile by phone number
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('phone_number', phone)
    .eq('role', 'citizen')
    .maybeSingle()

  if (existingProfile) {
    // Profile exists — verify the auth user also exists
    const { data: authData, error: authLookupError } = await admin.auth.admin.getUserById(existingProfile.id)

    if (!authLookupError && authData?.user) {
      // Auth user exists — check if credentials match (email may differ if Firebase UID changed)
      if (authData.user.email !== syntheticEmail) {
        // Update auth user email/password to match current Firebase UID
        log('Updating credentials for returning citizen:', existingProfile.id)
        await admin.auth.admin.updateUserById(existingProfile.id, {
          email: syntheticEmail,
          password: syntheticPassword,
          email_confirm: true,
        })
      } else {
        log('Returning citizen found:', existingProfile.id)
      }
      return json({ email: syntheticEmail, password: syntheticPassword }, 200)
    }

    // Auth user is missing (orphaned profile) — recreate it with the same UUID
    log('Orphaned profile detected — recreating auth user:', existingProfile.id)
    const { error: recreateError } = await admin.auth.admin.createUser({
      id: existingProfile.id,
      email: syntheticEmail,
      password: syntheticPassword,
      email_confirm: true,
    })

    if (recreateError) {
      logError('Failed to recreate auth user:', recreateError.message)
      return json({ error: 'Failed to restore account' }, 500)
    }

    log('Auth user recreated for existing citizen:', existingProfile.id)
    return json({ email: syntheticEmail, password: syntheticPassword }, 200)
  }

  // No profile — new user, create auth account and profile
  log('New user — creating Supabase account')

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: syntheticEmail,
    password: syntheticPassword,
    email_confirm: true,
  })

  if (createError) {
    logError('Failed to create user:', createError.message)
    return json({ error: 'Failed to create account' }, 500)
  }

  const userId = created.user.id

  const { error: profileError } = await admin.from('profiles').insert({
    id: userId,
    full_name: full_name?.trim() || phone,
    phone_number: phone,
    phone_verified: true,
    role: 'citizen',
  })

  if (profileError) {
    logError('Failed to create profile:', profileError.message)
    await admin.auth.admin.deleteUser(userId)
    return json({ error: 'Failed to create profile' }, 500)
  }

  log('Created new citizen account:', userId)
  return json({ email: syntheticEmail, password: syntheticPassword }, 200)
})

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

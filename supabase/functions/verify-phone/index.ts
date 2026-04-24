import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401)
  }

  // Use user-scoped client for JWT validation (supports ES256 algorithm)
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { phone_number } = typeof body === 'object' && body !== null
    ? body as Record<string, unknown>
    : {}

  if (
    typeof phone_number !== 'string' ||
    !phone_number.startsWith('+') ||
    phone_number.length < 10
  ) {
    return json({ error: 'Invalid phone number. Must include country code, e.g. +639171234567' }, 400)
  }

  const { error: updateError } = await adminClient
    .from('profiles')
    .update({ phone_number, phone_verified: true })
    .eq('id', user.id)

  if (updateError) {
    // Unique constraint violation — phone already registered to another account
    if (updateError.code === '23505') {
      return json({ error: 'This phone number is already registered to another account.' }, 409)
    }
    console.error('[verify-phone] update failed:', updateError.message)
    return json({ error: 'Failed to update profile' }, 500)
  }

  return json({ success: true })
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Content-Type': 'application/json',
    },
  })
}

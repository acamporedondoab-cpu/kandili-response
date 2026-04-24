import * as jose from 'npm:jose'

/**
 * Obtains a short-lived OAuth2 access token using a Firebase service account.
 * Token is valid for 1 hour — sufficient for a single Edge Function invocation.
 */
async function getAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  const privateKeyObj = await jose.importPKCS8(privateKey, 'RS256')

  const assertion = await new jose.SignJWT({
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(clientEmail)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKeyObj)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OAuth token exchange failed: ${text}`)
  }

  const data = await res.json()
  return data.access_token as string
}

/**
 * Sends a single FCM push notification to a device token.
 * Returns true on success, false if the token is invalid/unregistered (non-fatal).
 * Throws on unexpected server errors.
 */
export async function sendPush(
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID')
  const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL')
  const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY')

  if (!projectId || !clientEmail || !privateKey) {
    console.warn('[fcm] Missing Firebase env vars — skipping push')
    return false
  }

  const accessToken = await getAccessToken(clientEmail, privateKey.replace(/\\n/g, '\n'))

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          notification: { title, body },
          ...(data ? { data } : {}),
        },
      }),
    }
  )

  if (res.ok) return true

  const err = await res.json().catch(() => ({}))
  const errorCode = err?.error?.details?.[0]?.errorCode ?? ''

  // Unregistered/invalid token — not a hard error, just stale token
  if (errorCode === 'UNREGISTERED' || res.status === 404) {
    console.warn('[fcm] Token unregistered — skipping:', fcmToken.slice(0, 16))
    return false
  }

  throw new Error(`[fcm] Unexpected FCM error ${res.status}: ${JSON.stringify(err)}`)
}

/**
 * Sends push notifications to multiple FCM tokens.
 * Invalid tokens are silently skipped.
 */
export async function sendPushToMany(
  fcmTokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  const valid = fcmTokens.filter(Boolean)
  if (valid.length === 0) return
  await Promise.allSettled(valid.map((t) => sendPush(t, title, body, data)))
}

import { SignJWT, importPKCS8 } from 'jose'

async function getAccessToken(): Promise<string | null> {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY
  const projectId = process.env.FIREBASE_PROJECT_ID

  if (!clientEmail || !privateKeyRaw || !projectId) {
    console.warn('[fcm] Missing Firebase env vars — push skipped')
    return null
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n')
  const now = Math.floor(Date.now() / 1000)

  const privateKeyObj = await importPKCS8(privateKey, 'RS256')

  const assertion = await new SignJWT({
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
    console.error('[fcm] OAuth token exchange failed:', await res.text())
    return null
  }

  const data = await res.json()
  return data.access_token as string
}

export async function sendPush(
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  const projectId = process.env.FIREBASE_PROJECT_ID
  if (!projectId) return

  const accessToken = await getAccessToken()
  if (!accessToken) return

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

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const errorCode = err?.error?.details?.[0]?.errorCode ?? ''
    if (errorCode === 'UNREGISTERED' || res.status === 404) {
      console.warn('[fcm] Token unregistered, skipping')
      return
    }
    console.error('[fcm] Send failed:', err)
  }
}

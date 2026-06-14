/**
 * Cloudflare Turnstile server-side verification (HD1).
 *
 * Setup:
 *   1. Go to https://dash.cloudflare.com and add a Turnstile widget
 *   2. Set TURNSTILE_SECRET_KEY in .env.local (never expose to client)
 *   3. Set NEXT_PUBLIC_TURNSTILE_SITE_KEY in .env.local (safe to expose)
 *   4. Add the Turnstile widget to any public form that calls a write endpoint
 *
 * Fail-safe behaviour:
 *   - In production with no secret key configured: blocks the request (safer than allowing).
 *   - In development with no secret key: passes through (avoids dev friction).
 *   - Any Turnstile API error: blocks the request (treat unknown as failed).
 */

interface TurnstileResponse {
  success: boolean
  'error-codes'?: string[]
}

export async function verifyTurnstile(token: string | undefined | null, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY

  if (!secret) {
    if (process.env.NODE_ENV !== 'production') {
      // Dev with no key: skip verification so local testing works without Turnstile configured.
      return true
    }
    console.error('[captcha] TURNSTILE_SECRET_KEY is not set in production — blocking request.')
    return false
  }

  if (!token) return false

  const body = new URLSearchParams()
  body.append('secret', secret)
  body.append('response', token)
  if (ip) body.append('remoteip', ip)

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    if (!res.ok) {
      console.error(`[captcha] Turnstile API returned ${res.status}`)
      return false
    }
    const data = (await res.json()) as TurnstileResponse
    return data.success === true
  } catch (err) {
    console.error('[captcha] Turnstile verification error:', (err as Error)?.message)
    return false
  }
}

import { cookies } from 'next/headers'
import type { Payload } from 'payload'

/**
 * Resolve the logged-in user from the Payload session cookie in a Server
 * Component or Route Handler.
 *
 * Why not `payload.auth({ headers })` directly? In this setup `payload.auth`
 * does NOT read the `payload-token` cookie from the request headers (it returns
 * null), but it DOES verify a token passed as `Authorization: JWT <token>`.
 * So we read the cookie value ourselves and hand it to payload.auth as a JWT.
 * This is the reliable path for cookie-based auth in custom routes/pages.
 *
 * Returns the user object, or null if not authenticated.
 */
export async function getAuthUser(payload: Payload) {
  const token = (await cookies()).get('payload-token')?.value
  if (!token) return null
  const headers = new Headers()
  headers.set('Authorization', `JWT ${token}`)
  const { user } = await payload.auth({ headers })
  return user ?? null
}

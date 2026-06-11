import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'

export const dynamic = 'force-dynamic'

/**
 * Cookie-aware "who am I" for client components (header, saved-items provider).
 *
 * Why not Payload's /api/users/me? In this setup payload.auth does NOT read the
 * payload-token cookie (it only honors an Authorization: JWT header), so the REST
 * me endpoint returns null for cookie sessions. getAuthUser reads the cookie and
 * hands the token to payload.auth as a JWT (see lib/auth-user.ts). This route
 * returns only the small, non-sensitive shape the client needs.
 */
export async function GET() {
  try {
    const payload = await getPayload({ config })
    const user = await getAuthUser(payload)
    if (!user) {
      return NextResponse.json({ user: null }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const u = user as unknown as Record<string, unknown>
    const ids = (value: unknown): string[] =>
      Array.isArray(value)
        ? value.map((v) => (typeof v === 'object' && v !== null ? String((v as { id?: unknown }).id) : String(v)))
        : []

    return NextResponse.json(
      {
        user: {
          id: user.id,
          name: (u.name as string) ?? null,
          email: user.email,
          role: (u.role as string) ?? null,
          savedProviders: ids(u.savedProviders),
          savedClinics: ids(u.savedClinics),
          quizRecommendation: (u.quizRecommendation as string) ?? null,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return NextResponse.json({ user: null }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
  }
}

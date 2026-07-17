import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { RateLimiter, checkOrigin, getIp } from '@/lib/rate-limit'

// A 6-digit code is only 1e6 possibilities, so keep this tight to block brute
// force (mirrors /api/auth/verify-signup).
const limiter = new RateLimiter(10, 15 * 60 * 1000)

const VerifySchema = z.object({
  token: z.string().min(1).max(200),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
})

/**
 * Confirms the email on a submitted claim. The claim page holds an opaque
 * verifyToken (returned by POST /api/claims) and posts it back with the code
 * the claimant received. Success flips the claim's emailVerified flag — an
 * admin signal only, it never gates or auto-approves anything.
 */
export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  if (!limiter.check(getIp(req))) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a little and try again.' },
      { status: 429 },
    )
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = VerifySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation failed.' },
      { status: 422 },
    )
  }
  const { token, code } = parsed.data

  const payload = await getPayload({ config })

  const res = await payload.find({
    collection: 'claims',
    where: { verifyToken: { equals: token } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const claim = res.docs[0] as any

  // One generic message for missing/expired/wrong — never reveal which.
  const invalid = () =>
    NextResponse.json({ error: 'Invalid or expired code. Please try again.' }, { status: 400 })

  if (!claim) return invalid()
  if (claim.emailVerified) {
    // Idempotent: a stale tab re-submitting a good code is still a success.
    return NextResponse.json({ success: true })
  }
  if (!claim.verificationCode || !claim.verificationCodeExpiry) return invalid()
  if (new Date(claim.verificationCodeExpiry).getTime() < Date.now()) return invalid()
  if (claim.verificationCode !== code) return invalid()

  try {
    await payload.update({
      collection: 'claims',
      id: claim.id,
      data: {
        emailVerified: true,
        verificationCode: null,
        verificationCodeExpiry: null,
      } as any,
      overrideAccess: true,
    })
  } catch (err) {
    payload.logger.error(`[claims/verify] update failed: ${(err as Error)?.message}`)
    return NextResponse.json({ error: 'Could not confirm your email. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

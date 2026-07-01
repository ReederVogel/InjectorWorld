import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { RateLimiter, checkOrigin, getIp } from '@/lib/rate-limit'

// Strict: a 6-digit code is only 1e6 possibilities, so this must be tighter
// than the signup limiter (5/hour) to actually block brute force.
const limiter = new RateLimiter(10, 15 * 60 * 1000)

const VerifySchema = z.object({
  email: z.string().email('Enter a valid email address'),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
})

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
  const { email, code } = parsed.data

  const payload = await getPayload({ config })

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })
  const user = existing.docs[0] as any

  // Same generic message whether the email doesn't exist, the code is wrong,
  // or the code expired -- never reveal which, so this can't be used to probe
  // for registered emails.
  const invalid = () =>
    NextResponse.json({ error: 'Invalid or expired code. Please try again.' }, { status: 400 })

  if (!user || !user.verificationCode || !user.verificationCodeExpiry) return invalid()
  if (user.emailVerified) {
    // Already verified (e.g. a stale tab re-submitting) -- treat as success.
    return NextResponse.json({ success: true })
  }
  if (new Date(user.verificationCodeExpiry).getTime() < Date.now()) return invalid()
  if (user.verificationCode !== code) return invalid()

  try {
    await payload.update({
      collection: 'users',
      id: user.id,
      overrideAccess: true,
      data: {
        emailVerified: true,
        verificationCode: null,
        verificationCodeExpiry: null,
      } as never,
    })
  } catch (err) {
    payload.logger.error(`[auth/verify-signup] update failed: ${(err as Error)?.message}`)
    return NextResponse.json({ error: 'Could not verify your account. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

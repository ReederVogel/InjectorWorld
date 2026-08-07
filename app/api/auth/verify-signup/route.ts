import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { RateLimiter, checkOrigin, getIp } from '@/lib/rate-limit'
import { verificationCodeMatches } from '@/lib/verification-code'

// Strict: a 6-digit code is only 1e6 possibilities, so this must be tighter
// than the signup limiter (5/hour) to actually block brute force.
const limiter = new RateLimiter(10, 15 * 60 * 1000)

/**
 * Second limiter, keyed on the target account instead of the caller.
 *
 * The per-IP limiter above bounds what ONE source can try. It does nothing
 * against a distributed attempt: rotate through a few hundred addresses and each
 * one gets its own fresh budget against the same victim. Keying on the email
 * being verified closes that, because every attempt against a given account
 * shares one counter no matter where it came from.
 *
 * With 10 attempts per 15 minutes an account can absorb at most ~960 guesses a
 * day against a 1,000,000-value space, and the code itself expires in 10
 * minutes, so the search never gets anywhere near coverage.
 *
 * KNOWN TRADEOFF: because every attempt counts, not just failed ones, somebody
 * can deliberately burn a victim's budget and make them wait out the window.
 * That is a 15-minute nuisance, and it is the better side of the trade — the
 * alternative is leaving distributed brute force unbounded. Do not "fix" it by
 * removing this limiter.
 */
const accountLimiter = new RateLimiter(10, 15 * 60 * 1000)

const VerifySchema = z.object({
  email: z.string().email('Enter a valid email address'),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
})

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  if (!(await limiter.check(getIp(req)))) {
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

  // Lowercased so Foo@bar.com and foo@bar.com cannot be used as two separate
  // budgets against the same account.
  if (!(await accountLimiter.check(`verify-signup:${email.toLowerCase()}`))) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a little and try again.' },
      { status: 429 },
    )
  }

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
  if (!verificationCodeMatches(code, user.verificationCode)) return invalid()

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

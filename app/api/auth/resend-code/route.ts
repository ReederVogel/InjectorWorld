import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { emailShell } from '@/lib/email'
import { RateLimiter, checkOrigin, getIp } from '@/lib/rate-limit'

// Same ceiling as verify-signup -- a resend is also a way to keep guessing a
// code, so it must not be looser than the verify limiter.
const limiter = new RateLimiter(5, 15 * 60 * 1000)

const ResendSchema = z.object({
  email: z.string().email('Enter a valid email address'),
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

  const parsed = ResendSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation failed.' },
      { status: 422 },
    )
  }
  const { email } = parsed.data

  const payload = await getPayload({ config })

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })
  const user = existing.docs[0] as any

  // Non-revealing response either way -- a missing/already-verified account
  // just silently no-ops, same shape as a real resend.
  if (!user || user.emailVerified) {
    return NextResponse.json({ success: true })
  }

  const code = String(Math.floor(100000 + Math.random() * 900000))
  const codeExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  try {
    await payload.update({
      collection: 'users',
      id: user.id,
      overrideAccess: true,
      data: { verificationCode: code, verificationCodeExpiry: codeExpiry } as never,
    })
  } catch (err) {
    payload.logger.error(`[auth/resend-code] update failed: ${(err as Error)?.message}`)
    return NextResponse.json({ error: 'Could not resend the code. Please try again.' }, { status: 500 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'
  try {
    await payload.sendEmail({
      to: email,
      subject: `${code} is your injector.world verification code`,
      html: emailShell({
        siteUrl,
        heading: 'Verify your email',
        bodyHtml: `
          <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#475569;">
            Here is a new code. It expires in 10 minutes.
          </p>
          <p style="margin:0 0 22px;font-size:32px;font-weight:700;letter-spacing:0.08em;color:#0B1B34;">${code}</p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#94A3B8;">
            If you did not request this, you can safely ignore this email.
          </p>`,
      }),
    })
  } catch (err) {
    payload.logger.error(`[auth/resend-code] email failed: ${(err as Error)?.message}`)
    return NextResponse.json(
      { error: 'Could not send the email. Please try again shortly.' },
      { status: 502 },
    )
  }

  return NextResponse.json({ success: true })
}

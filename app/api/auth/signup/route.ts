import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { emailShell, primaryButton } from '@/lib/email'
import { RateLimiter, checkOrigin, getIp } from '@/lib/rate-limit'
import { verifyTurnstile } from '@/lib/captcha'

// In-memory rate limit: max 5 signups per IP per hour. (Single-instance only;
// move to Redis before scaling — see ROADMAP Phase 12.)
const limiter = new RateLimiter(5, 60 * 60 * 1000)

const SignupSchema = z.object({
  name: z.string().min(1, 'Your name is required').max(200),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  cfTurnstileToken: z.string().optional(),
})

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  if (!limiter.check(getIp(req))) {
    return NextResponse.json(
      { error: 'Too many sign-up attempts. Please wait a little and try again.' },
      { status: 429 },
    )
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  // Honeypot: bots fill hidden fields; humans leave them empty.
  if ((raw as any)?.website) {
    return NextResponse.json({ success: true })
  }

  const parsed = SignupSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as string
      if (key) fieldErrors[key] = issue.message
    }
    return NextResponse.json({ error: 'Validation failed.', fieldErrors }, { status: 422 })
  }

  const { name, email, password, cfTurnstileToken } = parsed.data

  const captchaOk = await verifyTurnstile(cfTurnstileToken, getIp(req))
  if (!captchaOk) {
    return NextResponse.json({ error: 'CAPTCHA verification failed. Please try again.' }, { status: 400 })
  }
  const safeName = name.replace(/[\r\n]/g, ' ').trim()

  const payload = await getPayload({ config })

  // Check if an account already exists for this email.
  // M4: Do NOT return a 409 or any message that reveals whether the email is
  // registered — that leaks the account list to an enumerator. Instead return
  // generic success so the caller cannot distinguish "created" from "exists".
  // A "sign-in instead" email is sent to the address so the real owner is informed.
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs.length > 0) {
    const siteUrlEarly = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'
    try {
      await payload.sendEmail({
        to: email,
        subject: 'Someone tried to create an account with your email',
        html: emailShell({
          siteUrl: siteUrlEarly,
          heading: 'Account already exists',
          bodyHtml: `
            <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#475569;">
              Someone tried to sign up on injector.world using this email address, but an
              account already exists. If this was you, sign in instead.
            </p>
            <p style="margin:0 0 22px;">${primaryButton(`${siteUrlEarly}/login`, 'Sign in to your account')}</p>
            <p style="margin:0;font-size:13px;line-height:1.6;color:#94A3B8;">
              If this was not you, you can safely ignore this email.
            </p>`,
        }),
      })
    } catch {
      // Email failure is non-fatal and must not reveal the account's existence.
    }
    return NextResponse.json({ success: true })
  }

  // Create the patient account. `role` defaults to "patient"; even though we set
  // it explicitly here with overrideAccess, the field's own access control would
  // block a non-staff caller from elevating it, so a patient can never self-promote.
  try {
    await payload.create({
      collection: 'users',
      data: { name: safeName, email, password, role: 'patient' } as never,
      overrideAccess: true,
    })
  } catch (err) {
    payload.logger.error(`[auth/signup] create failed: ${(err as Error)?.message}`)
    return NextResponse.json(
      { error: 'Could not create your account. Please try again.' },
      { status: 500 },
    )
  }

  // Welcome email (non-blocking). Verification is optional for now (founder call),
  // so the account is usable immediately; this is informational, not a gate.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'
  try {
    await payload.sendEmail({
      to: email,
      subject: 'Welcome to injector.world',
      html: emailShell({
        siteUrl,
        heading: `Welcome, ${safeName.split(' ')[0] || 'there'}`,
        bodyHtml: `
          <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#475569;">
            Your account is ready. You can now save providers and clinics, track your consult
            requests, and ask questions, all in one place.
          </p>
          <p style="margin:0 0 22px;">${primaryButton(`${siteUrl}/profile`, 'Go to your profile')}</p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#94A3B8;">
            injector.world is editorial and not medical advice. Always consult a licensed provider.
          </p>`,
      }),
    })
  } catch {
    // Email failure is non-fatal; the account was created.
  }

  // The client logs in next (reusing Payload's cookie-setting /api/users/login),
  // so we do not set the session cookie here.
  return NextResponse.json({ success: true })
}

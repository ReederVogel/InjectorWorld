import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { sendConfirmEmail } from '@/lib/newsletter-email'
import { RateLimiter, checkOrigin, getIp } from '@/lib/rate-limit'

// 3 signup attempts per IP per hour.
const limiter = new RateLimiter(3, 60 * 60 * 1000)

// Per-email resend cooldown: suppress duplicate confirmation emails for 1 hour.
// Prevents an attacker from using this endpoint to spam a victim's inbox.
const resendCooldown = new Map<string, number>()
const RESEND_COOLDOWN_MS = 60 * 60 * 1000

const Schema = z.object({
  email: z.string().email('Enter a valid email address').max(254),
  name: z.string().max(100).optional(),
  source: z.enum(['footer', 'waitlist', 'quiz', 'guide', 'other']).default('footer'),
  interestType: z.enum(['general', 'city-waitlist']).default('general'),
  cityTag: z.string().max(100).optional(),
  stateCode: z.string().length(2).toUpperCase().optional(),
  treatmentTag: z.string().max(100).optional(),
})

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  const ip = getIp(req)
  if (!limiter.check(ip)) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = Schema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Validation failed.' },
      { status: 422 },
    )
  }

  const { email, name, source, interestType, cityTag, stateCode, treatmentTag } = parsed.data
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'
  if (process.env.NODE_ENV === 'production' && !(process.env.NEXT_PUBLIC_SITE_URL ?? '').startsWith('https://injector.world')) {
    console.error('[SECURITY] NEXT_PUBLIC_SITE_URL is not set correctly. Redirects may be unsafe.')
  }

  const payload = await getPayload({ config })

  // Check if already subscribed
  const existing = await payload.find({
    collection: 'subscribers',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })

  if (existing.docs.length > 0) {
    const sub = existing.docs[0] as any
    if (sub.status === 'confirmed') {
      // Already confirmed: silently succeed (no resend, avoids email enumeration)
      return NextResponse.json({ success: true })
    }
    if (sub.status === 'unsubscribed') {
      // Re-subscribe: reset to pending with a new token (but rate-limit the resend)
      const lastSent = resendCooldown.get(email)
      if (lastSent && Date.now() - lastSent < RESEND_COOLDOWN_MS) {
        return NextResponse.json({ success: true })
      }
      const confirmToken = crypto.randomUUID()
      await payload.update({
        collection: 'subscribers',
        id: sub.id,
        overrideAccess: true,
        data: {
          status: 'pending',
          confirmToken,
          confirmTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          optInAt: new Date().toISOString(),
          confirmedAt: null,
          unsubscribedAt: null,
          ipAtSignup: ip,
          name: name || sub.name,
        } as any,
      })
      const confirmUrl = `${siteUrl}/api/newsletter/confirm?token=${confirmToken}`
      const unsubscribeUrl = `${siteUrl}/api/newsletter/unsubscribe?token=${confirmToken}`
      resendCooldown.set(email, Date.now())
      await sendConfirmEmail({ to: email, name: name || sub.name, confirmUrl, unsubscribeUrl })
      return NextResponse.json({ success: true })
    }
    // Already pending: resend confirm email (rate-limited per email address)
    const lastSent = resendCooldown.get(email)
    if (lastSent && Date.now() - lastSent < RESEND_COOLDOWN_MS) {
      return NextResponse.json({ success: true })
    }
    const confirmToken = sub.confirmToken || crypto.randomUUID()
    if (!sub.confirmToken) {
      await payload.update({
        collection: 'subscribers',
        id: sub.id,
        overrideAccess: true,
        data: { confirmToken } as any,
      })
    }
    const confirmUrl = `${siteUrl}/api/newsletter/confirm?token=${confirmToken}`
    const unsubscribeUrl = `${siteUrl}/api/newsletter/unsubscribe?token=${confirmToken}`
    resendCooldown.set(email, Date.now())
    await sendConfirmEmail({ to: email, name: name || sub.name, confirmUrl, unsubscribeUrl })
    return NextResponse.json({ success: true })
  }

  // New subscriber
  const confirmToken = crypto.randomUUID()
  await payload.create({
    collection: 'subscribers',
    overrideAccess: true,
    data: {
      email,
      name: name || undefined,
      status: 'pending',
      source,
      interestType,
      cityTag: cityTag || undefined,
      stateCode: stateCode || undefined,
      treatmentTag: treatmentTag || undefined,
      confirmToken,
      confirmTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      optInAt: new Date().toISOString(),
      ipAtSignup: ip,
    } as any,
  })

  const confirmUrl = `${siteUrl}/api/newsletter/confirm?token=${confirmToken}`
  const unsubscribeUrl = `${siteUrl}/api/newsletter/unsubscribe?token=${confirmToken}`
  await sendConfirmEmail({ to: email, name, confirmUrl, unsubscribeUrl })

  return NextResponse.json({ success: true })
}

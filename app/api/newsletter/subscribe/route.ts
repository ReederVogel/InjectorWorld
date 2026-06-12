import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { sendConfirmEmail } from '@/lib/newsletter-email'

// Rate limit: 3 signup attempts per IP per hour
const rateMap = new Map<string, { count: number; resetAt: number }>()
function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }
  if (entry.count >= 3) return false
  entry.count++
  return true
}

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
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'

  if (!checkRateLimit(ip)) {
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
      // Re-subscribe: reset to pending with a new token
      const confirmToken = crypto.randomUUID()
      await payload.update({
        collection: 'subscribers',
        id: sub.id,
        overrideAccess: true,
        data: {
          status: 'pending',
          confirmToken,
          optInAt: new Date().toISOString(),
          confirmedAt: null,
          unsubscribedAt: null,
          ipAtSignup: ip,
          name: name || sub.name,
        } as any,
      })
      const confirmUrl = `${siteUrl}/api/newsletter/confirm?token=${confirmToken}`
      const unsubscribeUrl = `${siteUrl}/api/newsletter/unsubscribe?token=${confirmToken}`
      await sendConfirmEmail({ to: email, name: name || sub.name, confirmUrl, unsubscribeUrl })
      return NextResponse.json({ success: true })
    }
    // Already pending: resend confirm email using existing token
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
      optInAt: new Date().toISOString(),
      ipAtSignup: ip,
    } as any,
  })

  const confirmUrl = `${siteUrl}/api/newsletter/confirm?token=${confirmToken}`
  const unsubscribeUrl = `${siteUrl}/api/newsletter/unsubscribe?token=${confirmToken}`
  await sendConfirmEmail({ to: email, name, confirmUrl, unsubscribeUrl })

  return NextResponse.json({ success: true })
}

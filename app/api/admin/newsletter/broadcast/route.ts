import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { checkOrigin } from '@/lib/rate-limit'
import { sendBroadcastEmail } from '@/lib/newsletter-email'

// Rate limit: 2 broadcasts per admin per hour (prevent accidental double-sends)
const rateMap = new Map<string, { count: number; resetAt: number }>()
function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateMap.set(userId, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }
  if (entry.count >= 2) return false
  entry.count++
  return true
}

const Schema = z.object({
  subject: z.string().min(3).max(150),
  body: z.string().min(10).max(5000),
  audience: z.enum(['all', 'general', 'city-waitlist']).default('all'),
  dryRun: z.boolean().default(false),
})

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)

  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  if (!checkRateLimit(String(user.id))) {
    return NextResponse.json(
      { error: 'Rate limit: max 2 broadcasts per hour. Wait before sending again.' },
      { status: 429 },
    )
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

  const { subject, body, audience, dryRun } = parsed.data
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

  // Build where clause: confirmed only + optional audience filter
  const where: Where = audience !== 'all'
    ? { and: [{ status: { equals: 'confirmed' } }, { interestType: { equals: audience } }] }
    : { status: { equals: 'confirmed' } }

  // Fetch all confirmed subscribers (paginate in batches)
  const PAGE = 100
  let page = 1
  let sent = 0
  let failed = 0
  let total = 0

  if (dryRun) {
    const count = await payload.find({
      collection: 'subscribers',
      where,
      limit: 0,
      overrideAccess: true,
    })
    return NextResponse.json({ dryRun: true, wouldSend: count.totalDocs })
  }

  while (true) {
    const batch = await payload.find({
      collection: 'subscribers',
      where,
      limit: PAGE,
      page,
      overrideAccess: true,
    })

    total = batch.totalDocs

    for (const sub of batch.docs as any[]) {
      const unsubscribeUrl = `${siteUrl}/api/newsletter/unsubscribe?token=${sub.confirmToken}`
      try {
        await sendBroadcastEmail({
          to: sub.email,
          name: sub.name,
          subject,
          bodyText: body,
          unsubscribeUrl,
        })
        sent++
      } catch {
        failed++
      }
    }

    if (page >= batch.totalPages) break
    page++
  }

  return NextResponse.json({ success: true, sent, failed, total })
}

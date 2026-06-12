import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { sendBroadcastEmail } from '@/lib/newsletter-email'

const Schema = z.object({
  newsSlug: z.string().min(1).max(200),
  audience: z.enum(['all', 'general', 'city-waitlist']).default('all'),
  dryRun: z.boolean().default(true),
})

export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)

  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
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

  const { newsSlug, audience, dryRun } = parsed.data
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

  // Fetch the news article
  const newsRes = await payload.find({
    collection: 'news',
    where: { and: [{ slug: { equals: newsSlug } }, { status: { equals: 'published' } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const article = newsRes.docs[0] as any
  if (!article) {
    return NextResponse.json(
      { error: `No published news article found with slug "${newsSlug}".` },
      { status: 404 },
    )
  }

  const subject = `New from injector.world: ${article.title}`
  const bodyText = `${article.excerpt}\n\nRead the full article: ${siteUrl}/news/${article.slug}`

  // Build subscriber where clause
  const where: Where =
    audience !== 'all'
      ? { and: [{ status: { equals: 'confirmed' } }, { interestType: { equals: audience } }] }
      : { status: { equals: 'confirmed' } }

  if (dryRun) {
    const count = await payload.find({
      collection: 'subscribers',
      where,
      limit: 0,
      overrideAccess: true,
    })
    return NextResponse.json({
      dryRun: true,
      wouldSend: count.totalDocs,
      articleTitle: article.title,
      subject,
    })
  }

  // Send
  const PAGE = 100
  let page = 1
  let sent = 0
  let failed = 0

  while (true) {
    const batch = await payload.find({
      collection: 'subscribers',
      where,
      limit: PAGE,
      page,
      overrideAccess: true,
    })

    for (const sub of batch.docs as any[]) {
      const unsubscribeUrl = `${siteUrl}/api/newsletter/unsubscribe?token=${sub.confirmToken}`
      try {
        await sendBroadcastEmail({
          to: sub.email,
          name: sub.name,
          subject,
          bodyText,
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

  return NextResponse.json({ success: true, sent, failed, articleTitle: article.title })
}

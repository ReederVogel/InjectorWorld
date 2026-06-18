import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { checkOrigin } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const QUEUE = {
  and: [
    { reviewStatus: { equals: 'approved' } },
    { indexState: { equals: 'noindex' } },
  ],
}

/**
 * GET: preview the drip queue for a collection.
 * ?collection=news|guides → { remaining, items: [{id, title, slug, approvedAt, category},...] }
 */
export async function GET(req: NextRequest) {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  if (!user || (user.role !== 'admin' && user.role !== 'editor')) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const collection = searchParams.get('collection') as 'news' | 'guides' | null

  if (!collection || !['news', 'guides'].includes(collection)) {
    return NextResponse.json({ error: 'collection must be "news" or "guides".' }, { status: 400 })
  }

  const res = await payload.find({
    collection,
    where: QUEUE as any,
    sort: 'approvedAt',
    limit: 20,
    depth: 0,
  })

  return NextResponse.json({
    remaining: res.totalDocs,
    items: res.docs.map((d: any) => ({
      id: d.id,
      title: d.title,
      slug: d.slug,
      approvedAt: d.approvedAt ?? d.createdAt,
      category: d.category ?? null,
    })),
  })
}

/**
 * POST: flip the oldest N approved+noindex items to indexed + nofollow=false.
 * Body: { collection: 'news' | 'guides', count?: number }
 * Default count = 5.
 */
export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  if (!user || (user.role !== 'admin' && user.role !== 'editor')) {
    return NextResponse.json({ error: 'Unauthorized. Admin or editor login required.' }, { status: 401 })
  }

  let body: { collection?: string; count?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Expected JSON body.' }, { status: 400 })
  }

  const { collection, count: rawCount = 5 } = body
  if (!collection || !['news', 'guides'].includes(collection)) {
    return NextResponse.json({ error: 'collection must be "news" or "guides".' }, { status: 400 })
  }
  const count = Math.max(1, Math.min(100, Number(rawCount) || 5))

  // Fetch oldest first (by approvedAt, then createdAt)
  const queued = await payload.find({
    collection: collection as 'news' | 'guides',
    where: QUEUE as any,
    sort: 'approvedAt',
    limit: count,
    depth: 0,
  })

  let indexed = 0
  for (const doc of queued.docs) {
    await payload.update({
      collection: collection as 'news' | 'guides',
      id: doc.id,
      data: { indexState: 'indexed' as const, nofollow: false },
      overrideAccess: true,
    })
    indexed++
  }

  // Count remaining in queue
  const remainingRes = await payload.find({
    collection: collection as 'news' | 'guides',
    where: QUEUE as any,
    limit: 0,
    depth: 0,
  })

  return NextResponse.json({
    success: true,
    indexed,
    remaining: remainingRes.totalDocs,
    message: `${indexed} ${collection} item${indexed === 1 ? '' : 's'} indexed. ${remainingRes.totalDocs} remain in the drip queue.`,
  })
}

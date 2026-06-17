import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { checkOrigin } from '@/lib/rate-limit'

export const runtime = 'nodejs'

/**
 * Approve one or more news articles or guides.
 * Sets reviewStatus=approved, status=published (news), approvedAt=now, approvedBy=user.
 * indexState stays 'noindex' — drip:index promotes to indexed separately.
 *
 * Body: { collection: 'news' | 'guides', ids: number[] }
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

  let body: { collection?: string; ids?: number[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Expected JSON body.' }, { status: 400 })
  }

  const { collection, ids } = body

  if (!collection || !['news', 'guides'].includes(collection)) {
    return NextResponse.json({ error: 'collection must be "news" or "guides".' }, { status: 400 })
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids must be a non-empty array of numbers.' }, { status: 400 })
  }

  const approvedAt = new Date().toISOString()
  const approvedById = user.id

  let approved = 0
  let skipped = 0
  const errors: string[] = []

  for (const id of ids) {
    try {
      const data: Record<string, any> = {
        reviewStatus: 'approved',
        indexState: 'noindex', // stays noindex until drip:index
        nofollow: true,
        approvedAt,
        approvedBy: approvedById,
      }
      // For news, sync status to published
      if (collection === 'news') {
        data.status = 'published'
      }

      await payload.update({
        collection: collection as 'news' | 'guides',
        id,
        data,
        overrideAccess: true,
      })
      approved++
    } catch (err: any) {
      errors.push(`id ${id}: ${err?.message ?? 'unknown error'}`)
      skipped++
    }
  }

  return NextResponse.json({
    success: true,
    approved,
    skipped,
    ...(errors.length ? { errors } : {}),
    note: `Approved items are now public but noindex. Use drip:index to promote them to indexed.`,
  })
}

/** Return counts of pending items for the dashboard panel. */
export async function GET(req: NextRequest) {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  if (!user || (user.role !== 'admin' && user.role !== 'editor')) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const PENDING = { reviewStatus: { in: ['imported', 'in-review'] } }

  const [newsRes, guidesRes] = await Promise.all([
    payload.find({ collection: 'news', where: PENDING as any, limit: 0, depth: 0 }),
    payload.find({ collection: 'guides', where: PENDING as any, limit: 0, depth: 0 }),
  ])

  const NOINDEX = { and: [{ reviewStatus: { equals: 'approved' } }, { indexState: { equals: 'noindex' } }] }
  const [newsNoindex, guidesNoindex] = await Promise.all([
    payload.find({ collection: 'news', where: NOINDEX as any, limit: 0, depth: 0 }),
    payload.find({ collection: 'guides', where: NOINDEX as any, limit: 0, depth: 0 }),
  ])

  return NextResponse.json({
    pending: { news: newsRes.totalDocs, guides: guidesRes.totalDocs },
    approvedNoindex: { news: newsNoindex.totalDocs, guides: guidesNoindex.totalDocs },
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { checkOrigin } from '@/lib/rate-limit'
import { requireAdminOrEditor } from '@/lib/auth-guards'

export const runtime = 'nodejs'

const PAGE_SIZE = 25

/**
 * GET  /api/admin/review-moderate?status=pending&page=1
 *   Returns paginated reviews + count summary.
 *
 * POST /api/admin/review-moderate
 *   Body: { ids: number[], action: 'approved' | 'rejected' }
 *   Bulk-sets moderationStatus on the given review ids.
 */

export async function GET(req: NextRequest) {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdminOrEditor(user)
  if (guard) return guard

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'pending'
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))

  const [pendingRes, rejectedRes, approvedRes, pageRes] = await Promise.all([
    payload.find({ collection: 'reviews', where: { moderationStatus: { equals: 'pending' } } as any, limit: 0, depth: 0 }),
    payload.find({ collection: 'reviews', where: { moderationStatus: { equals: 'rejected' } } as any, limit: 0, depth: 0 }),
    payload.find({ collection: 'reviews', where: { moderationStatus: { equals: 'approved' } } as any, limit: 0, depth: 0 }),
    payload.find({
      collection: 'reviews',
      where: { moderationStatus: { equals: status } } as any,
      limit: PAGE_SIZE,
      page,
      depth: 1,
      sort: '-createdAt',
    }),
  ])

  const items = pageRes.docs.map((r: any) => ({
    id: r.id,
    reviewId: r.reviewId,
    reviewerFirstName: r.reviewerFirstName ?? null,
    reviewerInitial: r.reviewerInitial ?? null,
    rating: r.rating,
    reviewTitle: r.reviewTitle ?? null,
    reviewText: r.reviewText,
    treatmentTag: r.treatmentTag ?? null,
    sourcePlatform: r.sourcePlatform ?? null,
    sourceUrl: r.sourceUrl ?? null,
    reviewDate: r.reviewDate ?? null,
    importBatch: r.importBatch ?? null,
    moderationStatus: r.moderationStatus,
    clinic: r.clinic ? { id: r.clinic.id, clinicName: r.clinic.clinicName } : null,
    provider: r.provider ? { id: r.provider.id, fullName: r.provider.fullName } : null,
    createdAt: r.createdAt,
  }))

  return NextResponse.json({
    items,
    totalItems: pageRes.totalDocs,
    totalPages: pageRes.totalPages,
    page,
    counts: {
      pending: pendingRes.totalDocs,
      approved: approvedRes.totalDocs,
      rejected: rejectedRes.totalDocs,
    },
  })
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdminOrEditor(user)
  if (guard) return guard

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const ids: number[] = Array.isArray(body?.ids) ? body.ids.filter((x: any) => typeof x === 'number') : []
  const action: string = body?.action
  if (!ids.length) return NextResponse.json({ error: 'ids array required.' }, { status: 400 })
  if (action !== 'approved' && action !== 'rejected') {
    return NextResponse.json({ error: 'action must be "approved" or "rejected".' }, { status: 400 })
  }

  let done = 0
  for (const id of ids) {
    try {
      await payload.update({
        collection: 'reviews',
        id,
        data: { moderationStatus: action } as any,
        overrideAccess: true,
      })
      done++
    } catch {
      // non-fatal: skip bad ids
    }
  }

  return NextResponse.json({ moderated: done, action })
}

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdmin } from '@/lib/auth-guards'
import { checkOrigin } from '@/lib/rate-limit'

export const runtime = 'nodejs'

function getStatusField(collection: string): string {
  return collection === 'reviews' ? 'moderationStatus' : 'status'
}

function resolveStatusValue(collection: string, action: string): string {
  if (collection === 'reviews') {
    if (action === 'publish') return 'approved'
    if (action === 'review') return 'pending'
    if (action === 'draft') return 'rejected'
    return action
  }
  return action === 'publish' ? 'published' : action
}

async function batchProcess<T>(items: T[], batchSize: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += batchSize) {
    await Promise.all(items.slice(i, i + batchSize).map(fn))
  }
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdmin(user)
  if (guard) return guard

  let body: { collection: string; ids: number[]; action: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { collection, ids, action } = body

  if (!['clinics', 'providers', 'reviews'].includes(collection)) {
    return NextResponse.json({ error: 'Invalid collection.' }, { status: 400 })
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids must be a non-empty array.' }, { status: 400 })
  }
  if (ids.length > 500) {
    return NextResponse.json({ error: 'Max 500 ids per request.' }, { status: 400 })
  }
  if (!['publish', 'draft', 'review'].includes(action)) {
    return NextResponse.json({ error: 'action must be publish, draft, or review.' }, { status: 400 })
  }

  const statusField = getStatusField(collection)
  const statusValue = resolveStatusValue(collection, action)
  let updated = 0
  const errors: string[] = []

  await batchProcess(ids, 10, async (id) => {
    try {
      await payload.update({
        collection: collection as 'clinics' | 'providers' | 'reviews',
        id,
        data: { [statusField]: statusValue } as any,
        overrideAccess: true,
      })
      updated++
    } catch (err: any) {
      errors.push(`id ${id}: ${err?.message ?? 'unknown error'}`)
    }
  })

  return NextResponse.json({
    success: true,
    updated,
    failed: errors.length,
    errors,
  })
}

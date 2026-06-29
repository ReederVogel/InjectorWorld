import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdminOrEditor } from '@/lib/auth-guards'
import { checkOrigin } from '@/lib/rate-limit'
import { createImportPool } from '@/lib/import/review-import'
import { approveStagedUpload, type BulkUploadCollection } from '@/lib/import/admin-bulk-upload'

export const runtime = 'nodejs'

function normalizeCollection(value: unknown): BulkUploadCollection | null {
  const normalized = String(value ?? '').trim().toLowerCase()
  return ['clinics', 'reviews', 'news', 'guides'].includes(normalized)
    ? normalized as BulkUploadCollection
    : null
}

function normalizeIds(value: unknown): number[] {
  const raw = Array.isArray(value) ? value : value == null ? [] : [value]
  return raw
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0)
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdminOrEditor(user)
  if (guard) return guard

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const collection = normalizeCollection(body.collection)
  if (!collection) {
    return NextResponse.json({ error: 'collection must be one of clinics, reviews, news, guides.' }, { status: 400 })
  }

  const batch = typeof body.batch === 'string' && body.batch.trim() ? body.batch.trim() : undefined
  const ids = normalizeIds(body.ids ?? body.id)
  if (!batch && ids.length === 0) {
    return NextResponse.json({ error: 'Provide batch or ids.' }, { status: 400 })
  }

  const pool = await createImportPool()
  try {
    const report = await approveStagedUpload(pool, collection, {
      batch,
      ids,
      actorUserId: Number.isInteger(Number(user?.id)) ? Number(user?.id) : undefined,
    })
    return NextResponse.json({ success: true, report })
  } catch (err: any) {
    payload.logger.error(`[admin import approve] ${err?.message ?? err}`)
    return NextResponse.json({ error: `Approve failed: ${err?.message ?? 'unknown error'}` }, { status: 500 })
  } finally {
    await pool.end()
  }
}

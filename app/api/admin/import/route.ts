import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'node:stream'
import { parse } from 'csv-parse'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdminOrEditor } from '@/lib/auth-guards'
import { checkOrigin } from '@/lib/rate-limit'
import { createImportPool } from '@/lib/import/review-import'
import { stageBulkUpload, type BulkUploadCollection } from '@/lib/import/admin-bulk-upload'

export const runtime = 'nodejs'

function normalizeCollection(value: FormDataEntryValue | null): BulkUploadCollection | null {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'clinic') return 'clinics'
  if (normalized === 'review') return 'reviews'
  if (normalized === 'guide') return 'guides'
  if (normalized === 'article') return 'news'
  return ['clinics', 'reviews', 'news', 'guides'].includes(normalized)
    ? normalized as BulkUploadCollection
    : null
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdminOrEditor(user)
  if (guard) return guard

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data.' }, { status: 400 })
  }

  const collection = normalizeCollection(form.get('collection') ?? form.get('record_type') ?? form.get('type'))
  if (!collection) {
    return NextResponse.json({ error: 'collection must be one of clinics, reviews, news, guides.' }, { status: 400 })
  }

  const file = form.get('file') ?? form.get('combined')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Upload a CSV file in the file field.' }, { status: 400 })
  }

  const batchRaw = String(form.get('batch') ?? '').trim()
  const batchSizeRaw = Number(form.get('batchSize') ?? form.get('batch_size') ?? 500)
  const batchSize = Number.isInteger(batchSizeRaw) && batchSizeRaw > 0 ? batchSizeRaw : 500

  const pool = await createImportPool()
  try {
    const parser = Readable.fromWeb(file.stream() as any).pipe(
      parse({
        columns: true,
        bom: true,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: false,
      }),
    )
    const report = await stageBulkUpload(pool, collection, parser as AsyncIterable<Record<string, string | undefined>>, {
      batch: batchRaw || undefined,
      batchSize,
    })
    return NextResponse.json({ success: true, report })
  } catch (err: any) {
    payload.logger.error(`[admin import] ${err?.message ?? err}`)
    return NextResponse.json({ error: `Import failed: ${err?.message ?? 'unknown error'}` }, { status: 500 })
  } finally {
    await pool.end()
  }
}

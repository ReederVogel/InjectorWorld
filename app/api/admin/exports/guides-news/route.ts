import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdmin } from '@/lib/auth-guards'
import { checkOrigin } from '@/lib/rate-limit'
import { isExportRunning, reapAbandonedJobs } from '@/lib/exports/run-export'
import {
  EXPORT_KEEP_DAYS,
  PDF_EXPORT_SLUG,
  listPdfExportOptions,
  pdfFilterSummary,
  purgeExpiredExports,
  runPdfExportJob,
  type PdfExportFilters,
} from '@/lib/exports/run-pdf-export'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COLLECTIONS = ['both', 'guides', 'news'] as const

function clean(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.trim()
  return s ? s.slice(0, 120) : undefined
}

/**
 * GET /api/admin/exports/guides-news
 * Filter options (categories, months, counts) and the PDF export history.
 */
export async function GET() {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdmin(user)
  if (guard) return guard

  await reapAbandonedJobs(payload)
  await purgeExpiredExports(payload)

  const [options, jobs] = await Promise.all([
    listPdfExportOptions((payload.db as any).pool),
    payload.find({
      collection: 'export-jobs',
      where: { collectionSlug: { equals: PDF_EXPORT_SLUG } },
      sort: '-createdAt',
      limit: 20,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  return NextResponse.json({
    options,
    keepDays: EXPORT_KEEP_DAYS,
    jobs: jobs.docs.map((j: any) => ({
      id: j.id,
      status: j.status,
      filterSummary: j.filterSummary,
      totalRows: j.totalRows,
      processedRows: j.processedRows,
      fileUrl: j.fileUrl,
      fileSizeBytes: j.fileSizeBytes,
      error: j.error,
      createdAt: j.createdAt,
    })),
  })
}

/**
 * POST /api/admin/exports/guides-news  { collection, category?, month? }
 * category only with collection "guides", month only with "news". Starts the
 * job in the background and answers at once; the panel polls GET for progress.
 */
export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdmin(user)
  if (guard) return guard

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const collection = clean(body.collection) as PdfExportFilters['collection'] | undefined
  if (!collection || !COLLECTIONS.includes(collection)) {
    return NextResponse.json({ error: `Collection must be one of: ${COLLECTIONS.join(', ')}.` }, { status: 400 })
  }
  const filters: PdfExportFilters = { collection }

  // Refuse a filter we would not apply: a zip of everything when the admin
  // picked one category is worse than an error.
  const category = clean(body.category)
  let categoryName: string | undefined
  if (category) {
    if (collection !== 'guides') {
      return NextResponse.json({ error: 'Category works with Guides only.' }, { status: 400 })
    }
    const pool = (payload.db as any).pool
    const found = await pool.query('SELECT name FROM guide_categories WHERE slug = $1', [category])
    if (!found.rows.length) return NextResponse.json({ error: 'Unknown guide category.' }, { status: 400 })
    categoryName = found.rows[0].name
    filters.category = category
  }

  const month = clean(body.month)
  if (month) {
    if (collection !== 'news') {
      return NextResponse.json({ error: 'Month works with News only.' }, { status: 400 })
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return NextResponse.json({ error: 'Month must look like 2026-07.' }, { status: 400 })
    }
    filters.month = month
  }

  await reapAbandonedJobs(payload)
  await purgeExpiredExports(payload)
  if (await isExportRunning(payload)) {
    return NextResponse.json(
      { error: 'An export is already running. Wait for it to finish, then start the next one.' },
      { status: 409 },
    )
  }

  const job = await payload.create({
    collection: 'export-jobs',
    data: {
      collectionSlug: PDF_EXPORT_SLUG,
      status: 'queued',
      filters,
      filterSummary: pdfFilterSummary(filters, categoryName),
      processedRows: 0,
      startedBy: typeof user?.id === 'number' ? user.id : undefined,
      heartbeatAt: new Date().toISOString(),
    },
    overrideAccess: true,
  })

  // Fire-and-forget. runPdfExportJob catches everything and records failures on
  // the job row, so this can never surface as an unhandled rejection.
  void runPdfExportJob({ payload, jobId: job.id, filters })

  return NextResponse.json({ id: job.id, status: 'queued' }, { status: 202 })
}

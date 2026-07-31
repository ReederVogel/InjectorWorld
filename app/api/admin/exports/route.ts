import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdmin } from '@/lib/auth-guards'
import { EXPORT_DEFINITIONS, EXPORTABLE, isExportableSlug, type ExportFilters } from '@/lib/exports/definitions'
import { runExportJob, reapAbandonedJobs, buildFilterSummary } from '@/lib/exports/run-export'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

function clean(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.trim()
  return s ? s.slice(0, 120) : undefined
}

/**
 * GET /api/admin/exports
 * Export history, newest first. Also reaps jobs whose process died, so the list
 * never shows a progress bar that will never move again.
 */
export async function GET(req: NextRequest) {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdmin(user)
  if (guard) return guard

  await reapAbandonedJobs(payload)

  const pool = (payload.db as any).pool
  // Filter dropdown options. Cities are only fetched for a chosen state: there are
  // ~2,800 of them, so a flat list would be unusable and slow to ship.
  const stateParam = clean(req.nextUrl.searchParams.get('state'))
  const [statesRes, brandsRes, servicesRes, citiesRes] = await Promise.all([
    pool.query(`SELECT DISTINCT state FROM clinics WHERE status='published' AND state IS NOT NULL AND state <> '' ORDER BY state`),
    pool.query('SELECT slug, name FROM brands ORDER BY name'),
    pool.query('SELECT slug, name FROM services ORDER BY name'),
    stateParam
      ? pool.query(
          `SELECT DISTINCT city FROM clinics WHERE status='published' AND state = $1 AND city IS NOT NULL AND city <> '' ORDER BY city`,
          [stateParam],
        )
      : Promise.resolve({ rows: [] }),
  ])

  const jobs = await payload.find({
    collection: 'export-jobs',
    sort: '-createdAt',
    limit: 30,
    depth: 0,
    overrideAccess: true,
  })

  return NextResponse.json({
    options: {
      states: statesRes.rows.map((r: any) => r.state),
      cities: citiesRes.rows.map((r: any) => r.city),
      brands: brandsRes.rows.map((r: any) => ({ slug: r.slug, name: r.name })),
      services: servicesRes.rows.map((r: any) => ({ slug: r.slug, name: r.name })),
    },
    collections: EXPORTABLE.map((k) => ({
      value: k,
      label: EXPORT_DEFINITIONS[k].label,
      supportsFilters: EXPORT_DEFINITIONS[k].supportsFilters,
    })),
    jobs: jobs.docs.map((j: any) => ({
      id: j.id,
      collectionSlug: j.collectionSlug,
      status: j.status,
      filterSummary: j.filterSummary,
      totalRows: j.totalRows,
      processedRows: j.processedRows,
      fileName: j.fileName,
      fileUrl: j.fileUrl,
      fileSizeBytes: j.fileSizeBytes,
      error: j.error,
      createdAt: j.createdAt,
      finishedAt: j.finishedAt,
    })),
  })
}

/**
 * POST /api/admin/exports  { collection, state?, city?, brandSlug?, serviceSlug? }
 * Creates a job and starts it in the background. Responds immediately with the
 * job id; the client polls GET /api/admin/exports/:id for progress.
 */
export async function POST(req: NextRequest) {
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

  const collectionSlug = clean(body.collection)
  if (!isExportableSlug(collectionSlug)) {
    return NextResponse.json(
      { error: `Unknown collection. Expected one of: ${EXPORTABLE.join(', ')}` },
      { status: 400 },
    )
  }

  const def = EXPORT_DEFINITIONS[collectionSlug]
  const filters: ExportFilters = {
    state: clean(body.state),
    city: clean(body.city),
    brandSlug: clean(body.brandSlug),
    serviceSlug: clean(body.serviceSlug),
  }
  const hasFilters = Object.values(filters).some(Boolean)

  // Reject filters we cannot honour rather than silently ignoring them: a file
  // that quietly contains everything when the admin asked for one state is worse
  // than an error.
  if (hasFilters && !def.supportsFilters) {
    return NextResponse.json(
      { error: `${def.label} has no state/city/brand/service to filter on. Remove the filters or export Clinics.` },
      { status: 400 },
    )
  }

  await reapAbandonedJobs(payload)

  // One at a time. Two concurrent 37k-row exports on this instance is exactly the
  // memory spike this whole design exists to avoid.
  const running = await payload.find({
    collection: 'export-jobs',
    where: { status: { in: ['queued', 'running'] } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (running.totalDocs > 0) {
    return NextResponse.json(
      { error: 'An export is already running. Wait for it to finish, then start the next one.' },
      { status: 409 },
    )
  }

  const job = await payload.create({
    collection: 'export-jobs',
    data: {
      collectionSlug,
      status: 'queued',
      filters: hasFilters ? filters : {},
      filterSummary: buildFilterSummary(filters),
      processedRows: 0,
      startedBy: typeof user?.id === 'number' ? user.id : undefined,
      heartbeatAt: new Date().toISOString(),
    },
    overrideAccess: true,
  })

  // Fire-and-forget. runExportJob catches everything and records failures on the
  // job row, so this can never surface as an unhandled rejection.
  void runExportJob({ payload, jobId: job.id, collectionSlug, filters, siteUrl: SITE_URL })

  return NextResponse.json({ id: job.id, status: 'queued' }, { status: 202 })
}

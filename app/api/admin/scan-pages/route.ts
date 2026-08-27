import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdmin, requireAdminOrEditor } from '@/lib/auth-guards'
import { runScanJob, reapAbandonedScans } from '@/lib/page-index/run-scan-job'
import { checkOrigin } from '@/lib/rate-limit'
import { serverError } from '@/lib/api-errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Start a url-registry scan, and report on running/past ones.
 *
 * This used to run the whole scan inline and return the result. That worked when
 * `page_index` only covered the ~52,800 computed listing pages. It does not now:
 * the registry covers every url, so a full run writes ~92,700 rows and overruns
 * DO's proxy timeout. A request killed halfway leaves the registry partly written
 * with no record of where it stopped.
 *
 * So POST creates a `scan-jobs` row, kicks the work off unawaited, and returns
 * 202 immediately. GET is the poll.
 */

/** POST: queue a scan. Returns 202 with the job id. */
export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdmin(user)
  if (guard) return guard

  try {
    await reapAbandonedScans(payload)

    // One at a time. The job row is the mutex. Two concurrent scans would fight
    // over the same rows, and the second one's "lost data" reconcile could
    // un-publish urls the first had only just written.
    const running = await payload.find({
      collection: 'scan-jobs',
      where: { status: { in: ['queued', 'running'] } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (running.totalDocs > 0) {
      return NextResponse.json(
        { error: 'A scan is already running. Wait for it to finish, then start the next one.' },
        { status: 409 },
      )
    }

    const job = await payload.create({
      collection: 'scan-jobs',
      data: {
        status: 'queued',
        phase: 'Queued',
        trigger: 'admin',
        processedRows: 0,
        startedBy: typeof user?.id === 'number' ? user.id : undefined,
        heartbeatAt: new Date().toISOString(),
      },
      overrideAccess: true,
    })

    // Fire-and-forget. runScanJob catches everything and records failures on the
    // job row, so this can never become an unhandled rejection.
    void runScanJob({ payload, jobId: job.id })

    return NextResponse.json({ id: job.id, status: 'queued' }, { status: 202 })
  } catch (err: any) {
    return serverError('admin/scan-pages', err, 'Could not start the scan.')
  }
}

/** GET: the live job (if any) plus recent history, for the admin to poll. */
export async function GET(_req: NextRequest) {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdminOrEditor(user)
  if (guard) return guard

  try {
    await reapAbandonedScans(payload)

    const jobs = await payload.find({
      collection: 'scan-jobs',
      sort: '-createdAt',
      limit: 10,
      depth: 0,
      overrideAccess: true,
    })

    const docs = jobs.docs as any[]
    const active = docs.find((j) => j.status === 'queued' || j.status === 'running') ?? null

    return NextResponse.json({
      success: true,
      active: active && {
        id: active.id,
        status: active.status,
        phase: active.phase,
        processedRows: active.processedRows ?? 0,
        totalRows: active.totalRows ?? null,
        startedAt: active.startedAt,
      },
      history: docs.map((j) => ({
        id: j.id,
        status: j.status,
        phase: j.phase,
        trigger: j.trigger,
        totalRows: j.totalRows,
        createdRows: j.createdRows,
        updatedRows: j.updatedRows,
        lostDataRows: j.lostDataRows,
        failedRows: j.failedRows,
        unmappedClinics: j.unmappedClinics,
        indexedNow: j.indexedNow,
        queuedNow: j.queuedNow,
        bySource: j.bySource,
        error: j.error,
        startedAt: j.startedAt,
        finishedAt: j.finishedAt,
      })),
    })
  } catch (err: any) {
    return serverError('admin/scan-pages', err, 'Could not load scan history.')
  }
}

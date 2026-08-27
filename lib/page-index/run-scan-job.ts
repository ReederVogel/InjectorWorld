import { scanPages } from './scan-pages'

/**
 * Runs a page-index scan as a background job, mirroring lib/exports/run-export.ts.
 *
 * Fire-and-forget: the caller responds to the HTTP request immediately and this
 * keeps running. Every throw is caught and recorded on the job row, so it can
 * never surface as an unhandled rejection and take the process down.
 *
 * Why this exists: a full scan now writes ~92,700 rows. Inline in the admin's
 * POST that overruns DO's proxy timeout, and a request killed mid-run leaves the
 * registry half-written with no record of how far it got.
 */

/** Throttle progress writes. The scan reports far more often than the DB needs. */
const WRITE_EVERY_MS = 1500

export async function runScanJob(opts: {
  payload: any
  jobId: number | string
}) {
  const { payload, jobId } = opts

  const update = (data: Record<string, unknown>) =>
    payload
      .update({ collection: 'scan-jobs', id: jobId, data, overrideAccess: true })
      .catch((e: any) => {
        payload.logger.error(`[scan ${jobId}] progress write failed: ${e?.message ?? e}`)
      })

  // The scan calls onProgress synchronously and often. Coalesce: keep the latest
  // state in memory, and only flush to the DB on a timer. Writing on every call
  // would put hundreds of extra UPDATEs through a pool capped at 4 connections,
  // competing with the scan's own work.
  let latest: { phase: string; processed?: number; total?: number } | null = null
  let lastWrite = 0
  let inFlight = false

  const flush = (force = false) => {
    if (!latest) return
    const now = Date.now()
    if (!force && (inFlight || now - lastWrite < WRITE_EVERY_MS)) return
    const snapshot = latest
    lastWrite = now
    inFlight = true
    void update({
      phase: snapshot.phase,
      ...(snapshot.processed != null ? { processedRows: snapshot.processed } : {}),
      ...(snapshot.total != null ? { totalRows: snapshot.total } : {}),
      heartbeatAt: new Date().toISOString(),
    }).finally(() => { inFlight = false })
  }

  try {
    await update({
      status: 'running',
      phase: 'Starting',
      processedRows: 0,
      startedAt: new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
    })

    const res = await scanPages(payload, (p) => {
      latest = p
      flush()
    })

    await update({
      status: 'done',
      phase: 'Finished',
      totalRows: res.total,
      processedRows: res.total,
      createdRows: res.created,
      updatedRows: res.updated,
      lostDataRows: res.lostData,
      failedRows: res.failed,
      unmappedClinics: res.unmappedClinics,
      bySource: res.bySource,
      indexedNow: res.indexedNow,
      queuedNow: res.queuedNow,
      marketsFlippedLive: res.marketsFlippedLive,
      marketsFlippedComingSoon: res.marketsFlippedComingSoon,
      finishedAt: new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
    })

    payload.logger.info(
      `[scan ${jobId}] done: ${res.total} urls (${res.created} new, ${res.updated} updated, ` +
      `${res.lostData} lost data, ${res.failed} failed)`,
    )
  } catch (err: any) {
    payload.logger.error(`[scan ${jobId}] failed: ${err?.message ?? err}`)
    await update({
      status: 'failed',
      phase: 'Failed',
      error: String(err?.message ?? err).slice(0, 2000),
      finishedAt: new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
    })
  }
}

/**
 * A job whose process died (deploy, restart, OOM) stays "running" for ever and
 * the UI would show a progress bar that never moves again. Anything running
 * without a heartbeat for this long is treated as dead.
 *
 * Longer than the export reaper's 3 minutes: a scan's slowest single step is the
 * initial clinics read, which returns ~39,800 rows before the first progress
 * write lands.
 */
const STALE_MS = 6 * 60 * 1000

export async function reapAbandonedScans(payload: any): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_MS).toISOString()
  try {
    const stale = await payload.find({
      collection: 'scan-jobs',
      where: {
        and: [
          { status: { in: ['queued', 'running'] } },
          { heartbeatAt: { less_than: cutoff } },
        ],
      },
      limit: 50,
      overrideAccess: true,
    })
    for (const job of stale.docs) {
      await payload.update({
        collection: 'scan-jobs',
        id: job.id,
        data: {
          status: 'abandoned',
          phase: 'Abandoned',
          error: 'The server restarted while this scan was running. Start it again — a scan is safe to re-run.',
          finishedAt: new Date().toISOString(),
        },
        overrideAccess: true,
      })
    }
    return stale.docs.length
  } catch (e: any) {
    payload.logger?.error(`[scan reaper] ${e?.message ?? e}`)
    return 0
  }
}

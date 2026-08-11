import fs from 'fs'
import os from 'os'
import path from 'path'
import ExcelJS from 'exceljs'
import { EXPORT_DEFINITIONS, type ExportFilters } from './definitions'
import { getLocationSlugMap } from '../location-slug-lookup'

/**
 * Runs one export job to completion, in the background, without holding the
 * whole workbook in memory.
 *
 * Why a job and not a plain download response: the clinics export is ~37,000 rows
 * x 32 columns. Building that with the normal ExcelJS Workbook means every cell
 * lives in memory until the response is written, and this app has already
 * OOM-crashed on this dataset once (docs/DECISIONS.md 2026-07-29). So:
 *   - ExcelJS `WorkbookWriter` streams rows straight to a file on disk
 *   - rows are pulled in keyset-paginated batches, never all at once
 *   - one grouped query per relation per batch, never per row
 *
 * Files land in a temp dir and are served by an admin-authenticated download
 * route, never a public URL: an export carries 37,000 business emails and phone
 * numbers, so a guessable public link would be a data leak.
 *
 * The instance's disk is ephemeral, so a redeploy wipes finished files. That is
 * accepted: the job row survives as history and the download route reports the
 * file as expired rather than 500ing.
 */

// Was 1000. Lowered 2026-08-12 after the clinics export grew from 31 to 71 columns
// (full description text, all photo/source URLs, hours JSON, etc. per row) -- the old
// batch size held up fine for narrow rows but staging (1GB RAM, same process as live
// traffic) OOM-restarted mid-export at ~30k/39,669 rows once rows got this much heavier.
// Smaller batches trade more DB round trips for a lower peak per-iteration memory
// footprint and more frequent GC gaps between commits.
const BATCH = 300
/** Progress is written at most this often, to keep DB writes off the hot path. */
const PROGRESS_EVERY = 2

export const EXPORT_DIR = process.env.EXPORT_DIR || path.join(os.tmpdir(), 'iw-exports')

export function exportFilePath(fileName: string) {
  // Defend against traversal: only ever join the basename.
  return path.join(EXPORT_DIR, path.basename(fileName))
}

function summarise(filters: ExportFilters): string {
  const bits: string[] = []
  if (filters.state) bits.push(`state=${filters.state}`)
  if (filters.city) bits.push(`city=${filters.city}`)
  if (filters.brandSlug) bits.push(`brand=${filters.brandSlug}`)
  if (filters.serviceSlug) bits.push(`service=${filters.serviceSlug}`)
  return bits.length ? bits.join(', ') : 'All records'
}

export function buildFilterSummary(filters: ExportFilters) {
  return summarise(filters)
}

/**
 * Fire-and-forget. Caller responds to the HTTP request immediately; this keeps
 * running. Any throw is caught and recorded on the job row, never left to become
 * an unhandled rejection that could take the process down.
 */
export async function runExportJob(opts: {
  payload: any
  jobId: number | string
  collectionSlug: string
  filters: ExportFilters
  siteUrl: string
}) {
  const { payload, jobId, collectionSlug, filters, siteUrl } = opts
  const pool = (payload.db as any).pool
  const def = EXPORT_DEFINITIONS[collectionSlug]

  const update = (data: Record<string, unknown>) =>
    payload.update({ collection: 'export-jobs', id: jobId, data, overrideAccess: true }).catch((e: any) => {
      payload.logger.error(`[export ${jobId}] progress write failed: ${e?.message ?? e}`)
    })

  const fileName = `${collectionSlug}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}-${jobId}.xlsx`
  const filePath = exportFilePath(fileName)

  try {
    if (!def) throw new Error(`Unknown export collection: ${collectionSlug}`)
    if (!pool) throw new Error('No Postgres pool available.')

    fs.mkdirSync(EXPORT_DIR, { recursive: true })

    const countQ = def.buildCount(filters)
    const totalRows = (await pool.query(countQ.text, countQ.values)).rows[0]?.n ?? 0

    await update({
      status: 'running',
      totalRows,
      processedRows: 0,
      fileName,
      startedAt: new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
    })

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: filePath, useStyles: false })
    const sheet = workbook.addWorksheet(def.sheet)
    sheet.columns = def.columns as any
    sheet.getRow(1).font = { bold: true }

    // Loaded once per job, not per batch: getLocationSlugMap() memoises for 60s
    // and a full clinics export runs for minutes, so a per-batch call would
    // re-query every location several times over for no benefit.
    const slugMap = def.needsLocationSlugs ? await getLocationSlugMap() : undefined

    let lastId = 0
    let processed = 0
    let batchNo = 0

    for (;;) {
      const pageQ = def.buildPage(filters, lastId, BATCH)
      const { rows } = await pool.query(pageQ.text, pageQ.values)
      if (!rows.length) break

      if (def.hydrate) await def.hydrate(pool, rows, { siteUrl, slugMap })

      for (const r of rows) {
        sheet.addRow(def.mapRow(r, siteUrl)).commit()
      }

      lastId = rows[rows.length - 1].id
      processed += rows.length
      batchNo++

      if (batchNo % PROGRESS_EVERY === 0) {
        await update({ processedRows: processed, heartbeatAt: new Date().toISOString() })
      }

      // Yield to the event loop so a long export cannot starve HTTP traffic.
      await new Promise((r) => setImmediate(r))
    }

    sheet.commit()
    await workbook.commit()

    const size = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0

    await update({
      status: 'done',
      processedRows: processed,
      totalRows: Math.max(totalRows, processed),
      fileSizeBytes: size,
      fileUrl: `/api/admin/exports/${jobId}/download`,
      finishedAt: new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
    })
    payload.logger.info(`[export ${jobId}] ${collectionSlug} done: ${processed} rows, ${size} bytes`)
  } catch (err: any) {
    payload.logger.error(`[export ${jobId}] failed: ${err?.message ?? err}`)
    // Best effort: don't leave a half-written file behind pretending to be valid.
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath) } catch {}
    await update({
      status: 'failed',
      error: String(err?.message ?? err).slice(0, 2000),
      finishedAt: new Date().toISOString(),
    })
  }
}

/**
 * A job whose process died (deploy, restart, OOM) stays "running" forever and the
 * UI would show a progress bar that never moves. Anything running without a
 * heartbeat for this long is treated as dead.
 */
const STALE_MS = 3 * 60 * 1000

export async function reapAbandonedJobs(payload: any) {
  const cutoff = new Date(Date.now() - STALE_MS).toISOString()
  try {
    const stale = await payload.find({
      collection: 'export-jobs',
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
        collection: 'export-jobs',
        id: job.id,
        data: {
          status: 'abandoned',
          error: 'The server restarted while this export was running. Start it again.',
          finishedAt: new Date().toISOString(),
        },
        overrideAccess: true,
      })
    }
    return stale.docs.length
  } catch (e: any) {
    payload.logger.error(`[export reaper] ${e?.message ?? e}`)
    return 0
  }
}

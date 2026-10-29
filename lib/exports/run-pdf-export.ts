import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { pipeline } from 'stream/promises'
import { Worker } from 'worker_threads'
import JSZip from 'jszip'
import { getGuideBySlug } from '@/lib/guide-queries'
import { getNewsBySlug } from '@/lib/news-queries'
import { getFaqPreview } from '@/lib/faqs/queries'
import { guidePdfDoc, newsPdfDoc, type PdfDoc } from './pdf/content-model'
import { EXPORT_DIR, exportFilePath } from './run-export'
import { deleteExport, isExportStorageEnabled, uploadExport } from './export-storage'

/**
 * Guides & News export: one PDF per article, all in one zip. Same job model as
 * the Excel exports (lib/exports/run-export.ts): a row in export-jobs, a
 * background run that reports progress, an admin-only download.
 *
 * What keeps the live site safe while it runs:
 *   - PDF layout happens in a worker thread at low CPU priority, so page
 *     requests on the main thread are never stuck behind it
 *   - one article at a time, with a short pause after each
 *   - one export of any kind at a time (the API refuses a second)
 * The finished zip goes to private Spaces storage (export-storage.ts), so either
 * production instance can serve the download and a redeploy does not lose it.
 */

export const PDF_EXPORT_SLUG = 'guides-news-pdf'
export const EXPORT_KEEP_DAYS = 7
const KEEP_MS = EXPORT_KEEP_DAYS * 24 * 60 * 60 * 1000
const PAUSE_MS = 150
const DOC_TIMEOUT_MS = 60_000
const WORKER_FILE = path.join(process.cwd(), 'lib', 'exports', 'pdf', 'render-worker.mjs')

export type PdfExportFilters = {
  collection: 'both' | 'guides' | 'news'
  /** guide-categories slug; guides only. Matches primary or secondary category. */
  category?: string
  /** YYYY-MM, UTC month of publishedAt, same as the /news month chips; news only. */
  month?: string
}

type Item = { kind: 'guides' | 'news'; slug: string }

// Same public gate as the site (lib/guide-queries.ts, lib/news-queries.ts).
const APPROVED = `review_status = 'approved'`

export function monthLabel(m: string) {
  return new Date(`${m}-01T00:00:00Z`).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/** Dropdown data for the admin panel. Categories with no published guide are left out, like /guides. */
export async function listPdfExportOptions(pool: any) {
  const [counts, cats, months] = await Promise.all([
    pool.query(
      `SELECT (SELECT count(*)::int FROM guides WHERE ${APPROVED}) AS guides, (SELECT count(*)::int FROM news WHERE ${APPROVED}) AS news`,
    ),
    pool.query(
      `SELECT c.slug, c.name,
              (SELECT count(*)::int FROM guides g
                WHERE g.${APPROVED}
                  AND (g.primary_category_id = c.id OR EXISTS (
                        SELECT 1 FROM guides_rels r
                         WHERE r.parent_id = g.id AND r.path = 'secondaryCategories' AND r.guide_categories_id = c.id))) AS count
         FROM guide_categories c
        ORDER BY c.sort_order NULLS LAST, c.name`,
    ),
    pool.query(
      `SELECT to_char(published_at AT TIME ZONE 'UTC', 'YYYY-MM') AS value, count(*)::int AS count
         FROM news WHERE ${APPROVED} AND published_at IS NOT NULL
        GROUP BY 1 ORDER BY 1 DESC`,
    ),
  ])
  return {
    counts: counts.rows[0] as { guides: number; news: number },
    categories: cats.rows.filter((r: any) => r.count > 0) as { slug: string; name: string; count: number }[],
    months: months.rows.map((r: any) => ({ ...r, label: monthLabel(r.value) })) as { value: string; label: string; count: number }[],
  }
}

export async function selectPdfExportItems(pool: any, f: PdfExportFilters): Promise<Item[]> {
  const items: Item[] = []
  if (f.collection !== 'news') {
    const q = f.category
      ? await pool.query(
          `SELECT g.slug FROM guides g JOIN guide_categories c ON c.slug = $1
            WHERE g.${APPROVED}
              AND (g.primary_category_id = c.id OR EXISTS (
                    SELECT 1 FROM guides_rels r
                     WHERE r.parent_id = g.id AND r.path = 'secondaryCategories' AND r.guide_categories_id = c.id))
            ORDER BY g.slug`,
          [f.category],
        )
      : await pool.query(`SELECT slug FROM guides WHERE ${APPROVED} ORDER BY slug`)
    items.push(...q.rows.map((r: any) => ({ kind: 'guides' as const, slug: r.slug })))
  }
  if (f.collection !== 'guides') {
    const q = f.month
      ? await pool.query(
          `SELECT slug FROM news
            WHERE ${APPROVED} AND published_at >= $1::timestamptz AND published_at < ($1::timestamptz + interval '1 month')
            ORDER BY slug`,
          [`${f.month}-01T00:00:00Z`],
        )
      : await pool.query(`SELECT slug FROM news WHERE ${APPROVED} ORDER BY slug`)
    items.push(...q.rows.map((r: any) => ({ kind: 'news' as const, slug: r.slug })))
  }
  return items
}

/** Loads an article exactly as its page does, then flattens it for the PDF. */
export async function loadPdfDoc(item: Item): Promise<PdfDoc | null> {
  if (item.kind === 'guides') {
    const g = await getGuideBySlug(item.slug)
    return g ? guidePdfDoc(g, await getFaqPreview({ field: 'guides', id: g.id })) : null
  }
  const n = await getNewsBySlug(item.slug)
  return n ? newsPdfDoc(n) : null
}

/**
 * One worker for the whole job, used for one article at a time. A worker that
 * crashes or hangs on an article is killed and replaced, so one bad article
 * costs that article only.
 */
export function createPdfRenderer() {
  let worker: Worker | null = null
  return {
    render(doc: PdfDoc): Promise<Buffer> {
      // 256 MB is well above what one article needs (all 225 staging articles
      // ran inside it); it caps a runaway layout instead of letting it grow
      // toward the instance limit (staging is a 1 GB box).
      if (!worker) {
        const fresh = new Worker(WORKER_FILE, { resourceLimits: { maxOldGenerationSizeMb: 256 } })
        // Always-on listeners: an 'error' event with no listener would throw
        // in the web server process and take the whole site down.
        fresh.on('error', () => {
          if (worker === fresh) worker = null
        })
        fresh.on('exit', () => {
          if (worker === fresh) worker = null
        })
        worker = fresh
      }
      const w = worker
      return new Promise((resolve, reject) => {
        const finish = (err: Error | null, pdf?: Buffer, kill = false) => {
          clearTimeout(timer)
          w.off('message', onMessage).off('error', onError).off('exit', onExit)
          if (kill) {
            if (worker === w) worker = null
            void w.terminate()
          }
          if (err) reject(err)
          else resolve(pdf!)
        }
        const onMessage = (m: { ok: boolean; pdf?: Uint8Array; error?: string }) =>
          m.ok ? finish(null, Buffer.from(m.pdf!)) : finish(new Error(m.error || 'PDF render failed'))
        const onError = (e: Error) => finish(e, undefined, true)
        const onExit = (code: number) => finish(new Error(`PDF worker stopped (exit ${code})`), undefined, true)
        const timer = setTimeout(() => finish(new Error('PDF took longer than 60s'), undefined, true), DOC_TIMEOUT_MS)
        w.on('message', onMessage).on('error', onError).on('exit', onExit)
        w.postMessage(doc)
      })
    },
    close() {
      void worker?.terminate()
      worker = null
    },
  }
}

export function pdfFilterSummary(f: PdfExportFilters, categoryName?: string) {
  const what = f.collection === 'both' ? 'Guides and News' : f.collection === 'guides' ? 'Guides' : 'News'
  if (f.category) return `${what}, category: ${categoryName || f.category}`
  if (f.month) return `${what}, ${monthLabel(f.month)}`
  return what
}

export async function runPdfExportJob(opts: { payload: any; jobId: number | string; filters: PdfExportFilters }) {
  const { payload, jobId, filters } = opts
  const pool = (payload.db as any).pool
  const update = (data: Record<string, unknown>) =>
    payload.update({ collection: 'export-jobs', id: jobId, data, overrideAccess: true }).catch((e: any) => {
      payload.logger.error(`[pdf export ${jobId}] progress write failed: ${e?.message ?? e}`)
    })

  const fileName = `guides-news-pdf-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}-${jobId}.zip`
  const filePath = exportFilePath(fileName)
  const renderer = createPdfRenderer()

  try {
    if (!pool) throw new Error('No Postgres pool available.')
    const items = await selectPdfExportItems(pool, filters)
    const now = () => new Date().toISOString()
    await update({ status: 'running', totalRows: items.length, processedRows: 0, fileName, startedAt: now(), heartbeatAt: now() })
    if (!items.length) throw new Error('No published guides or news match these filters.')

    const zip = new JSZip()
    const failed: string[] = []
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      // Slugs are admin-typed; keep "../" and friends out of zip entry names.
      const name = `${it.kind}/${it.slug.replace(/[^a-z0-9_-]+/gi, '-')}.pdf`
      try {
        const doc = await loadPdfDoc(it)
        if (!doc) throw new Error('not found or no longer published')
        zip.file(name, await renderer.render(doc))
      } catch (e: any) {
        failed.push(`${name}: ${e?.message ?? e}`)
        payload.logger.error(`[pdf export ${jobId}] ${name} failed: ${e?.message ?? e}`)
      }
      // Every article, not every few: one slow article must not let the
      // heartbeat go stale and get a live job reaped as abandoned.
      await update({ processedRows: i + 1, heartbeatAt: now() })
      await new Promise((r) => setTimeout(r, PAUSE_MS))
    }

    if (failed.length === items.length) throw new Error(`Every PDF failed. First error: ${failed[0]}`)
    if (failed.length) zip.file('export-errors.txt', `${failed.join('\n')}\n`)

    fs.mkdirSync(EXPORT_DIR, { recursive: true })
    // PDFs are already compressed inside; STORE skips a second, pointless pass.
    await pipeline(zip.generateNodeStream({ streamFiles: true, compression: 'STORE' }), fs.createWriteStream(filePath))
    const size = fs.statSync(filePath).size

    let storageKey: string | undefined
    if (isExportStorageEnabled) {
      // Random part so the key cannot be guessed from the job id and time.
      storageKey = `exports/${crypto.randomBytes(12).toString('hex')}-${fileName}`
      await uploadExport(storageKey, filePath, size, 'application/zip')
      fs.unlinkSync(filePath)
    }

    await update({
      status: 'done',
      processedRows: items.length,
      fileSizeBytes: size,
      fileUrl: `/api/admin/exports/${jobId}/download`,
      storageKey,
      error: failed.length
        ? `${failed.length} of ${items.length} PDFs failed; they are listed in export-errors.txt inside the zip.`
        : undefined,
      finishedAt: now(),
      heartbeatAt: now(),
    })
    payload.logger.info(`[pdf export ${jobId}] done: ${items.length - failed.length}/${items.length} PDFs, ${size} bytes`)
  } catch (err: any) {
    payload.logger.error(`[pdf export ${jobId}] failed: ${err?.message ?? err}`)
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch {}
    await update({ status: 'failed', error: String(err?.message ?? err).slice(0, 2000), finishedAt: new Date().toISOString() })
  } finally {
    renderer.close()
  }
}

/** Downloads are allowed for EXPORT_KEEP_DAYS after a job finishes. */
export function isExportExpired(job: { finishedAt?: string | null }) {
  return !!job.finishedAt && Date.now() - new Date(job.finishedAt).getTime() > KEEP_MS
}

/** Deletes stored files older than EXPORT_KEEP_DAYS. The job row stays as history. */
export async function purgeExpiredExports(payload: any) {
  if (!isExportStorageEnabled) return
  try {
    const old = await payload.find({
      collection: 'export-jobs',
      where: {
        and: [{ storageKey: { exists: true } }, { finishedAt: { less_than: new Date(Date.now() - KEEP_MS).toISOString() } }],
      },
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })
    for (const job of old.docs) {
      await deleteExport(job.storageKey)
      await payload.update({
        collection: 'export-jobs',
        id: job.id,
        data: { storageKey: null, fileUrl: null, error: `File deleted after ${EXPORT_KEEP_DAYS} days. Run the export again.` },
        overrideAccess: true,
      })
    }
  } catch (e: any) {
    payload.logger.error(`[export purge] ${e?.message ?? e}`)
  }
}

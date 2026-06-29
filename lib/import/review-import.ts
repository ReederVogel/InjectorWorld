import { createReadStream } from 'fs'
import { access } from 'fs/promises'
import { parse } from 'csv-parse'
import pg from 'pg'
import { getDbConnectionString, getDbSsl } from '../db-ssl'
import { recomputeClinicReviewAggregates } from '../review-aggregates'

export const DEFAULT_REVIEW_BATCH_SIZE = 500
const ERROR_SAMPLE_LIMIT = 25

export type ReviewCsvRow = Record<string, string | undefined>

export type ReviewImportRow = {
  reviewId: string
  clinicDbId: number
  rating: number
  title: string | null
  excerpt: string | null
  text: string | null
  publishStatus: 'full' | 'excerpt_only' | 'hidden'
  treatmentTag: string | null
  reviewDate: string | null
  sourcePlatform: string | null
  sourceReviewId: string
  sourceUrl: string | null
  attributionRequired: boolean
  responseFromProvider: string | null
  responseDate: string | null
  matchConfidence: number | null
  needsManualReview: boolean
  importBatch?: string | null
  moderationStatus: 'pending' | 'approved' | 'rejected'
}

export type ReviewImportCounts = {
  created: number
  updated: number
  skippedUnmatched: number
  skippedInvalid: number
  failed: number
}

export type ReviewImportError = {
  line: number
  reviewId?: string
  sourceReviewId?: string
  clinicId?: string
  reason: string
}

export type ReviewImportResult = {
  counts: ReviewImportCounts
  errors: ReviewImportError[]
  touchedClinicIds: number[]
  aggregateUpdates: number
}

export type ReviewImportMode = 'auto' | 'stage'

type ProcessOptions = {
  batchSize?: number
  mode?: ReviewImportMode
  recomputeAggregates?: boolean
  log?: (message: string) => void
}

function cleanText(value: string | undefined): string | null {
  const trimmed = String(value ?? '').trim()
  return trimmed ? trimmed : null
}

function parseNumber(value: string | undefined): number | null {
  const cleaned = cleanText(value)
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function parseBoolean(value: string | undefined): boolean {
  const normalized = String(value ?? '').trim().toLowerCase()
  return ['true', 't', '1', 'yes', 'y'].includes(normalized)
}

function parseDate(value: string | undefined): string | null {
  const cleaned = cleanText(value)
  if (!cleaned) return null
  const parsed = new Date(cleaned)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function normalizePublishStatus(value: string | undefined): ReviewImportRow['publishStatus'] {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/-/g, '_')
  if (normalized === 'full') return 'full'
  if (normalized === 'hidden') return 'hidden'
  return 'excerpt_only'
}

export function pushReviewImportError(errors: ReviewImportError[], error: ReviewImportError) {
  if (errors.length < ERROR_SAMPLE_LIMIT) errors.push(error)
}

export async function createImportPool(): Promise<pg.Pool> {
  if (!process.env.DATABASE_URI) {
    throw new Error('DATABASE_URI is required.')
  }
  return new pg.Pool({
    connectionString: getDbConnectionString(),
    ssl: getDbSsl() as any,
  })
}

export async function loadReviewClinicMap(pool: pg.Pool): Promise<Map<string, number>> {
  const res = await pool.query<{ clinic_id: string; id: number }>(
    `SELECT clinic_id, id FROM clinics WHERE clinic_id IS NOT NULL AND clinic_id <> ''`,
  )
  return new Map(res.rows.map((row) => [row.clinic_id, row.id]))
}

export function reviewCsvRowToImportRow(
  row: ReviewCsvRow,
  line: number,
  clinicMap: Map<string, number>,
  mode: ReviewImportMode,
): { review?: ReviewImportRow; skippedUnmatched?: boolean; error?: ReviewImportError } {
  const reviewId = cleanText(row.review_id)
  const clinicImportId = cleanText(row.clinic_id)
  const sourceReviewId = cleanText(row.source_review_id)
  const rating = parseNumber(row.rating)

  if (!reviewId) return { error: { line, clinicId: clinicImportId ?? undefined, reason: 'Missing review_id' } }
  if (!sourceReviewId) return { error: { line, reviewId, clinicId: clinicImportId ?? undefined, reason: 'Missing source_review_id' } }
  if (!clinicImportId) return { error: { line, reviewId, sourceReviewId, reason: 'Missing clinic_id' } }
  if (rating == null || rating < 1 || rating > 5) {
    return { error: { line, reviewId, sourceReviewId, clinicId: clinicImportId, reason: 'Invalid rating' } }
  }

  const clinicDbId = clinicMap.get(clinicImportId)
  if (!clinicDbId) return { skippedUnmatched: true }

  const needsManualReview = parseBoolean(row.needs_manual_review)

  return {
    review: {
      reviewId,
      clinicDbId,
      rating,
      title: cleanText(row.review_title),
      excerpt: cleanText(row.review_excerpt),
      text: cleanText(row.review_text),
      publishStatus: normalizePublishStatus(row.review_text_publish_status),
      treatmentTag: cleanText(row.treatment_tag),
      reviewDate: parseDate(row.review_date),
      sourcePlatform: cleanText(row.source_platform),
      sourceReviewId,
      sourceUrl: cleanText(row.source_url),
      attributionRequired: parseBoolean(row.attribution_required),
      responseFromProvider: cleanText(row.response_from_provider),
      responseDate: parseDate(row.response_date),
      matchConfidence: parseNumber(row.match_confidence),
      needsManualReview,
      importBatch: cleanText(row.import_batch),
      moderationStatus: mode === 'stage' ? 'pending' : needsManualReview ? 'pending' : 'approved',
    },
  }
}

function dedupeReviewBatch(rows: ReviewImportRow[], errors: ReviewImportError[]): ReviewImportRow[] {
  const deduped = new Map<string, ReviewImportRow>()
  for (const row of rows) {
    if (deduped.has(row.sourceReviewId)) {
      pushReviewImportError(errors, {
        reviewId: row.reviewId,
        sourceReviewId: row.sourceReviewId,
        reason: 'Duplicate source_review_id in the same batch; last row wins',
        line: 0,
      })
    }
    deduped.set(row.sourceReviewId, row)
  }
  return Array.from(deduped.values())
}

function valuesForReviewRows(rows: ReviewImportRow[]) {
  const casts = [
    'text',
    'text',
    'int',
    'numeric',
    'text',
    'text',
    'text',
    'enum_reviews_publish_status',
    'text',
    'timestamptz',
    'text',
    'text',
    'boolean',
    'text',
    'timestamptz',
    'numeric',
    'boolean',
    'text',
    'enum_reviews_moderation_status',
  ]

  const values: unknown[] = []
  const placeholders = rows.map((row, rowIndex) => {
    const rowValues = [
      row.sourceReviewId,
      row.reviewId,
      row.clinicDbId,
      row.rating,
      row.title,
      row.excerpt,
      row.text,
      row.publishStatus,
      row.treatmentTag,
      row.reviewDate,
      row.sourcePlatform,
      row.sourceUrl,
      row.attributionRequired,
      row.responseFromProvider,
      row.responseDate,
      row.matchConfidence,
      row.needsManualReview,
      row.importBatch ?? null,
      row.moderationStatus,
    ]
    values.push(...rowValues)
    const base = rowIndex * rowValues.length
    return `(${rowValues.map((_, valueIndex) => `$${base + valueIndex + 1}::${casts[valueIndex]}`).join(', ')})`
  })

  return { values, placeholders: placeholders.join(', ') }
}

async function updateExistingReviews(pool: pg.Pool, rows: ReviewImportRow[]): Promise<number> {
  if (rows.length === 0) return 0
  const { values, placeholders } = valuesForReviewRows(rows)
  const res = await pool.query(
    `
      UPDATE reviews AS r
      SET
        review_id = v.review_id,
        clinic_id = v.clinic_id,
        rating = v.rating,
        title = v.title,
        excerpt = v.excerpt,
        text = v.text,
        publish_status = v.publish_status,
        treatment_tag = v.treatment_tag,
        review_date = v.review_date,
        source_platform = v.source_platform,
        source_url = v.source_url,
        attribution_required = v.attribution_required,
        response_from_provider = v.response_from_provider,
        response_date = v.response_date,
        match_confidence = v.match_confidence,
        needs_manual_review = v.needs_manual_review,
        import_batch = v.import_batch,
        moderation_status = v.moderation_status,
        updated_at = NOW()
      FROM (
        VALUES ${placeholders}
      ) AS v(
        source_review_id,
        review_id,
        clinic_id,
        rating,
        title,
        excerpt,
        text,
        publish_status,
        treatment_tag,
        review_date,
        source_platform,
        source_url,
        attribution_required,
        response_from_provider,
        response_date,
        match_confidence,
        needs_manual_review,
        import_batch,
        moderation_status
      )
      WHERE r.source_review_id = v.source_review_id
    `,
    values,
  )
  return res.rowCount ?? 0
}

async function insertNewReviews(pool: pg.Pool, rows: ReviewImportRow[]): Promise<number> {
  if (rows.length === 0) return 0
  const { values, placeholders } = valuesForReviewRows(rows)
  const res = await pool.query(
    `
      INSERT INTO reviews (
        source_review_id,
        review_id,
        clinic_id,
        rating,
        title,
        excerpt,
        text,
        publish_status,
        treatment_tag,
        review_date,
        source_platform,
        source_url,
        attribution_required,
        response_from_provider,
        response_date,
        match_confidence,
        needs_manual_review,
        import_batch,
        moderation_status,
        created_at,
        updated_at
      )
      SELECT
        v.source_review_id,
        v.review_id,
        v.clinic_id,
        v.rating,
        v.title,
        v.excerpt,
        v.text,
        v.publish_status,
        v.treatment_tag,
        v.review_date,
        v.source_platform,
        v.source_url,
        v.attribution_required,
        v.response_from_provider,
        v.response_date,
        v.match_confidence,
        v.needs_manual_review,
        v.import_batch,
        v.moderation_status,
        NOW(),
        NOW()
      FROM (
        VALUES ${placeholders}
      ) AS v(
        source_review_id,
        review_id,
        clinic_id,
        rating,
        title,
        excerpt,
        text,
        publish_status,
        treatment_tag,
        review_date,
        source_platform,
        source_url,
        attribution_required,
        response_from_provider,
        response_date,
        match_confidence,
        needs_manual_review,
        import_batch,
        moderation_status
      )
      WHERE NOT EXISTS (
        SELECT 1 FROM reviews r WHERE r.source_review_id = v.source_review_id
      )
    `,
    values,
  )
  return res.rowCount ?? 0
}

export async function upsertReviewRows(
  pool: pg.Pool,
  rows: ReviewImportRow[],
  errors: ReviewImportError[],
): Promise<Pick<ReviewImportCounts, 'created' | 'updated' | 'failed'>> {
  const deduped = dedupeReviewBatch(rows, errors)
  if (deduped.length === 0) return { created: 0, updated: 0, failed: 0 }

  const sourceReviewIds = deduped.map((row) => row.sourceReviewId)
  const existingRes = await pool.query<{ source_review_id: string }>(
    `SELECT source_review_id FROM reviews WHERE source_review_id = ANY($1::text[])`,
    [sourceReviewIds],
  )
  const existing = new Set(existingRes.rows.map((row) => row.source_review_id))
  const updateRows = deduped.filter((row) => existing.has(row.sourceReviewId))
  const insertRows = deduped.filter((row) => !existing.has(row.sourceReviewId))

  const updated = await updateExistingReviews(pool, updateRows)
  const created = await insertNewReviews(pool, insertRows)

  return { created, updated, failed: 0 }
}

export async function flushReviewImportBatch(
  pool: pg.Pool,
  rows: ReviewImportRow[],
  counts: ReviewImportCounts,
  errors: ReviewImportError[],
) {
  if (rows.length === 0) return

  try {
    const result = await upsertReviewRows(pool, rows, errors)
    counts.created += result.created
    counts.updated += result.updated
    counts.failed += result.failed
    return
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    pushReviewImportError(errors, { line: 0, reason: `Batch failed, retrying row-by-row: ${message}` })
  }

  for (const row of rows) {
    try {
      const result = await upsertReviewRows(pool, [row], errors)
      counts.created += result.created
      counts.updated += result.updated
    } catch (err) {
      counts.failed++
      pushReviewImportError(errors, {
        line: 0,
        reviewId: row.reviewId,
        sourceReviewId: row.sourceReviewId,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }
}

export async function processReviewCsvRows(
  pool: pg.Pool,
  source: AsyncIterable<ReviewCsvRow>,
  opts: ProcessOptions = {},
): Promise<ReviewImportResult> {
  const batchSize = opts.batchSize && opts.batchSize > 0 ? opts.batchSize : DEFAULT_REVIEW_BATCH_SIZE
  const mode = opts.mode ?? 'auto'
  const counts: ReviewImportCounts = {
    created: 0,
    updated: 0,
    skippedUnmatched: 0,
    skippedInvalid: 0,
    failed: 0,
  }
  const errors: ReviewImportError[] = []
  const touchedClinicIds = new Set<number>()

  const clinicMap = await loadReviewClinicMap(pool)
  opts.log?.(`[reviews] Loaded ${clinicMap.size.toLocaleString()} clinic import ids.`)

  let line = 1
  let processed = 0
  let batch: ReviewImportRow[] = []

  for await (const row of source) {
    line++
    processed++

    try {
      const parsed = reviewCsvRowToImportRow(row, line, clinicMap, mode)
      if (parsed.error) {
        counts.skippedInvalid++
        pushReviewImportError(errors, parsed.error)
        continue
      }
      if (parsed.skippedUnmatched) {
        counts.skippedUnmatched++
        continue
      }
      if (!parsed.review) continue

      touchedClinicIds.add(parsed.review.clinicDbId)
      batch.push(parsed.review)

      if (batch.length >= batchSize) {
        await flushReviewImportBatch(pool, batch, counts, errors)
        batch = []
      }

      if (processed % 5000 === 0) {
        opts.log?.(
          `[reviews] Processed ${processed.toLocaleString()} rows. Created ${counts.created.toLocaleString()}, updated ${counts.updated.toLocaleString()}, unmatched ${counts.skippedUnmatched.toLocaleString()}, invalid ${counts.skippedInvalid.toLocaleString()}, failed ${counts.failed.toLocaleString()}.`,
        )
      }
    } catch (err) {
      counts.failed++
      pushReviewImportError(errors, {
        line,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  await flushReviewImportBatch(pool, batch, counts, errors)

  const aggregateUpdates = opts.recomputeAggregates === false
    ? 0
    : await recomputeClinicReviewAggregates(pool, Array.from(touchedClinicIds))

  return {
    counts,
    errors,
    touchedClinicIds: Array.from(touchedClinicIds),
    aggregateUpdates,
  }
}

export async function importReviewsFromCsv(
  csvPath: string,
  opts: ProcessOptions = {},
): Promise<ReviewImportResult> {
  await access(csvPath)
  const pool = await createImportPool()
  try {
    const parser = createReadStream(csvPath).pipe(
      parse({
        columns: true,
        bom: true,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: false,
      }),
    )
    return await processReviewCsvRows(pool, parser as AsyncIterable<ReviewCsvRow>, opts)
  } finally {
    await pool.end()
  }
}

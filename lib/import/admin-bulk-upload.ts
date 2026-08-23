import type pg from 'pg'
import { recomputeClinicReviewAggregates } from '../review-aggregates'
import {
  processReviewCsvRows,
  type ReviewCsvRow,
} from './review-import'

export type BulkUploadCollection = 'clinics' | 'reviews'

export type BulkRowError = {
  line: number
  stableId?: string
  reason: string
}

export type BulkUploadItem = {
  id: number
  stableId: string
  label: string
  status: string
}

export type BulkUploadReport = {
  collection: BulkUploadCollection
  batch: string
  total: number
  created: number
  updated: number
  skipped: number
  skippedUnmatched: number
  failed: number
  errors: BulkRowError[]
  items: BulkUploadItem[]
  aggregateUpdates?: number
}

export type BulkApproveReport = {
  collection: BulkUploadCollection
  batch?: string
  approved: number
  aggregateUpdates?: number
  items: BulkUploadItem[]
}

type CsvRow = Record<string, string | undefined>

const DEFAULT_BATCH_SIZE = 500
const ERROR_SAMPLE_LIMIT = 50

function pushError(errors: BulkRowError[], error: BulkRowError) {
  if (errors.length < ERROR_SAMPLE_LIMIT) errors.push(error)
}

function text(value: unknown): string | null {
  const trimmed = String(value ?? '').trim()
  return trimmed ? trimmed : null
}

function numberOrNull(value: unknown): number | null {
  const raw = text(value)
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function intOrNull(value: unknown): number | null {
  const parsed = numberOrNull(value)
  return parsed == null ? null : Math.trunc(parsed)
}

function bool(value: unknown, fallback = false): boolean {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (!normalized) return fallback
  if (['true', 't', '1', 'yes', 'y'].includes(normalized)) return true
  if (['false', 'f', '0', 'no', 'n'].includes(normalized)) return false
  return fallback
}

function isoDateOrNull(value: unknown): string | null {
  const raw = text(value)
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)
}

function safeJson(value: unknown): unknown {
  const raw = text(value)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function normalizeClinicType(raw: string | null): string {
  const s = (raw ?? '').toLowerCase().replace(/[^a-z ]/g, '').trim()
  if (!s) return 'other'
  if (s.includes('plastic') || s.includes('cosmetic surgery') || s.includes('facial plastic')) return 'plastic-surgery'
  if (s.includes('derm')) return 'dermatology'
  if (s.includes('dental') || s.includes('dds') || s.includes('orthodon')) return 'dental-aesthetics'
  if (
    s.includes('med spa') ||
    s.includes('medspa') ||
    s.includes('medical spa') ||
    s.includes('spa') ||
    s.includes('wellness') ||
    s.includes('aesthetic') ||
    s.includes('beauty') ||
    s.includes('rejuven') ||
    s.includes('skin') ||
    s.includes('laser') ||
    s.includes('weight loss') ||
    s.includes('infusion')
  ) return 'medspa'
  return 'other'
}

function normalizeCollection(value: unknown): BulkUploadCollection | null {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'clinic') return 'clinics'
  if (normalized === 'review') return 'reviews'
  return ['clinics', 'reviews'].includes(normalized)
    ? normalized as BulkUploadCollection
    : null
}

export function makeImportBatch(collection: BulkUploadCollection): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const rand = Math.random().toString(36).slice(2, 8)
  return `${collection}-upload-${stamp}-${rand}`
}

function batchSize(value: number | undefined): number {
  return Number.isInteger(value) && value && value > 0 ? value : DEFAULT_BATCH_SIZE
}

async function flushClinicRows(
  pool: pg.Pool,
  rows: Record<string, unknown>[],
): Promise<{ created: number; updated: number; failed: number; errors: BulkRowError[] }> {
  if (rows.length === 0) return { created: 0, updated: 0, failed: 0, errors: [] }
  const stableIds = rows.map((row) => row.clinic_id as string)
  const existingRes = await pool.query<{ clinic_id: string }>(
    `SELECT clinic_id FROM clinics WHERE clinic_id = ANY($1::text[])`,
    [stableIds],
  )
  const existing = new Set(existingRes.rows.map((row) => row.clinic_id))
  const updateRows = rows.filter((row) => existing.has(row.clinic_id as string))
  const insertRows = rows.filter((row) => !existing.has(row.clinic_id as string))

  let created = 0
  let updated = 0
  const errors: BulkRowError[] = []

  const upsert = async (batchRows: Record<string, unknown>[], mode: 'insert' | 'update') => {
    if (batchRows.length === 0) return 0
    const columns = [
      'clinic_id',
      'clinic_name',
      'slug',
      'tagline',
      'description',
      'clinic_type',
      'address_line1',
      'address_line2',
      'city',
      'state',
      'zip',
      'neighborhood',
      'county',
      'country',
      'latitude',
      'longitude',
      'google_place_id',
      'google_maps_url',
      'directions_url',
      'apple_maps_url',
      'phone',
      'email',
      'website_url',
      'booking_url',
      'instagram_url',
      'tiktok_url',
      'facebook_url',
      'hours_json',
      'accepts_insurance',
      'payment_methods',
      'amenities',
      'logo_url',
      'aggregate_rating',
      'aggregate_rating_count',
      'last_scraped_date',
      'data_confidence',
      'needs_manual_review',
      'status',
      'noindex',
      'published_at',
      'import_batch',
      'updated_at',
      'created_at',
    ]
    const casts = [
      'text',
      'text',
      'text',
      'text',
      'text',
      'enum_clinics_clinic_type',
      'text',
      'text',
      'text',
      'text',
      'text',
      'text',
      'text',
      'text',
      'numeric',
      'numeric',
      'text',
      'text',
      'text',
      'text',
      'text',
      'text',
      'text',
      'text',
      'text',
      'text',
      'text',
      'jsonb',
      'boolean',
      'text',
      'text',
      'text',
      'numeric',
      'int',
      'timestamptz',
      'numeric',
      'boolean',
      'enum_clinics_status',
      'boolean',
      'timestamptz',
      'text',
      'timestamptz',
      'timestamptz',
    ]
    const values: unknown[] = []
    const placeholders = batchRows.map((row, rowIndex) => {
      for (const column of columns) values.push(row[column] ?? null)
      const base = rowIndex * columns.length
      return `(${columns.map((_, valueIndex) => `$${base + valueIndex + 1}::${casts[valueIndex]}`).join(', ')})`
    }).join(', ')

    if (mode === 'insert') {
      const res = await pool.query(
        `
          INSERT INTO clinics (${columns.join(', ')})
          VALUES ${placeholders}
          ON CONFLICT (clinic_id) DO NOTHING
        `,
        values,
      )
      return res.rowCount ?? 0
    }

    const updateColumns = columns.filter((column) => !['clinic_id', 'created_at'].includes(column))
    const res = await pool.query(
      `
        UPDATE clinics AS c
        SET ${updateColumns.map((column) => `${column} = v.${column}`).join(', ')}
        FROM (
          VALUES ${placeholders}
        ) AS v(${columns.join(', ')})
        WHERE c.clinic_id = v.clinic_id
      `,
      values,
    )
    return res.rowCount ?? 0
  }

  try {
    updated += await upsert(updateRows, 'update')
    created += await upsert(insertRows, 'insert')
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    for (const row of rows) {
      try {
        const singleExisting = existing.has(row.clinic_id as string)
        if (singleExisting) updated += await upsert([row], 'update')
        else created += await upsert([row], 'insert')
      } catch (singleErr) {
        pushError(errors, {
          line: Number(row.__line ?? 0),
          stableId: row.clinic_id as string,
          reason: singleErr instanceof Error ? singleErr.message : reason,
        })
      }
    }
  }

  return { created, updated, failed: errors.length, errors }
}

function clinicRow(row: CsvRow, line: number, batch: string): { value?: Record<string, unknown>; error?: BulkRowError } {
  const clinicId = text(row.clinic_id ?? row.clinicId)
  const clinicName = text(row.clinic_name ?? row.clinicName)
  const city = text(row.city)
  const state = text(row.state)?.toUpperCase() ?? null
  const slug = text(row.slug) ?? (clinicName ? slugify(`${clinicName}-${text(row.zip) ?? city ?? state ?? ''}`) : null)

  if (!clinicId) return { error: { line, reason: 'Missing clinic_id' } }
  if (!clinicName) return { error: { line, stableId: clinicId, reason: 'Missing clinic_name' } }
  if (!city) return { error: { line, stableId: clinicId, reason: 'Missing city' } }
  if (!state) return { error: { line, stableId: clinicId, reason: 'Missing state' } }
  if (!slug) return { error: { line, stableId: clinicId, reason: 'Missing slug' } }

  return {
    value: {
      __line: line,
      clinic_id: clinicId,
      clinic_name: clinicName,
      slug,
      tagline: text(row.tagline),
      description: text(row.description),
      clinic_type: normalizeClinicType(text(row.clinic_type ?? row.clinicType)),
      address_line1: text(row.address_line_1 ?? row.addressLine1),
      address_line2: text(row.address_line_2 ?? row.addressLine2),
      city,
      state,
      zip: text(row.zip),
      neighborhood: text(row.neighborhood),
      county: text(row.county),
      country: text(row.country) ?? 'US',
      latitude: numberOrNull(row.latitude),
      longitude: numberOrNull(row.longitude),
      google_place_id: text(row.google_place_id ?? row.googlePlaceId),
      google_maps_url: text(row.google_maps_url ?? row.googleMapsUrl),
      directions_url: text(row.directions_url ?? row.directionsUrl),
      apple_maps_url: text(row.apple_maps_url ?? row.appleMapsUrl),
      phone: text(row.phone),
      email: text(row.email),
      website_url: text(row.website_url ?? row.websiteUrl),
      booking_url: text(row.booking_url ?? row.bookingUrl),
      instagram_url: text(row.instagram_url ?? row.instagramUrl),
      tiktok_url: text(row.tiktok_url ?? row.tiktokUrl),
      facebook_url: text(row.facebook_url ?? row.facebookUrl),
      hours_json: safeJson(row.hours_json ?? row.hoursJson),
      accepts_insurance: bool(row.accepts_insurance ?? row.acceptsInsurance, false),
      payment_methods: text(row.payment_methods ?? row.paymentMethods),
      amenities: text(row.amenities),
      logo_url: text(row.logo_url ?? row.logoUrl),
      aggregate_rating: numberOrNull(row.aggregate_rating ?? row.aggregateRating),
      aggregate_rating_count: intOrNull(row.aggregate_rating_count ?? row.aggregateRatingCount),
      last_scraped_date: isoDateOrNull(row.last_scraped_date ?? row.lastScrapedDate),
      data_confidence: numberOrNull(row.data_confidence ?? row.dataConfidence),
      needs_manual_review: true,
      status: 'draft',
      noindex: true,
      published_at: null,
      import_batch: batch,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  }
}


export async function stageBulkUpload(
  pool: pg.Pool,
  collection: BulkUploadCollection,
  rows: AsyncIterable<CsvRow>,
  opts: { batch?: string; batchSize?: number } = {},
): Promise<BulkUploadReport> {
  const normalized = normalizeCollection(collection)
  if (!normalized) throw new Error(`Unsupported collection: ${collection}`)

  const batch = opts.batch ?? makeImportBatch(normalized)
  const size = batchSize(opts.batchSize)

  if (normalized === 'reviews') {
    async function* rowsWithBatch() {
      for await (const row of rows) {
        yield { ...row, import_batch: batch } satisfies ReviewCsvRow
      }
    }
    const result = await processReviewCsvRows(pool, rowsWithBatch(), {
      batchSize: size,
      mode: 'stage',
      recomputeAggregates: false,
    })
    const items = await listUploadItems(pool, normalized, batch, 50)
    return {
      collection: normalized,
      batch,
      total: result.counts.created + result.counts.updated + result.counts.skippedInvalid + result.counts.skippedUnmatched + result.counts.failed,
      created: result.counts.created,
      updated: result.counts.updated,
      skipped: result.counts.skippedInvalid,
      skippedUnmatched: result.counts.skippedUnmatched,
      failed: result.counts.failed,
      errors: result.errors.map((error) => ({
        line: error.line,
        stableId: error.sourceReviewId ?? error.reviewId,
        reason: error.reason,
      })),
      items,
      aggregateUpdates: 0,
    }
  }

  let total = 0
  let created = 0
  let updated = 0
  let skipped = 0
  let failed = 0
  const errors: BulkRowError[] = []

  let line = 1
  let valueBatch: Record<string, unknown>[] = []
  for await (const row of rows) {
    line++
    total++
    const parsed = clinicRow(row, line, batch)
    if (parsed.error) {
      skipped++
      pushError(errors, parsed.error)
      continue
    }
    valueBatch.push(parsed.value!)
    if (valueBatch.length >= size) {
      const result = await flushClinicRows(pool, valueBatch)
      created += result.created
      updated += result.updated
      failed += result.failed
      for (const error of result.errors) pushError(errors, error)
      valueBatch = []
    }
  }
  if (valueBatch.length > 0) {
    const result = await flushClinicRows(pool, valueBatch)
    created += result.created
    updated += result.updated
    failed += result.failed
    for (const error of result.errors) pushError(errors, error)
  }

  const items = await listUploadItems(pool, normalized, batch, 50)
  return {
    collection: normalized,
    batch,
    total,
    created,
    updated,
    skipped,
    skippedUnmatched: 0,
    failed,
    errors,
    items,
  }
}

export async function listUploadItems(
  pool: pg.Pool,
  collection: BulkUploadCollection,
  batch: string,
  limit = 50,
): Promise<BulkUploadItem[]> {
  if (collection === 'clinics') {
    const res = await pool.query<{ id: number; stable_id: string; label: string; status: string }>(
      `SELECT id, clinic_id AS stable_id, clinic_name AS label, status::text FROM clinics WHERE import_batch = $1 ORDER BY updated_at DESC LIMIT $2`,
      [batch, limit],
    )
    return res.rows.map((row) => ({ id: row.id, stableId: row.stable_id, label: row.label, status: row.status }))
  }
  const res = await pool.query<{ id: number; stable_id: string; label: string | null; status: string }>(
    `SELECT id, source_review_id AS stable_id, title AS label, moderation_status::text AS status FROM reviews WHERE import_batch = $1 ORDER BY updated_at DESC LIMIT $2`,
    [batch, limit],
  )
  return res.rows.map((row) => ({ id: row.id, stableId: row.stable_id, label: row.label || row.stable_id, status: row.status }))
}

export async function approveStagedUpload(
  pool: pg.Pool,
  collection: BulkUploadCollection,
  opts: { batch?: string; ids?: number[]; actorUserId?: number },
): Promise<BulkApproveReport> {
  const ids = Array.from(new Set((opts.ids ?? []).filter((id) => Number.isInteger(id) && id > 0)))
  if (!opts.batch && ids.length === 0) throw new Error('Provide a batch or at least one item id.')

  const params: unknown[] = []
  const whereParts: string[] = []
  if (opts.batch) {
    params.push(opts.batch)
    whereParts.push(`import_batch = $${params.length}`)
  }
  if (ids.length > 0) {
    params.push(ids)
    whereParts.push(`id = ANY($${params.length}::int[])`)
  }
  const where = whereParts.join(' AND ')

  if (collection === 'clinics') {
    const res = await pool.query(
      `
        UPDATE clinics
        SET status = 'published'::enum_clinics_status,
            needs_manual_review = false,
            published_at = COALESCE(published_at, NOW()),
            updated_at = NOW()
        WHERE ${where}
          AND status <> 'published'
      `,
      params,
    )
    return {
      collection,
      batch: opts.batch,
      approved: res.rowCount ?? 0,
      items: opts.batch ? await listUploadItems(pool, collection, opts.batch, 50) : [],
    }
  }

  if (collection === 'reviews') {
    const res = await pool.query<{ clinic_id: number }>(
      `
        UPDATE reviews
        SET moderation_status = 'approved'::enum_reviews_moderation_status,
            updated_at = NOW()
        WHERE ${where}
          AND moderation_status <> 'approved'
        RETURNING clinic_id
      `,
      params,
    )
    const clinicIds = Array.from(new Set(res.rows.map((row) => row.clinic_id).filter(Boolean)))
    const aggregateUpdates = await recomputeClinicReviewAggregates(pool, clinicIds)
    return {
      collection,
      batch: opts.batch,
      approved: res.rowCount ?? 0,
      aggregateUpdates,
      items: opts.batch ? await listUploadItems(pool, collection, opts.batch, 50) : [],
    }
  }

  throw new Error(`Unsupported collection: ${collection}`)
}

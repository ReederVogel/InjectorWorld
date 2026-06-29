import type pg from 'pg'
import { recomputeClinicReviewAggregates } from '../review-aggregates'
import {
  processReviewCsvRows,
  type ReviewCsvRow,
} from './review-import'

export type BulkUploadCollection = 'clinics' | 'reviews' | 'news' | 'guides'

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

const NEWS_CATEGORIES = new Set([
  'treatment-update',
  'industry',
  'company',
  'announcement',
  'product-launch',
  'research',
  'regulation',
])

const GUIDE_CATEGORIES = new Set(['treatment-guide', 'article', 'expert-qa', 'cost-report'])

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

function lexicalBody(value: unknown): unknown {
  const raw = text(value)
  if (!raw) return null
  const parsed = safeJson(raw)
  if (parsed && typeof parsed === 'object') return parsed
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      children: [{
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        children: [{ type: 'text', format: 0, mode: 'normal', style: '', text: raw, version: 1 }],
      }],
    },
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

function normalizeNewsCategory(raw: string | null): string {
  const value = (raw ?? '').toLowerCase().trim().replace(/_/g, '-')
  if (NEWS_CATEGORIES.has(value)) return value
  if (value === 'regulatory' || value === 'regulatory-update') return 'regulation'
  if (value === 'science') return 'research'
  if (value === 'product') return 'product-launch'
  return 'industry'
}

function normalizeGuideCategory(raw: string | null): string {
  const value = (raw ?? '').toLowerCase().trim().replace(/_/g, '-')
  if (GUIDE_CATEGORIES.has(value)) return value
  if (value === 'guide') return 'treatment-guide'
  if (value === 'cost') return 'cost-report'
  if (value === 'qa' || value === 'expert-qa') return 'expert-qa'
  return 'treatment-guide'
}

function normalizeCollection(value: unknown): BulkUploadCollection | null {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'clinic') return 'clinics'
  if (normalized === 'review') return 'reviews'
  if (normalized === 'guide') return 'guides'
  if (normalized === 'article') return 'news'
  return ['clinics', 'reviews', 'news', 'guides'].includes(normalized)
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
      'service_type',
      'accepts_insurance',
      'payment_methods',
      'amenities',
      'logo_url',
      'aggregate_rating',
      'aggregate_rating_count',
      'year_established',
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
      'enum_clinics_service_type',
      'boolean',
      'text',
      'text',
      'text',
      'numeric',
      'int',
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
      service_type: ['In-Person', 'Telehealth', 'Both'].includes(text(row.service_type ?? row.serviceType) ?? '')
        ? text(row.service_type ?? row.serviceType)
        : 'In-Person',
      accepts_insurance: bool(row.accepts_insurance ?? row.acceptsInsurance, false),
      payment_methods: text(row.payment_methods ?? row.paymentMethods),
      amenities: text(row.amenities),
      logo_url: text(row.logo_url ?? row.logoUrl),
      aggregate_rating: numberOrNull(row.aggregate_rating ?? row.aggregateRating),
      aggregate_rating_count: intOrNull(row.aggregate_rating_count ?? row.aggregateRatingCount),
      year_established: intOrNull(row.year_established ?? row.yearEstablished),
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

async function flushContentRows(
  pool: pg.Pool,
  collection: 'news' | 'guides',
  rows: Record<string, unknown>[],
): Promise<{ created: number; updated: number; failed: number; errors: BulkRowError[] }> {
  if (rows.length === 0) return { created: 0, updated: 0, failed: 0, errors: [] }
  const table = collection
  const stableIds = rows.map((row) => row.slug as string)
  const existingRes = await pool.query<{ slug: string }>(
    `SELECT slug FROM ${table} WHERE slug = ANY($1::text[])`,
    [stableIds],
  )
  const existing = new Set(existingRes.rows.map((row) => row.slug))
  const updateRows = rows.filter((row) => existing.has(row.slug as string))
  const insertRows = rows.filter((row) => !existing.has(row.slug as string))
  const errors: BulkRowError[] = []
  let created = 0
  let updated = 0

  const categoryEnum = collection === 'news' ? 'enum_news_category' : 'enum_guides_category'
  const statusEnum = collection === 'news' ? 'enum_news_status' : 'enum_guides_status'
  const reviewEnum = collection === 'news' ? 'enum_news_review_status' : 'enum_guides_review_status'
  const indexEnum = collection === 'news' ? 'enum_news_index_state' : 'enum_guides_index_state'

  const upsert = async (batchRows: Record<string, unknown>[], mode: 'insert' | 'update') => {
    if (batchRows.length === 0) return 0
    const columns = collection === 'news'
      ? [
          'title',
          'slug',
          'excerpt',
          'cover_image_url',
          'body',
          'category',
          'author_id',
          'published_at',
          'status',
          'featured',
          'review_status',
          'index_state',
          'nofollow',
          'import_batch',
          'updated_at',
          'created_at',
        ]
      : [
          'title',
          'slug',
          'lede',
          'excerpt',
          'cover_image_url',
          'body',
          'category',
          'author_id',
          'published_at',
          'status',
          'featured',
          'review_status',
          'index_state',
          'nofollow',
          'import_batch',
          'updated_at',
          'created_at',
        ]
    const casts = collection === 'news'
      ? [
          'text',
          'text',
          'text',
          'text',
          'jsonb',
          categoryEnum,
          'int',
          'timestamptz',
          statusEnum,
          'boolean',
          reviewEnum,
          indexEnum,
          'boolean',
          'text',
          'timestamptz',
          'timestamptz',
        ]
      : [
          'text',
          'text',
          'text',
          'text',
          'text',
          'jsonb',
          categoryEnum,
          'int',
          'timestamptz',
          statusEnum,
          'boolean',
          reviewEnum,
          indexEnum,
          'boolean',
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
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders} ON CONFLICT (slug) DO NOTHING`,
        values,
      )
      return res.rowCount ?? 0
    }

    const updateColumns = columns.filter((column) => !['slug', 'created_at'].includes(column))
    const res = await pool.query(
      `
        UPDATE ${table} AS d
        SET ${updateColumns.map((column) => `${column} = v.${column}`).join(', ')}
        FROM (
          VALUES ${placeholders}
        ) AS v(${columns.join(', ')})
        WHERE d.slug = v.slug
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
        const singleExisting = existing.has(row.slug as string)
        if (singleExisting) updated += await upsert([row], 'update')
        else created += await upsert([row], 'insert')
      } catch (singleErr) {
        pushError(errors, {
          line: Number(row.__line ?? 0),
          stableId: row.slug as string,
          reason: singleErr instanceof Error ? singleErr.message : reason,
        })
      }
    }
  }

  return { created, updated, failed: errors.length, errors }
}

async function resolveAuthors(pool: pg.Pool, rows: CsvRow[]): Promise<Map<string, number>> {
  const names = Array.from(new Set(rows.map((row) => text(row.author_name ?? row.authorName ?? row.author)).filter(Boolean))) as string[]
  const out = new Map<string, number>()
  if (names.length > 0) {
    const res = await pool.query<{ id: number; full_name: string }>(
      `SELECT id, full_name FROM authors WHERE lower(full_name) = ANY($1::text[])`,
      [names.map((name) => name.toLowerCase())],
    )
    for (const row of res.rows) out.set(row.full_name.toLowerCase(), row.id)
  }

  const editorial = await pool.query<{ id: number }>(
    `
      INSERT INTO authors (full_name, slug, role, bio, article_count, created_at, updated_at)
      VALUES ('injector.world Editorial Team', 'injectors-world-editorial-team', 'Editorial Team', 'The injector.world editorial team.', 0, NOW(), NOW())
      ON CONFLICT (slug) DO UPDATE SET updated_at = NOW()
      RETURNING id
    `,
  )
  out.set('__default__', editorial.rows[0].id)
  return out
}

function contentRow(
  collection: 'news' | 'guides',
  row: CsvRow,
  line: number,
  batch: string,
  authorIds: Map<string, number>,
): { value?: Record<string, unknown>; error?: BulkRowError } {
  const title = text(row.title)
  const slug = text(row.slug) ?? (title ? slugify(title) : null)
  if (!title) return { error: { line, reason: 'Missing title' } }
  if (!slug) return { error: { line, stableId: title, reason: 'Missing slug' } }

  const authorName = text(row.author_name ?? row.authorName ?? row.author)
  const authorId = (authorName ? authorIds.get(authorName.toLowerCase()) : undefined) ?? authorIds.get('__default__')
  if (!authorId) return { error: { line, stableId: slug, reason: 'No author available' } }

  const body = lexicalBody(row.body ?? row.body_text ?? row.content)
  const now = new Date().toISOString()
  const base: Record<string, unknown> = {
    __line: line,
    title,
    slug,
    excerpt: text(row.excerpt) ?? title.slice(0, collection === 'news' ? 298 : 198),
    cover_image_url: text(row.cover_image_url ?? row.coverImageUrl),
    body,
    category: collection === 'news'
      ? normalizeNewsCategory(text(row.category))
      : normalizeGuideCategory(text(row.category)),
    author_id: authorId,
    published_at: null,
    status: 'draft',
    featured: bool(row.featured, false),
    review_status: 'imported',
    index_state: 'noindex',
    nofollow: true,
    import_batch: batch,
    updated_at: now,
    created_at: now,
  }

  if (collection === 'guides') {
    base.lede = text(row.lede) ?? text(row.excerpt) ?? title
  }

  return { value: base }
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

  if (normalized === 'news' || normalized === 'guides') {
    let line = 1
    let sourceBatch: CsvRow[] = []
    let valueBatch: Record<string, unknown>[] = []

    const flush = async () => {
      if (valueBatch.length === 0) return
      const result = await flushContentRows(pool, normalized, valueBatch)
      created += result.created
      updated += result.updated
      failed += result.failed
      for (const error of result.errors) pushError(errors, error)
      valueBatch = []
      sourceBatch = []
    }

    for await (const row of rows) {
      line++
      total++
      sourceBatch.push(row)
      if (sourceBatch.length < size) continue

      const authorIds = await resolveAuthors(pool, sourceBatch)
      for (let i = 0; i < sourceBatch.length; i++) {
        const parsed = contentRow(normalized, sourceBatch[i], line - sourceBatch.length + i + 1, batch, authorIds)
        if (parsed.error) {
          skipped++
          pushError(errors, parsed.error)
          continue
        }
        valueBatch.push(parsed.value!)
      }
      await flush()
    }

    if (sourceBatch.length > 0) {
      const authorIds = await resolveAuthors(pool, sourceBatch)
      for (let i = 0; i < sourceBatch.length; i++) {
        const parsed = contentRow(normalized, sourceBatch[i], line - sourceBatch.length + i + 1, batch, authorIds)
        if (parsed.error) {
          skipped++
          pushError(errors, parsed.error)
          continue
        }
        valueBatch.push(parsed.value!)
      }
      await flush()
    }
  } else {
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
  if (collection === 'reviews') {
    const res = await pool.query<{ id: number; stable_id: string; label: string | null; status: string }>(
      `SELECT id, source_review_id AS stable_id, title AS label, moderation_status::text AS status FROM reviews WHERE import_batch = $1 ORDER BY updated_at DESC LIMIT $2`,
      [batch, limit],
    )
    return res.rows.map((row) => ({ id: row.id, stableId: row.stable_id, label: row.label || row.stable_id, status: row.status }))
  }
  const table = collection
  const res = await pool.query<{ id: number; stable_id: string; label: string; status: string }>(
    `SELECT id, slug AS stable_id, title AS label, status::text FROM ${table} WHERE import_batch = $1 ORDER BY updated_at DESC LIMIT $2`,
    [batch, limit],
  )
  return res.rows.map((row) => ({ id: row.id, stableId: row.stable_id, label: row.label, status: row.status }))
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

  const table = collection
  const statusEnum = collection === 'news' ? 'enum_news_status' : 'enum_guides_status'
  const reviewEnum = collection === 'news' ? 'enum_news_review_status' : 'enum_guides_review_status'
  const approvedBySql = opts.actorUserId ? `, approved_by_id = $${params.length + 1}` : ''
  const sqlParams = opts.actorUserId ? [...params, opts.actorUserId] : params
  const res = await pool.query(
    `
      UPDATE ${table}
      SET status = 'published'::${statusEnum},
          review_status = 'approved'::${reviewEnum},
          published_at = COALESCE(published_at, NOW()),
          approved_at = COALESCE(approved_at, NOW())
          ${approvedBySql},
          updated_at = NOW()
      WHERE ${where}
        AND (status <> 'published' OR review_status <> 'approved')
    `,
    sqlParams,
  )
  return {
    collection,
    batch: opts.batch,
    approved: res.rowCount ?? 0,
    items: opts.batch ? await listUploadItems(pool, collection, opts.batch, 50) : [],
  }
}

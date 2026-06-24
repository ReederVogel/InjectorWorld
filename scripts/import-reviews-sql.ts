/**
 * Fast raw-SQL review importer — streams the CSV line-by-line so it never
 * loads the whole 232k-row file into memory.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/import-reviews-sql.ts
 *   npx tsx --env-file=.env.local scripts/import-reviews-sql.ts --max-per-clinic=20
 *   npx tsx --env-file=.env.local scripts/import-reviews-sql.ts --dry-run
 */

import fs from 'fs'
import path from 'path'
import readline from 'readline'
import pg from 'pg'

const CSV_DEFAULT = path.resolve(
  'C:\\Users\\risha\\Downloads\\injectorworld-export-20260623T183948Z-3-001\\injectorworld-export\\csv\\reviews.csv'
)

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const a = args.find((a) => a.startsWith(`--${flag}=`))
    return a ? a.split('=').slice(1).join('=') : undefined
  }
  return {
    csvPath: get('csv') ?? CSV_DEFAULT,
    maxPerClinic: parseInt(get('max-per-clinic') ?? '15', 10),
    batchSize: parseInt(get('batch-size') ?? '500', 10),
    dryRun: args.includes('--dry-run'),
    importBatch: get('batch') ?? 'juvederm-gmaps-2026-06',
  }
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if (ch === ',' && !inQ) {
      result.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur)
  return result
}

const VALID_PLATFORMS = new Set(['google', 'yelp', 'healthgrades', 'vitals', 'zocdoc', 'clinic_site', 'injectors_world'])

async function flushBatch(pool: pg.Pool, batch: Record<string, unknown>[], dryRun: boolean): Promise<number> {
  if (!batch.length) return 0
  if (dryRun) return batch.length

  const cols = ['review_id','clinic_id','reviewer_first_name','reviewer_initial','reviewer_city',
    'rating','review_title','review_text','treatment_tag','source_platform','source_url',
    'response_from_provider','verified','featured','moderation_status','import_batch',
    'updated_at','created_at']

  const placeholders = batch.map((_, bi) =>
    `(${cols.map((_, ci) => `$${bi * cols.length + ci + 1}`).join(',')})`
  ).join(',')

  const values: unknown[] = []
  for (const r of batch) {
    for (const col of cols) values.push(r[col] ?? null)
  }

  const res = await pool.query(
    `INSERT INTO reviews (${cols.join(',')}) VALUES ${placeholders}
     ON CONFLICT (review_id) DO NOTHING`,
    values
  )
  return res.rowCount ?? 0
}

async function main() {
  const opts = parseArgs()
  console.log(`\n===== Fast SQL Review Import =====`)
  console.log(`CSV:           ${opts.csvPath}`)
  console.log(`Max/clinic:    ${opts.maxPerClinic}`)
  console.log(`Batch size:    ${opts.batchSize}`)
  console.log(`Dry run:       ${opts.dryRun}\n`)

  if (!fs.existsSync(opts.csvPath)) {
    console.error(`CSV not found: ${opts.csvPath}`)
    process.exit(1)
  }

  const uri = process.env.DATABASE_URI ?? ''
  const isRemote = uri && !/@(localhost|127\.0\.0\.1)[:/]/.test(uri)
  const ssl = isRemote
    ? process.env.DB_SSL_NO_VERIFY === 'true'
      ? { rejectUnauthorized: false }
      : process.env.DB_SSL_CA
        ? { rejectUnauthorized: true, ca: process.env.DB_SSL_CA }
        : { rejectUnauthorized: true }
    : false
  const pool = new pg.Pool({ connectionString: uri, ssl: ssl as any })

  // Load clinic map: clinicId → DB id (fast single query).
  const clinicRes = await pool.query<{ clinic_id: string; id: number }>('SELECT clinic_id, id FROM clinics')
  const clinicMap: Record<string, number> = {}
  for (const row of clinicRes.rows) clinicMap[row.clinic_id] = row.id
  console.log(`Loaded ${clinicRes.rowCount} clinics.`)

  // Load existing review IDs to skip duplicates.
  const existingRes = await pool.query<{ review_id: string }>('SELECT review_id FROM reviews')
  const existingIds = new Set(existingRes.rows.map((r) => r.review_id))
  console.log(`Found ${existingIds.size} existing reviews (will skip).\n`)

  let headers: string[] = []
  let inserted = 0
  let skipped = 0
  const perClinic: Record<string, number> = {}
  let batch: Record<string, unknown>[] = []
  const now = new Date().toISOString()

  const rl = readline.createInterface({
    input: fs.createReadStream(opts.csvPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })

  for await (const line of rl) {
    if (!line.trim()) continue

    if (!headers.length) {
      headers = parseCsvLine(line)
      continue
    }

    const vals = parseCsvLine(line)
    const r: Record<string, string> = Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))

    const reviewId = r.review_id?.trim()
    const clinicId = r.clinic_id?.trim()
    if (!reviewId || !clinicId) { skipped++; continue }
    if (existingIds.has(reviewId)) { skipped++; continue }

    perClinic[clinicId] = perClinic[clinicId] ?? 0
    if (perClinic[clinicId] >= opts.maxPerClinic) { skipped++; continue }

    const clinicDbId = clinicMap[clinicId]
    if (!clinicDbId) { skipped++; continue }

    const rating = parseFloat(r.rating)
    if (isNaN(rating) || rating < 1 || rating > 5) { skipped++; continue }

    const reviewText = r.review_text?.trim() || r.review_excerpt?.trim()
    if (!reviewText) { skipped++; continue }

    const platform = r.source_platform?.trim().toLowerCase()
    if (!VALID_PLATFORMS.has(platform)) { skipped++; continue }

    batch.push({
      review_id: reviewId,
      clinic_id: clinicDbId,
      reviewer_first_name: r.reviewer_first_name?.trim() || null,
      reviewer_initial: r.reviewer_initial?.trim()?.slice(0, 2) || null,
      reviewer_city: r.reviewer_city?.trim() || null,
      rating,
      review_title: r.review_title?.trim() || null,
      review_text: reviewText,
      treatment_tag: r.treatment_tag?.trim() || null,
      source_platform: platform,
      source_url: r.source_url?.trim() || null,
      response_from_provider: r.response_from_provider?.trim() || null,
      verified: Boolean(r.source_url?.trim()),
      featured: false,
      moderation_status: 'pending',
      import_batch: opts.importBatch,
      updated_at: now,
      created_at: now,
    })

    perClinic[clinicId]++

    if (batch.length >= opts.batchSize) {
      const n = await flushBatch(pool, batch, opts.dryRun)
      inserted += n
      batch = []
      process.stdout.write(`\r  Inserted: ${inserted.toLocaleString()} / Skipped: ${skipped.toLocaleString()}    `)
    }
  }

  const n = await flushBatch(pool, batch, opts.dryRun)
  inserted += n

  console.log(`\n\nDone.`)
  console.log(`  Inserted: ${inserted.toLocaleString()}`)
  console.log(`  Skipped:  ${skipped.toLocaleString()}`)
  if (opts.dryRun) console.log(`  (Dry run — nothing written)`)

  await pool.end()
}

main().catch((e) => { console.error(e); process.exit(1) })

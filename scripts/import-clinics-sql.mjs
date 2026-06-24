/**
 * Fast raw-SQL clinic importer — batch inserts directly, no Payload overhead.
 * Resolves "CA 93010"-style city fields from the seeded zip_codes table.
 *
 * Usage:
 *   node scripts/import-clinics-sql.mjs
 *   node scripts/import-clinics-sql.mjs --dry-run
 */

import fs from 'fs'
import path from 'path'
import readline from 'readline'
import pg from 'pg'

const CSV_DEFAULT = 'C:\\Users\\risha\\Downloads\\injectorworld-export-20260623T183948Z-3-001\\injectorworld-export\\csv\\clinics.csv'
const BATCH_SIZE = 200
const IMPORT_BATCH = 'juvederm-gmaps-2026-06'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const csvPath = args.find(a => a.startsWith('--csv='))?.slice(6) ?? CSV_DEFAULT

function parseCsvLine(line) {
  const result = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if (ch === ',' && !inQ) {
      result.push(cur); cur = ''
    } else cur += ch
  }
  result.push(cur)
  return result
}

function normalizeClinicType(raw) {
  const s = (raw ?? '').toLowerCase().replace(/[^a-z ]/g, '').trim()
  if (!s || s === 'other') return 'other'
  if (s.includes('plastic') || s.includes('cosmetic surgery') || s.includes('facial plastic')) return 'plastic-surgery'
  if (s.includes('derm')) return 'dermatology'
  if (s.includes('dental') || s.includes('dds')) return 'dental-aesthetics'
  if (s.includes('med spa') || s.includes('medspa') || s.includes('medical spa') ||
      s.includes('spa') || s.includes('wellness') || s.includes('aesthetic') ||
      s.includes('beauty') || s.includes('rejuven') || s.includes('skin') ||
      s.includes('laser')) return 'medspa'
  return 'other'
}

function resolveStatus(row) {
  const pub = (row.publish_status ?? '').toLowerCase()
  if (pub === 'published') return 'published'
  if (pub === 'review') return 'review'
  return 'published'  // default to published for demo
}

function safeJson(str) {
  if (!str || !str.trim()) return null
  try { return JSON.stringify(JSON.parse(str)) } catch { return null }
}

async function flushBatch(pool, batch, dryRun) {
  if (!batch.length) return 0
  if (dryRun) return batch.length

  const cols = [
    'clinic_id', 'slug', 'clinic_name', 'clinic_type', 'description',
    'address_line1', 'address_line2', 'city', 'state', 'zip',
    'neighborhood', 'county', 'country',
    'latitude', 'longitude',
    'google_place_id', 'google_maps_url', 'directions_url',
    'phone', 'email', 'website_url', 'booking_url',
    'instagram_url', 'tiktok_url', 'facebook_url',
    'hours_json', 'service_type',
    'aggregate_rating', 'aggregate_rating_count',
    'data_confidence', 'needs_manual_review',
    'status', 'import_batch',
    'updated_at', 'created_at',
  ]

  const placeholders = batch.map((_, bi) =>
    `(${cols.map((_, ci) => `$${bi * cols.length + ci + 1}`).join(',')})`
  ).join(',')

  const values = []
  for (const r of batch) {
    for (const col of cols) values.push(r[col] ?? null)
  }

  // ON CONFLICT: update key fields, skip status if already published
  const updateCols = cols.filter(c => !['clinic_id', 'created_at'].includes(c))
  const updateExpr = updateCols.map(c => `${c} = EXCLUDED.${c}`).join(', ')

  const res = await pool.query(
    `INSERT INTO clinics (${cols.join(',')}) VALUES ${placeholders}
     ON CONFLICT (clinic_id) DO UPDATE SET ${updateExpr}`,
    values
  )
  return res.rowCount ?? 0
}

async function main() {
  console.log(`\n===== Fast SQL Clinic Import =====`)
  console.log(`CSV:      ${csvPath}`)
  console.log(`Dry run:  ${dryRun}\n`)

  if (!fs.existsSync(csvPath)) { console.error(`CSV not found: ${csvPath}`); process.exit(1) }

  const uri = process.env.DATABASE_URI ?? ''
  const isRemote = uri && !/@(localhost|127\.0\.0\.1)[:/]/.test(uri)
  const ssl = isRemote
    ? process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0'
      ? { rejectUnauthorized: false }
      : true
    : false
  const pool = new pg.Pool({ connectionString: uri, ssl })

  // Load ZIP → city from zip_codes table
  console.log('Loading ZIP codes...')
  const zipRes = await pool.query('SELECT zip, city FROM zip_codes')
  const zipToCity = {}
  for (const row of zipRes.rows) zipToCity[row.zip] = row.city
  console.log(`  Loaded ${zipRes.rowCount} ZIP codes.\n`)

  let headers = []
  let inserted = 0, skipped = 0
  let batch = []
  const now = new Date().toISOString()
  const seen = new Set()

  const rl = readline.createInterface({
    input: fs.createReadStream(csvPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })

  for await (const line of rl) {
    if (!line.trim()) continue
    if (!headers.length) { headers = parseCsvLine(line); continue }

    const vals = parseCsvLine(line)
    const r = Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))

    const clinicId = r.clinic_id?.trim()
    const clinicName = r.clinic_name?.trim()
    if (!clinicId || !clinicName) { skipped++; continue }
    if (seen.has(clinicId)) { skipped++; continue }
    seen.add(clinicId)

    const lat = parseFloat(r.latitude)
    const lng = parseFloat(r.longitude)
    if (isNaN(lat) || isNaN(lng)) { skipped++; continue }

    // Resolve city: "CA 93010" → ZIP lookup → real city name
    const rawCity = r.city?.trim() ?? ''
    const zip5 = (r.zip ?? '').replace(/[^0-9]/g, '').slice(0, 5)
    const city = /^[A-Z]{2}\s+\d{5}$/.test(rawCity)
      ? (zipToCity[zip5] ?? rawCity)
      : rawCity
    const state = r.state?.trim() ?? ''
    const zip = r.zip?.trim() ?? ''

    // Slugify clinic name if slug missing
    const slug = r.slug?.trim() || clinicName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    const rating = parseFloat(r.aggregate_rating)
    const ratingCount = parseInt(r.aggregate_rating_count, 10)

    batch.push({
      clinic_id: clinicId,
      slug,
      clinic_name: clinicName,
      clinic_type: normalizeClinicType(r.clinic_type),
      description: r.description?.trim() || null,
      address_line1: r.address_line_1?.trim() || '-',
      address_line2: r.address_line_2?.trim() || null,
      city: city || '-',
      state: state || '-',
      zip: zip || '00000',
      neighborhood: r.neighborhood?.trim() || null,
      county: r.county?.trim() || null,
      country: r.country?.trim() || 'US',
      latitude: lat,
      longitude: lng,
      google_place_id: r.google_place_id?.trim() || null,
      google_maps_url: r.google_maps_url?.trim() || null,
      directions_url: r.directions_url?.trim() || null,
      phone: r.phone?.trim() || null,
      email: r.email?.trim() || null,
      website_url: r.website_url?.trim() || null,
      booking_url: r.booking_url?.trim() || null,
      instagram_url: r.instagram_url?.trim() || null,
      tiktok_url: r.tiktok_url?.trim() || null,
      facebook_url: r.facebook_url?.trim() || null,
      hours_json: safeJson(r.hours_json),
      service_type: r.service_type?.trim() || 'In-Person',
      aggregate_rating: isNaN(rating) ? null : rating,
      aggregate_rating_count: isNaN(ratingCount) ? null : ratingCount,
      data_confidence: parseFloat(r.data_confidence) || null,
      needs_manual_review: r.needs_manual_review?.trim().toLowerCase() === 'true',
      status: resolveStatus(r),
      import_batch: IMPORT_BATCH,
      updated_at: now,
      created_at: now,
    })

    if (batch.length >= BATCH_SIZE) {
      const n = await flushBatch(pool, batch, dryRun)
      inserted += n
      batch = []
      process.stdout.write(`\r  Upserted: ${inserted.toLocaleString()} / Skipped: ${skipped.toLocaleString()}    `)
    }
  }

  const n = await flushBatch(pool, batch, dryRun)
  inserted += n

  console.log(`\n\nDone.`)
  console.log(`  Upserted: ${inserted.toLocaleString()}`)
  console.log(`  Skipped:  ${skipped.toLocaleString()}`)
  if (dryRun) console.log('  (Dry run — nothing written)')

  // Verify
  const verify = await pool.query('SELECT COUNT(*) AS n FROM clinics')
  console.log(`\n  Total clinics in DB: ${verify.rows[0].n}`)

  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })

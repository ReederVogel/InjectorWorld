/**
 * Targeted DO clinic wipe — removes clinics and their dependent rows.
 * Preserves: news, guides, locations, treatments, zip_codes, users.
 *
 * Usage:
 *   DATABASE_URI=<do-uri> NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/wipe-clinics-do.mjs
 */

import pg from 'pg'
const { Client } = pg

const URI = process.env.DATABASE_URI
if (!URI) { console.error('DATABASE_URI not set'); process.exit(1) }

const c = new Client({ connectionString: URI, ssl: { rejectUnauthorized: false } })
await c.connect()

console.log('\n===== Wiping DO clinics (targeted) =====\n')

// Count first
const counts = await c.query(`
  SELECT 'clinics'     AS t, COUNT(*) AS n FROM clinics
  UNION ALL SELECT 'reviews',      COUNT(*) FROM reviews
  UNION ALL SELECT 'photos',       COUNT(*) FROM photos
  UNION ALL SELECT 'before_after_cases', COUNT(*) FROM before_after_cases
  UNION ALL SELECT 'providers',    COUNT(*) FROM providers
  UNION ALL SELECT 'data_alerts',  COUNT(*) FROM data_alerts
  UNION ALL SELECT 'promotions',   COUNT(*) FROM promotions
`)
console.log('Current counts:')
counts.rows.forEach(r => console.log(`  ${r.t.padEnd(22)} ${r.n}`))

// Delete in FK-safe order
const steps = [
  // FK deps of clinics must go first
  ['reviews',             'DELETE FROM reviews'],
  ['photos',              'DELETE FROM photos WHERE clinic_id IS NOT NULL'],
  ['before_after_cases',  'DELETE FROM before_after_cases'],
  ['data_alerts',         'DELETE FROM data_alerts'],
  ['promotions',          'DELETE FROM promotions'],
  ['providers',           'DELETE FROM providers'],
  ['clinics',             'DELETE FROM clinics'],
]

console.log('\nDeleting...')
for (const [label, sql] of steps) {
  try {
    const res = await c.query(sql)
    console.log(`  ${label.padEnd(22)} deleted ${(res.rowCount ?? 0).toLocaleString()} rows`)
  } catch (err) {
    console.error(`  ${label}: ERROR — ${err.message}`)
  }
}

// Verify
console.log('\nVerifying:')
const verify = await c.query(`
  SELECT 'clinics'    AS t, COUNT(*) AS n FROM clinics
  UNION ALL SELECT 'reviews',     COUNT(*) FROM reviews
  UNION ALL SELECT 'providers',   COUNT(*) FROM providers
  UNION ALL SELECT 'news',        COUNT(*) FROM news
  UNION ALL SELECT 'guides',      COUNT(*) FROM guides
  UNION ALL SELECT 'locations',   COUNT(*) FROM locations
  UNION ALL SELECT 'zip_codes',   COUNT(*) FROM zip_codes
`)
verify.rows.forEach(r => console.log(`  ${r.t.padEnd(14)} ${r.n}`))

await c.end()
console.log('\n===== Done =====\n')

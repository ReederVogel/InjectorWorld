/**
 * fix-clinic-locations-from-zip.mjs
 * Backfill city, state, lat, lng from zip_codes table for clinics with bad data.
 * Targets: NULL/empty city, NULL/empty state, ALL CAPS city, city starting with digit.
 *
 * Usage:
 *   node scripts/fix-clinic-locations-from-zip.mjs           # dry-run (safe)
 *   node scripts/fix-clinic-locations-from-zip.mjs --apply   # apply changes
 */
import pg from 'pg'

const { Pool } = pg
const DRY_RUN = !process.argv.includes('--apply')
const pool = new Pool({
  connectionString: process.env.DATABASE_URI || 'postgres://postgres:admin@localhost:5432/injectors_world_dev',
  ssl: process.env.DB_SSL_CA ? { ca: Buffer.from(process.env.DB_SSL_CA, 'base64').toString() } : false,
})

async function main() {
  console.log(`\n── fix-clinic-locations-from-zip (${DRY_RUN ? 'DRY RUN' : 'APPLY'}) ──\n`)

  // Find clinics that need fixing
  const affected = await pool.query(`
    SELECT
      c.id,
      c.clinic_name,
      c.city        AS old_city,
      c.state       AS old_state,
      c.latitude    AS old_lat,
      c.longitude   AS old_lng,
      c.zip,
      z.city        AS new_city,
      z.state       AS new_state,
      z.lat         AS new_lat,
      z.lng         AS new_lng
    FROM clinics c
    JOIN zip_codes z ON c.zip = z.zip
    WHERE
      c.city IS NULL OR c.city = ''
      OR c.state IS NULL OR c.state = '' OR LENGTH(c.state) != 2
      OR c.city ~ '^\\d+'
      OR c.city = UPPER(c.city)
    ORDER BY c.id
  `)

  const rows = affected.rows
  console.log(`Clinics that need location fix: ${rows.length}`)

  if (rows.length === 0) {
    console.log('Nothing to fix.')
    await pool.end()
    return
  }

  // Sample preview
  console.log('\nSample (first 10):')
  rows.slice(0, 10).forEach(r => {
    const cityChange = r.old_city !== r.new_city ? `city: "${r.old_city}" → "${r.new_city}"` : ''
    const stateChange = r.old_state !== r.new_state ? `state: "${r.old_state}" → "${r.new_state}"` : ''
    console.log(`  [${r.id}] ${r.clinic_name.substring(0, 40).padEnd(40)}  ${[cityChange, stateChange].filter(Boolean).join('  ') || '(lat/lng only)'}`)
  })

  if (DRY_RUN) {
    console.log(`\nDRY RUN complete. Run with --apply to execute.`)
    await pool.end()
    return
  }

  // Apply
  const res = await pool.query(`
    UPDATE clinics c
    SET
      city      = z.city,
      state     = z.state,
      latitude  = CASE WHEN c.latitude IS NULL OR c.latitude = 0 THEN z.lat ELSE c.latitude END,
      longitude = CASE WHEN c.longitude IS NULL OR c.longitude = 0 THEN z.lng ELSE c.longitude END,
      updated_at = NOW()
    FROM zip_codes z
    WHERE c.zip = z.zip
      AND (
        c.city IS NULL OR c.city = ''
        OR c.state IS NULL OR c.state = '' OR LENGTH(c.state) != 2
        OR c.city ~ '^\\d+'
        OR c.city = UPPER(c.city)
      )
  `)

  console.log(`\nUpdated ${res.rowCount} clinics.`)
  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })

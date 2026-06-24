/**
 * cleanup-zip-locations.mjs
 * Deletes fake "metro" locations that were auto-created from ZIP codes
 * (names like "CA 90004" or "90004").
 *
 * Usage:
 *   node scripts/cleanup-zip-locations.mjs           # dry-run (safe)
 *   node scripts/cleanup-zip-locations.mjs --apply   # apply changes
 */
import pg from 'pg'

const { Pool } = pg
const DRY_RUN = !process.argv.includes('--apply')
const pool = new Pool({
  connectionString: process.env.DATABASE_URI || 'postgres://postgres:admin@localhost:5432/injectors_world_dev',
  ssl: process.env.DB_SSL_CA ? { ca: Buffer.from(process.env.DB_SSL_CA, 'base64').toString() } : false,
})

async function main() {
  console.log(`\n── cleanup-zip-locations (${DRY_RUN ? 'DRY RUN' : 'APPLY'}) ──\n`)

  const rows = await pool.query(`
    SELECT id, slug, name, state, is_live, noindex
    FROM locations
    WHERE kind IN ('metro', 'city')
      AND (name ~ '^[A-Z]{2}\\s+\\d+' OR name ~ '^\\d{5}$')
    ORDER BY name
  `)

  console.log(`ZIP-only fake locations found: ${rows.rows.length}`)
  rows.rows.forEach(r =>
    console.log(`  [${r.id}] slug="${r.slug}"  name="${r.name}"  state=${r.state}  isLive=${r.is_live}  noindex=${r.noindex}`)
  )

  if (rows.rows.length === 0) {
    console.log('Nothing to delete.')
    await pool.end()
    return
  }

  if (DRY_RUN) {
    console.log(`\nDRY RUN complete. Run with --apply to execute.`)
    await pool.end()
    return
  }

  const ids = rows.rows.map(r => r.id)

  // First set isLive=false + noindex=true so they drop out of sitemap immediately
  await pool.query(
    `UPDATE locations SET is_live = false, noindex = true, updated_at = NOW() WHERE id = ANY($1)`,
    [ids]
  )

  // Then delete
  const del = await pool.query(
    `DELETE FROM locations WHERE id = ANY($1)`,
    [ids]
  )
  console.log(`\nDeleted ${del.rowCount} ZIP-only fake locations.`)

  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })

/**
 * migrate-city-slugs-production.mjs
 * Strips the 2-letter state suffix from city/metro location slugs.
 * e.g.  houston-tx  →  houston
 *       irvine-ca   →  irvine
 *       miami-beach-fl → miami-beach
 *
 * Skips:
 *   - washington-dc  (intentional suffix, not a state code)
 *   - slugs that would collide with an existing slug after stripping
 *
 * Usage:
 *   node scripts/migrate-city-slugs-production.mjs           # dry-run (safe)
 *   node scripts/migrate-city-slugs-production.mjs --apply   # apply changes
 */
import pg from 'pg'

const { Pool } = pg
const DRY_RUN = !process.argv.includes('--apply')
const pool = new Pool({
  connectionString: process.env.DATABASE_URI || 'postgres://postgres:admin@localhost:5432/injectors_world_dev',
  ssl: process.env.DB_SSL_CA ? { ca: Buffer.from(process.env.DB_SSL_CA, 'base64').toString() } : false,
})

// Slugs to skip (have -xx suffix for valid non-state reasons)
const SKIP_SLUGS = new Set(['washington-dc'])

async function main() {
  console.log(`\n── migrate-city-slugs-production (${DRY_RUN ? 'DRY RUN' : 'APPLY'}) ──\n`)

  // Find all city/metro slugs ending with -XX (2 lowercase letters)
  const rows = await pool.query(`
    SELECT id, slug, name, state
    FROM locations
    WHERE kind IN ('metro', 'city')
      AND slug ~ '-[a-z]{2}$'
    ORDER BY slug
  `)

  // Build candidate list
  const candidates = []
  for (const row of rows.rows) {
    if (SKIP_SLUGS.has(row.slug)) continue
    const newSlug = row.slug.replace(/-[a-z]{2}$/, '')
    candidates.push({ ...row, newSlug })
  }

  console.log(`Locations with old state-suffix slug: ${candidates.length}`)

  // Check for collisions (would the new slug already exist?)
  const allSlugs = await pool.query(`SELECT slug FROM locations WHERE kind IN ('metro','city','state','neighborhood')`)
  const existingSet = new Set(allSlugs.rows.map(r => r.slug))

  const safe = []
  const collisions = []
  for (const c of candidates) {
    if (existingSet.has(c.newSlug) && c.newSlug !== c.slug) {
      collisions.push(c)
    } else {
      safe.push(c)
    }
  }

  console.log(`  Safe to rename: ${safe.length}`)
  console.log(`  Collisions (skip): ${collisions.length}`)

  if (collisions.length > 0) {
    console.log('\nCollisions (these will NOT be renamed):')
    collisions.forEach(c => console.log(`  "${c.slug}" → "${c.newSlug}" (already exists)`))
  }

  console.log('\nSample renames (first 20):')
  safe.slice(0, 20).forEach(c => console.log(`  "${c.slug}" → "${c.newSlug}"`))

  if (DRY_RUN) {
    console.log(`\nDRY RUN complete. Run with --apply to execute.`)
    await pool.end()
    return
  }

  // Apply renames one by one (slug has a UNIQUE constraint)
  let renamed = 0
  let errors = 0
  for (const c of safe) {
    try {
      await pool.query(
        `UPDATE locations SET slug = $1, updated_at = NOW() WHERE id = $2`,
        [c.newSlug, c.id]
      )
      renamed++
    } catch (err) {
      console.error(`  ERROR renaming [${c.id}] "${c.slug}" → "${c.newSlug}": ${err.message}`)
      errors++
    }
  }

  console.log(`\nRenamed ${renamed} slugs. Errors: ${errors}.`)
  if (collisions.length > 0) {
    console.log(`Skipped ${collisions.length} collisions — review manually.`)
  }

  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })

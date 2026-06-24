/**
 * Remove fake seed clinics from the DO DB.
 * Real imports have import_batch LIKE 'juvederm%'.
 * Seed / demo rows have NULL or a different import_batch.
 *
 * Run:
 *   $env:DATABASE_URI="postgresql://doadmin:...@...do-user...f.db.ondigitalocean.com:25060/defaultdb?sslmode=require"
 *   $env:NODE_TLS_REJECT_UNAUTHORIZED="0"
 *   node scripts/clean-seed-clinics.mjs
 *
 * Pass --dry-run to see what would be deleted without touching the DB.
 */

import pg from 'pg'
const { Client } = pg

const DRY_RUN = process.argv.includes('--dry-run')

const c = new Client({
  connectionString: process.env.DATABASE_URI,
  ssl: { rejectUnauthorized: false },
})

await c.connect()
console.log(`\n===== Clean seed clinics (${DRY_RUN ? 'DRY RUN' : 'LIVE'}) =====\n`)

// ── Audit: show what would be removed ────────────────────────────────────────
const auditRes = await c.query(`
  SELECT id, clinic_name, import_batch, created_at
  FROM clinics
  WHERE import_batch IS NULL OR import_batch NOT LIKE 'juvederm%'
  ORDER BY created_at
  LIMIT 40
`)

if (auditRes.rows.length === 0) {
  console.log('No fake/seed clinics found. Nothing to do.')
  await c.end()
  process.exit(0)
}

console.log(`Found ${auditRes.rows.length} fake/seed clinics (showing up to 40):`)
for (const r of auditRes.rows) {
  console.log(`  [${String(r.id).padStart(4)}] ${(r.clinic_name ?? '(null)').padEnd(40)} import_batch=${r.import_batch ?? 'NULL'}`)
}

// ── Count reviews that would be cascade-deleted ───────────────────────────────
const fakeIds = auditRes.rows.map((r) => r.id)
const reviewCount = await c.query(
  `SELECT COUNT(*) AS n FROM reviews WHERE clinic_id = ANY($1::int[])`,
  [fakeIds],
)
console.log(`\nAssociated reviews to delete: ${reviewCount.rows[0].n}`)

if (DRY_RUN) {
  console.log('\n[DRY RUN] No changes made. Remove --dry-run to execute.\n')
  await c.end()
  process.exit(0)
}

// ── Execute deletions ─────────────────────────────────────────────────────────
console.log('\nDeleting reviews...')
const revDel = await c.query(
  `DELETE FROM reviews WHERE clinic_id = ANY($1::int[])`,
  [fakeIds],
)
console.log(`  Deleted ${revDel.rowCount} reviews.`)

console.log('Deleting clinics...')
const clinicDel = await c.query(
  `DELETE FROM clinics WHERE import_batch IS NULL OR import_batch NOT LIKE 'juvederm%'`,
)
console.log(`  Deleted ${clinicDel.rowCount} clinics.`)

// ── Final counts ──────────────────────────────────────────────────────────────
console.log('\n===== Remaining counts =====')
const counts = await c.query(`
  SELECT 'clinics' AS tbl, COUNT(*) AS n FROM clinics
  UNION ALL SELECT 'reviews', COUNT(*) FROM reviews
`)
counts.rows.forEach((r) => console.log(`  ${r.tbl.padEnd(14)} ${r.n}`))

await c.end()
console.log('\n===== Done =====\n')

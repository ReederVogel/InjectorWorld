/**
 * One-off fix: drop the manually-created clinics_languages table + sequence
 * so that Drizzle (db:push) can recreate them correctly with proper serial type.
 *
 * Run with production DATABASE_URI:
 *   DATABASE_URI="postgres://..." npx tsx scripts/fix-prod-clinics-languages.ts
 */

const DATABASE_URI = process.env.DATABASE_URI

if (!DATABASE_URI) {
  console.error('ERROR: DATABASE_URI env var is required.')
  console.error('Usage: DATABASE_URI="postgres://..." npx tsx scripts/fix-prod-clinics-languages.ts')
  process.exit(1)
}

if (DATABASE_URI.includes('localhost')) {
  console.error('ERROR: This looks like the local DB. Pass the production DATABASE_URI.')
  process.exit(1)
}

async function run() {
  const { default: pg } = await import('pg')
  const uri = DATABASE_URI!.replace(/[?&]ssl[^&]*/gi, '')
  const pool = new pg.Pool({ connectionString: uri, ssl: { rejectUnauthorized: false } })

  console.log('[fix] Connecting to production DB...')

  await pool.query('DROP TABLE IF EXISTS clinics_languages;')
  console.log('[fix] ✓ Dropped clinics_languages table')

  await pool.query('DROP SEQUENCE IF EXISTS clinics_languages_id_seq;')
  console.log('[fix] ✓ Dropped clinics_languages_id_seq sequence')

  await pool.end()
  console.log('[fix] Done. Now redeploy — Drizzle will recreate the table correctly.')
}

run().catch((err) => {
  console.error('[fix] Fatal:', err)
  process.exit(1)
})

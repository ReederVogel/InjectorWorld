/**
 * delete-seed-providers.mjs
 * Permanently deletes all mock seed providers (Dr. Lena Park etc.) from the DB.
 * Also deletes their linked seed clinics if no real data is attached.
 *
 * Usage:
 *   node scripts/delete-seed-providers.mjs           # dry-run (safe)
 *   node scripts/delete-seed-providers.mjs --apply   # apply changes
 */
import pg from 'pg'

const { Pool } = pg
const DRY_RUN = !process.argv.includes('--apply')
const pool = new Pool({
  connectionString: process.env.DATABASE_URI || 'postgres://postgres:admin@localhost:5432/injectors_world_dev',
  ssl: process.env.DB_SSL_CA ? { ca: Buffer.from(process.env.DB_SSL_CA, 'base64').toString() } : false,
})

const SEED_PROVIDER_SLUGS = [
  'lena-park-md-nyc',
  'daniel-cho-md-nyc',
  'sofia-reyes-np-nyc',
  'rachel-goldman-md-nyc',
  'omar-haddad-md-nyc',
  'maya-singh-np-nyc',
  'jenna-wu-pa-nyc',
  'elena-mosconi-md-nyc',
  'marcus-hill-md-la',
  'hailey-brennan-rn-la',
  'aisha-bello-md-mia',
  'lucas-almeida-pa-mia',
  'james-whitaker-do-chi',
  'mia-petrova-np-chi',
  'priya-shah-md-sf',
]

// Seed clinic names + IDs (must match BOTH to be safe — CSV import reused some IDs)
const SEED_CLINICS = [
  { id: 'clinic-nyc-00001', name: 'Park Avenue Aesthetics' },
  { id: 'clinic-la-00001',  name: 'Rodeo Drive Dermatology' },
  { id: 'clinic-mia-00001', name: 'Brickell Aesthetic Medicine' },
  { id: 'clinic-chi-00001', name: 'River North Skin' },
  { id: 'clinic-sf-00001',  name: 'Pacific Heights Dermatology' },
]

async function main() {
  console.log(`\n── delete-seed-providers (${DRY_RUN ? 'DRY RUN' : 'APPLY'}) ──\n`)

  const providers = await pool.query(
    `SELECT id, slug, full_name FROM providers WHERE slug = ANY($1) ORDER BY slug`,
    [SEED_PROVIDER_SLUGS]
  )
  console.log(`Seed providers found: ${providers.rows.length}`)
  providers.rows.forEach(r => console.log(`  [${r.id}] ${r.slug}  ${r.full_name}`))

  // Match BOTH clinic_id AND name — CSV import reused some seed clinic_ids with real data
  const clinicRows = []
  for (const s of SEED_CLINICS) {
    const res = await pool.query(
      `SELECT id, clinic_id, clinic_name FROM clinics WHERE clinic_id = $1 AND clinic_name = $2`,
      [s.id, s.name]
    )
    clinicRows.push(...res.rows)
  }
  console.log(`\nSeed clinics found (id + name match): ${clinicRows.length}`)
  clinicRows.forEach(r => console.log(`  [${r.id}] ${r.clinic_id}  ${r.clinic_name}`))

  if (providers.rows.length === 0 && clinicRows.length === 0) {
    console.log('\nNothing to delete. Already clean.')
    await pool.end()
    return
  }

  if (DRY_RUN) {
    console.log(`\nDRY RUN complete. Run with --apply to execute.`)
    await pool.end()
    return
  }

  // Delete providers first (FK references clinics)
  if (providers.rows.length > 0) {
    const res = await pool.query(
      `DELETE FROM providers WHERE slug = ANY($1)`,
      [SEED_PROVIDER_SLUGS]
    )
    console.log(`\nDeleted ${res.rowCount} seed providers.`)
  }

  // Delete seed clinics (only exact id+name matches)
  if (clinicRows.length > 0) {
    const ids = clinicRows.map(r => r.id)
    const res = await pool.query(`DELETE FROM clinics WHERE id = ANY($1)`, [ids])
    console.log(`Deleted ${res.rowCount} seed clinics.`)
  }

  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })

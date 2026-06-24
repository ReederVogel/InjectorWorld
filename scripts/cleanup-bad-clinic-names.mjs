/**
 * cleanup-bad-clinic-names.mjs
 * Marks clinics with street-address names as status='review' (hidden from public).
 * Also title-cases ALL CAPS clinic names.
 *
 * Usage:
 *   node scripts/cleanup-bad-clinic-names.mjs           # dry-run (safe)
 *   node scripts/cleanup-bad-clinic-names.mjs --apply   # apply changes
 */
import pg from 'pg'

const { Pool } = pg
const DRY_RUN = !process.argv.includes('--apply')
const pool = new Pool({
  connectionString: process.env.DATABASE_URI || 'postgres://postgres:admin@localhost:5432/injectors_world_dev',
  ssl: process.env.DB_SSL_CA ? { ca: Buffer.from(process.env.DB_SSL_CA, 'base64').toString() } : false,
})

// Abbreviations to keep fully uppercase after title-casing
const KEEP_UPPER = new Set(['MD', 'DO', 'NP', 'PA', 'RN', 'DMD', 'DDS', 'DPM', 'OD', 'LLC', 'PLLC', 'PC', 'IV', 'II', 'III'])

function toTitleCase(str) {
  return str
    .toLowerCase()
    .replace(/\b\w+/g, word => {
      const upper = word.toUpperCase()
      return KEEP_UPPER.has(upper) ? upper : word.charAt(0).toUpperCase() + word.slice(1)
    })
}

async function main() {
  console.log(`\n── cleanup-bad-clinic-names (${DRY_RUN ? 'DRY RUN' : 'APPLY'}) ──\n`)

  // 1. Street-address names (starts with digit + space + capital)
  const streetAddr = await pool.query(`
    SELECT id, clinic_name, status
    FROM clinics
    WHERE clinic_name ~ '^\\d+\\s+[A-Z0-9]'
    ORDER BY id
  `)
  console.log(`Street-address clinic names → mark as 'review': ${streetAddr.rows.length}`)
  streetAddr.rows.slice(0, 15).forEach(r =>
    console.log(`  [${r.id}] (${r.status}) "${r.clinic_name}"`)
  )

  // 2. ALL CAPS clinic names (more than 3 chars, all uppercase)
  const allCaps = await pool.query(`
    SELECT id, clinic_name
    FROM clinics
    WHERE clinic_name = UPPER(clinic_name) AND LENGTH(clinic_name) > 3
      AND clinic_name !~ '^\\d+'
    ORDER BY id
  `)
  console.log(`\nALL CAPS clinic names → title-case: ${allCaps.rows.length}`)
  allCaps.rows.slice(0, 15).forEach(r =>
    console.log(`  [${r.id}] "${r.clinic_name}" → "${toTitleCase(r.clinic_name)}"`)
  )

  if (DRY_RUN) {
    console.log(`\nDRY RUN complete. Run with --apply to execute.`)
    await pool.end()
    return
  }

  // Apply: mark street-address names as review
  const res1 = await pool.query(`
    UPDATE clinics
    SET status = 'review', updated_at = NOW()
    WHERE clinic_name ~ '^\\d+\\s+[A-Z0-9]'
      AND status != 'review'
  `)
  console.log(`\nMarked ${res1.rowCount} street-address clinics as 'review'.`)

  // Apply: title-case ALL CAPS names (do one by one to use JS title-case logic)
  let fixed = 0
  for (const row of allCaps.rows) {
    const newName = toTitleCase(row.clinic_name)
    if (newName !== row.clinic_name) {
      await pool.query(
        `UPDATE clinics SET clinic_name = $1, updated_at = NOW() WHERE id = $2`,
        [newName, row.id]
      )
      fixed++
    }
  }
  console.log(`Title-cased ${fixed} ALL CAPS clinic names.`)

  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })

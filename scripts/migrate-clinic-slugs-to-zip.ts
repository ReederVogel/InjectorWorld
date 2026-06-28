/**
 * One-time data migration: rewrite every clinic slug from `clinic-name-city`
 * to `clinic-name-zip`.
 *
 *   Dry run (no writes, prints summary + writes a report):
 *     DATABASE_URI=... DB_SSL_NO_VERIFY=true npx tsx scripts/migrate-clinic-slugs-to-zip.ts
 *   Apply:
 *     DATABASE_URI=... DB_SSL_NO_VERIFY=true npx tsx scripts/migrate-clinic-slugs-to-zip.ts --apply
 *
 * Slug rule mirrors lib/import/helpers.ts clinicSlug(): kebab(name)-zip, with
 * -2/-3 suffixes for same-name+zip collisions (assigned in ascending id order,
 * matching the beforeValidate hook so future inserts stay consistent).
 *
 * Apply is two-phase inside one transaction (set all to tmp_<id>, then to the
 * final slug) so the UNIQUE(slug) constraint never transiently collides while
 * slugs are swapped between rows. A full id/old/new report is written to
 * SLUG_REPORT (default ./clinic-slug-report.json) before any writes.
 */
import { writeFileSync } from 'fs'
import { clinicSlug } from '../lib/import/helpers'
import { getDbSsl, getDbConnectionString } from '../lib/db-ssl'

const APPLY = process.argv.includes('--apply')
const REPORT = process.env.SLUG_REPORT || './clinic-slug-report.json'

async function main() {
  if (!process.env.DATABASE_URI) {
    console.error('[slug-migrate] No DATABASE_URI set.')
    process.exit(1)
  }
  const { default: pg } = await import('pg')
  const pool = new pg.Pool({ connectionString: getDbConnectionString(), ssl: getDbSsl() })

  const { rows } = await pool.query(
    `select id, clinic_name, zip, slug from clinics order by id asc`,
  )
  console.log(`[slug-migrate] ${rows.length} clinics loaded.`)

  const used = new Set<string>()
  const updates: { id: number; old: string; next: string }[] = []
  let changed = 0
  let collisions = 0
  let missingZip = 0

  for (const r of rows) {
    const zip = String(r.zip ?? '').trim()
    if (!/\d{5}/.test(zip)) missingZip++
    const base = clinicSlug(String(r.clinic_name ?? ''), zip)
    let cand = base
    let n = 1
    while (used.has(cand)) {
      n += 1
      cand = `${base}-${n}`
      if (n === 2) collisions++
    }
    used.add(cand)
    updates.push({ id: r.id, old: String(r.slug ?? ''), next: cand })
    if (cand !== r.slug) changed++
  }

  writeFileSync(REPORT, JSON.stringify(updates, null, 2))
  console.log(`[slug-migrate] report written: ${REPORT}`)
  console.log(`[slug-migrate] summary:`)
  console.log(`  total clinics      : ${rows.length}`)
  console.log(`  slug will change   : ${changed}`)
  console.log(`  unchanged          : ${rows.length - changed}`)
  console.log(`  collisions suffixed: ${collisions}`)
  console.log(`  clinics w/o 5-digit zip: ${missingZip}`)
  console.log('\n  sample (old -> new):')
  for (const u of updates.slice(0, 12)) console.log(`    ${u.old}  ->  ${u.next}`)

  if (!APPLY) {
    console.log('\n[slug-migrate] DRY RUN — no writes. Re-run with --apply to commit.')
    await pool.end()
    return
  }

  console.log('\n[slug-migrate] APPLYING (two-phase, transactional)...')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Phase 1: park every slug at a guaranteed-unique temp value.
    await client.query(`UPDATE clinics SET slug = 'tmpslug_' || id`)
    // Phase 2: set final slugs in chunks via UPDATE ... FROM (VALUES ...).
    const CHUNK = 500
    for (let i = 0; i < updates.length; i += CHUNK) {
      const chunk = updates.slice(i, i + CHUNK)
      const values: string[] = []
      const params: any[] = []
      chunk.forEach((u, j) => {
        values.push(`($${j * 2 + 1}::int, $${j * 2 + 2}::text)`)
        params.push(u.id, u.next)
      })
      await client.query(
        `UPDATE clinics AS c SET slug = v.slug
         FROM (VALUES ${values.join(',')}) AS v(id, slug)
         WHERE c.id = v.id`,
        params,
      )
    }
    await client.query('COMMIT')
    console.log(`[slug-migrate] ✓ committed ${updates.length} rows.`)
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('[slug-migrate] ✗ rolled back:', (e as Error).message)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((e) => {
  console.error('[slug-migrate] Fatal:', e)
  process.exit(1)
})

/**
 * Repairs clinic rows where a shifted CSV column put review prose (or a Google
 * URL) into `city` / `address_line1`, and removes any Location that was
 * auto-created from such a city.
 *
 * Found 2026-08-17: a 223-character review was sitting in `clinics.city`, which
 * had auto-created a metro Location with a 218-character slug and was showing up
 * as an entry in the public city filter list.
 *
 * The detection is deliberately the SAME code the importer now uses
 * (classifyCityValue / classifyAddressValue in lib/import/helpers.ts), so this
 * script and the guard can never drift apart. The guard stops new rows; this
 * cleans the ones already stored.
 *
 * Dry run by default. Nothing is written without --apply.
 *
 *   npx tsx --env-file=.env.staging scripts/fix-corrupt-location-data.ts
 *   npx tsx --env-file=.env.staging scripts/fix-corrupt-location-data.ts --apply
 *
 * NOT added to package.json on purpose: every npm script here is hardcoded to
 * --env-file=.env.local, and .env.local is PRODUCTION.
 */
import pg from 'pg'
import { classifyCityValue, classifyAddressValue } from '../lib/import/helpers'
import { getDbConnectionString, getDbSsl } from '../lib/db-ssl'

const APPLY = process.argv.includes('--apply')

type CityFix = { id: number; clinic: string; from: string; to: string | null; zip: string | null; reason: string }
type AddrFix = { id: number; clinic: string; from: string }
type LocFix = { id: number; name: string; slug: string; state: string | null; refs: string[] }

async function main() {
  // Small pool on purpose: the live app's own pool is capped at 4 against a
  // 25-connection ceiling, so a script must not add real contention.
  const pool = new pg.Pool({
    connectionString: getDbConnectionString(),
    ssl: getDbSsl() as any,
    max: 2,
    connectionTimeoutMillis: 15_000,
  })

  console.log(APPLY ? '=== APPLY MODE: changes will be written ===' : '=== DRY RUN: nothing will be written ===')

  // ── 1. Cities ───────────────────────────────────────────────────────────────
  const clinics = await pool.query<{ id: number; clinic_name: string; city: string; zip: string | null }>(
    `SELECT id, clinic_name, city, zip FROM clinics WHERE city IS NOT NULL AND city <> ''`,
  )

  const cityFixes: CityFix[] = []
  for (const row of clinics.rows) {
    if (classifyCityValue(row.city) === 'clean') continue
    const zip5 = (row.zip ?? '').replace(/[^0-9]/g, '').slice(0, 5)
    let replacement: string | null = null
    if (zip5) {
      const z = await pool.query<{ city: string }>(`SELECT city FROM zip_codes WHERE zip = $1 LIMIT 1`, [zip5])
      replacement = z.rows[0]?.city ?? null
    }
    cityFixes.push({
      id: row.id,
      clinic: row.clinic_name,
      from: row.city,
      to: replacement,
      zip: zip5 || null,
      reason: replacement ? `resolved from ZIP ${zip5}` : 'NO ZIP MATCH — needs a manual decision, left untouched',
    })
  }

  console.log(`\n[cities] scanned ${clinics.rowCount}, corrupt ${cityFixes.length}`)
  for (const f of cityFixes) {
    console.log(`  #${f.id} ${f.clinic}`)
    console.log(`      from: ${JSON.stringify(f.from.slice(0, 100))}`)
    console.log(`        to: ${f.to ? JSON.stringify(f.to) : '(unchanged)'}  [${f.reason}]`)
  }

  // ── 2. Addresses ────────────────────────────────────────────────────────────
  const addrRows = await pool.query<{ id: number; clinic_name: string; address_line1: string }>(
    `SELECT id, clinic_name, address_line1 FROM clinics WHERE address_line1 IS NOT NULL AND address_line1 <> ''`,
  )
  const addrFixes: AddrFix[] = addrRows.rows
    .filter((r) => classifyAddressValue(r.address_line1) === 'prose')
    .map((r) => ({ id: r.id, clinic: r.clinic_name, from: r.address_line1 }))

  console.log(`\n[addresses] scanned ${addrRows.rowCount}, prose ${addrFixes.length} (these get cleared)`)
  for (const f of addrFixes) console.log(`  #${f.id} ${f.clinic}: ${JSON.stringify(f.from.slice(0, 80))}`)

  const suspicious = addrRows.rows.filter((r) => classifyAddressValue(r.address_line1) === 'suspicious')
  console.log(`[addresses] suspicious ${suspicious.length} — KEPT untouched, listed for review only`)
  for (const r of suspicious) console.log(`  #${r.id} ${r.clinic_name}: ${JSON.stringify(r.address_line1.slice(0, 80))}`)

  // ── 3. Locations auto-created from a corrupt city ───────────────────────────
  const locs = await pool.query<{ id: number; name: string; slug: string; state: string | null }>(
    `SELECT id, name, slug, state FROM locations WHERE kind IN ('metro','city')`,
  )
  const locFixes: LocFix[] = []
  for (const l of locs.rows) {
    if (classifyCityValue(l.name) === 'clean') continue
    // Anything pointing at this Location has to be checked before deleting it.
    const refs: string[] = []
    const checks: [string, string, any[]][] = [
      ['zip_codes.location_id', `SELECT count(*)::int n FROM zip_codes WHERE location_id = $1`, [l.id]],
      ['locations.parent_id', `SELECT count(*)::int n FROM locations WHERE parent_id = $1`, [l.id]],
      ['clinics_rels.locations_id', `SELECT count(*)::int n FROM clinics_rels WHERE locations_id = $1`, [l.id]],
      ['page_index.city_slug', `SELECT count(*)::int n FROM page_index WHERE city_slug = $1`, [l.slug]],
    ]
    for (const [label, sql, params] of checks) {
      const r = await pool.query<{ n: number }>(sql, params).catch(() => ({ rows: [{ n: -1 }] }))
      const n = r.rows[0]?.n ?? 0
      if (n > 0) refs.push(`${label}=${n}`)
    }
    locFixes.push({ id: l.id, name: l.name, slug: l.slug, state: l.state, refs })
  }

  console.log(`\n[locations] scanned ${locs.rowCount}, corrupt ${locFixes.length}`)
  for (const f of locFixes) {
    console.log(`  #${f.id} [${f.state}] ${JSON.stringify(f.name.slice(0, 70))}`)
    console.log(`      slug: ${f.slug.slice(0, 70)}${f.slug.length > 70 ? '...' : ''} (${f.slug.length} chars)`)
    console.log(`      references: ${f.refs.length ? f.refs.join(', ') + ' — WILL BE SKIPPED' : 'none, safe to delete'}`)
  }

  if (!APPLY) {
    console.log('\nDry run complete. Re-run with --apply to write these changes.')
    await pool.end()
    return
  }

  // ── Apply, all or nothing ───────────────────────────────────────────────────
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    let cityUpdated = 0
    for (const f of cityFixes) {
      if (!f.to) continue
      const r = await client.query(`UPDATE clinics SET city = $1 WHERE id = $2 AND city = $3`, [f.to, f.id, f.from])
      cityUpdated += r.rowCount ?? 0
    }

    let addrCleared = 0
    for (const f of addrFixes) {
      const r = await client.query(
        `UPDATE clinics SET address_line1 = NULL WHERE id = $1 AND address_line1 = $2`,
        [f.id, f.from],
      )
      addrCleared += r.rowCount ?? 0
    }

    let locDeleted = 0
    for (const f of locFixes) {
      if (f.refs.length) continue
      const r = await client.query(`DELETE FROM locations WHERE id = $1`, [f.id])
      locDeleted += r.rowCount ?? 0
    }

    await client.query('COMMIT')
    console.log(`\nApplied: ${cityUpdated} cities repaired, ${addrCleared} addresses cleared, ${locDeleted} locations deleted.`)
    console.log('Next: run scan:pages so the URL registry and city lists pick this up.')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }

  await pool.end()
}

main().catch((e) => {
  console.error('FAILED:', e instanceof Error ? e.message : e)
  process.exit(1)
})

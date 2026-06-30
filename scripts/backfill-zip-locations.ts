/**
 * backfill-zip-locations.ts — Populate zip_codes.location_id from the existing
 * city/state text match against `locations` (state + metro/city rows).
 *
 *   npm run backfill:zip-locations
 *
 * Idempotent: re-running just recomputes every row's match, so it stays correct
 * after new metro Locations are auto-created (lib/import/import-data.ts) or after
 * `npm run seed:zips` refreshes the raw ZIP data. Rows with no match (military
 * APO/FPO/DPO, territories, or a city not yet in Locations) are left location_id
 * = NULL and reported, not treated as errors.
 *
 * Matching mirrors the logic already used by lib/import/scan.ts's `metroCities`
 * Set and lib/location-slug-lookup.ts: normalizeCity(city) + state code, falling
 * back to a state-level match when no metro/city row exists.
 */

import { getDbConnectionString, getDbSsl } from '../lib/db-ssl'
import { normalizeCity } from '../lib/import/helpers'

const DATABASE_URI = process.env.DATABASE_URI
if (!DATABASE_URI) {
  console.error('[backfill:zip-locations] No DATABASE_URI — set it with --env-file=.env.local')
  process.exit(1)
}

async function main() {
  const { default: pg } = await import('pg')
  const pool = new pg.Pool({ connectionString: getDbConnectionString(), ssl: getDbSsl() })

  const [zipsRes, locsRes] = await Promise.all([
    pool.query(`SELECT id, zip, city, state FROM zip_codes`),
    pool.query(`SELECT id, kind, name, state FROM locations WHERE kind IN ('state', 'metro', 'city')`),
  ])

  // metro/city: normalizeCity(name)|STATE -> location id
  const cityToLocId = new Map<string, number>()
  // state: STATE -> location id
  const stateToLocId = new Map<string, number>()
  for (const l of locsRes.rows as any[]) {
    if (!l.state) continue
    const code = String(l.state).toUpperCase()
    if (l.kind === 'state') {
      stateToLocId.set(code, l.id)
    } else {
      cityToLocId.set(`${normalizeCity(l.name)}|${code}`, l.id)
    }
  }

  let matched = 0
  let matchedByState = 0
  let unmatched = 0
  const unmatchedSample: string[] = []
  const updates: { id: number; locationId: number }[] = []
  const clears: number[] = []

  for (const z of zipsRes.rows as any[]) {
    if (!z.state) {
      // Blank-state rows (APO/FPO/DPO military, a handful of territories) — expected, not an error.
      clears.push(z.id)
      continue
    }
    const code = String(z.state).toUpperCase()
    const cityKey = `${normalizeCity(z.city)}|${code}`
    const locId = cityToLocId.get(cityKey)
    if (locId) {
      matched++
      updates.push({ id: z.id, locationId: locId })
      continue
    }
    const stateLocId = stateToLocId.get(code)
    if (stateLocId) {
      matchedByState++
      updates.push({ id: z.id, locationId: stateLocId })
      continue
    }
    unmatched++
    if (unmatchedSample.length < 20) unmatchedSample.push(`${z.zip} ${z.city}, ${z.state}`)
    clears.push(z.id)
  }

  console.log(`[backfill:zip-locations] ${zipsRes.rows.length} ZIPs: ${matched} matched a metro/city, ${matchedByState} matched a state only, ${unmatched} unmatched (location_id left null), ${clears.length - unmatched} blank-state (military/territory, left null).`)
  if (unmatchedSample.length) {
    console.log(`[backfill:zip-locations] Sample unmatched (real cities with no Location yet):`)
    for (const s of unmatchedSample) console.log(`  ${s}`)
  }

  const BATCH = 1000
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH)
    const ids = batch.map((u) => u.id)
    const locIds = batch.map((u) => u.locationId)
    await pool.query(
      `UPDATE zip_codes AS z SET location_id = u.location_id
       FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS location_id) AS u
       WHERE z.id = u.id`,
      [ids, locIds],
    )
    process.stdout.write(`\r[backfill:zip-locations] Updated ${Math.min(i + BATCH, updates.length)} / ${updates.length}`)
  }
  console.log()

  if (clears.length) {
    for (let i = 0; i < clears.length; i += BATCH) {
      const batch = clears.slice(i, i + BATCH)
      await pool.query(`UPDATE zip_codes SET location_id = NULL WHERE id = ANY($1::int[])`, [batch])
    }
  }

  await pool.end()
  console.log('[backfill:zip-locations] Done.')
  process.exit(0)
}

main().catch((err) => {
  console.error('[backfill:zip-locations] Failed:', err)
  process.exit(1)
})

/**
 * Production location repair. Idempotent. Safe to re-run.
 *
 *   node scripts/fix-locations-prod.mjs            # DRY RUN (no writes), prints plan
 *   node scripts/fix-locations-prod.mjs --apply    # backs up, then applies in one transaction
 *
 * Reads PROD_DB_URI from env.
 *
 * What it does:
 *  1. Dedupe metro/city Locations: one canonical per (lower(name), state).
 *     Canonical slug = kebab(name)-<statecode>. ZIP-slug duplicates merged + deleted
 *     (FKs repointed first: promotions.city_id, header_config_rels, locations.parent_id).
 *  2. Rename canonical rows that only had a ZIP slug to the clean slug.
 *  3. Create a clean metro Location for every published clinic city that has none.
 *  4. Delete garbage-name metros (digits in name) that no clinic matches.
 *  5. Set provider_count on each metro = its published clinic count (used for "Browse by city" tiles).
 *  6. States: is_live + index when >= LIVE_MIN published clinics, else coming-soon + noindex.
 */
import pg from 'pg'
import { writeFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const LIVE_MIN = 10
let uri = process.env.PROD_DB_URI
if (!uri) { console.error('Set PROD_DB_URI'); process.exit(1) }
uri = uri.replace(/[?&]sslmode=[^&]*/i, '')

const kebab = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const client = new pg.Client({ connectionString: uri, ssl: { rejectUnauthorized: false } })
await client.connect()

try {
  // ── Load ────────────────────────────────────────────────────────────────
  const statesRes = await client.query(`SELECT id, name, state AS code, is_live, noindex FROM locations WHERE kind='state'`)
  const stateIdByCode = new Map()
  for (const s of statesRes.rows) stateIdByCode.set(String(s.code).toUpperCase(), s.id)

  const clinicCountByState = new Map()
  const cc = await client.query(`SELECT upper(state) AS code, count(*) n FROM clinics WHERE status='published' AND state IS NOT NULL GROUP BY upper(state)`)
  for (const r of cc.rows) clinicCountByState.set(r.code, Number(r.n))

  // published clinic city counts: key lower(city)|UPPERCODE -> { display, code, n }
  const cityCounts = new Map()
  const cityRes = await client.query(`
    SELECT city, upper(state) AS code, count(*) n
    FROM clinics WHERE status='published' AND city IS NOT NULL AND city !~ '\\d' AND length(trim(city))>1
    GROUP BY city, upper(state)`)
  for (const r of cityRes.rows) {
    const key = `${r.city.trim().toLowerCase()}|${r.code}`
    const prev = cityCounts.get(key)
    if (prev) prev.n += Number(r.n)
    else cityCounts.set(key, { display: r.city.trim(), code: r.code, n: Number(r.n) })
  }

  const metrosRes = await client.query(`SELECT id, name, slug, state AS code, is_live, noindex, parent_id FROM locations WHERE kind IN ('metro','city')`)

  // group existing metros by lower(name)|UPPERCODE
  const groups = new Map()
  for (const m of metrosRes.rows) {
    const key = `${String(m.name).trim().toLowerCase()}|${String(m.code).toUpperCase()}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(m)
  }

  // global used-slug set (for uniqueness when renaming/creating)
  const usedSlugs = new Set(metrosRes.rows.map(m => m.slug))
  const allStateSlugs = new Set(statesRes.rows.map(s => s.slug))
  function uniqueSlug(base) {
    let s = base, i = 2
    while (usedSlugs.has(s) || allStateSlugs.has(s)) { s = `${base}-${i++}` }
    usedSlugs.add(s)
    return s
  }

  const plan = { renames: [], deletes: [], creates: [], garbageDeletes: [], countUpdates: 0, stateUpdates: [] }
  const repoint = [] // { fromIds:[], toId }

  // ── 1+2. Dedupe + canonical slug ──────────────────────────────────────────
  for (const [key, members] of groups) {
    const [name, code] = [members[0].name, String(members[0].code).toUpperCase()]
    if (/\d/.test(name)) continue // garbage-name handled later
    const desired = `${kebab(name)}-${code.toLowerCase()}`
    // canonical = member already on desired slug, else lowest-id member
    let canonical = members.find(m => m.slug === desired)
    const sorted = [...members].sort((a, b) => a.id - b.id)
    if (!canonical) canonical = sorted[0]
    const dups = members.filter(m => m.id !== canonical.id)

    // free desired slug if it is held by a dup we are deleting
    for (const d of dups) usedSlugs.delete(d.slug)
    // ensure canonical takes the clean desired slug (unique)
    if (canonical.slug !== desired) {
      usedSlugs.delete(canonical.slug)
      const finalSlug = usedSlugs.has(desired) ? uniqueSlug(desired) : (usedSlugs.add(desired), desired)
      plan.renames.push({ id: canonical.id, from: canonical.slug, to: finalSlug, name })
      canonical.slug = finalSlug
    }
    if (dups.length) {
      repoint.push({ fromIds: dups.map(d => d.id), toId: canonical.id })
      plan.deletes.push(...dups.map(d => ({ id: d.id, slug: d.slug, name })))
    }
    // mark this place as covered
    cityCounts.delete(`${String(name).trim().toLowerCase()}|${code}`)
    canonical._covered = true
  }

  // ── 4. Garbage-name metros (digits in name) → delete (no clinic matches them) ─
  for (const [, members] of groups) {
    for (const m of members) {
      if (/\d/.test(m.name)) { plan.garbageDeletes.push({ id: m.id, slug: m.slug, name: m.name }); usedSlugs.delete(m.slug) }
    }
  }

  // ── 3. Create missing metros for orphan clinic cities ──────────────────────
  for (const [, info] of cityCounts) {
    const parentId = stateIdByCode.get(info.code)
    if (!parentId) continue // unknown state code; skip
    const stateLive = (clinicCountByState.get(info.code) ?? 0) >= LIVE_MIN
    const slug = uniqueSlug(`${kebab(info.display)}-${info.code.toLowerCase()}`)
    plan.creates.push({ name: info.display, slug, code: info.code, parentId, isLive: stateLive, count: info.n })
  }

  // ── 6. States live/index by data ───────────────────────────────────────────
  for (const s of statesRes.rows) {
    const n = clinicCountByState.get(String(s.code).toUpperCase()) ?? 0
    const live = n >= LIVE_MIN
    if (Boolean(s.is_live) !== live || Boolean(s.noindex) !== !live) {
      plan.stateUpdates.push({ id: s.id, name: s.name, code: s.code, n, isLive: live, noindex: !live })
    }
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  console.log(`\n===== LOCATION REPAIR PLAN (${APPLY ? 'APPLY' : 'DRY RUN'}) =====`)
  console.log(`  canonical renames (ZIP slug -> clean):   ${plan.renames.length}`)
  console.log(`  duplicate metros to delete:              ${plan.deletes.length}`)
  console.log(`  garbage-name metros to delete:           ${plan.garbageDeletes.length}`)
  console.log(`  missing metros to CREATE:                ${plan.creates.length}`)
  console.log(`  state live/index updates:                ${plan.stateUpdates.length}`)
  console.log(`  metro provider_count (clinic) updates:   all metros after structural change`)
  console.log(`\n  sample renames:`, plan.renames.slice(0, 5).map(r => `${r.from}->${r.to}`).join(', '))
  console.log(`  sample creates:`, plan.creates.slice(0, 8).map(c => c.slug).join(', '))
  console.log(`  state flips:`, plan.stateUpdates.map(s => `${s.code}:${s.isLive ? 'LIVE' : 'soon'}(${s.n})`).join(' '))

  if (!APPLY) {
    console.log(`\nDRY RUN only. Re-run with --apply to write. A backup is taken automatically on apply.`)
    await client.end()
    process.exit(0)
  }

  // ── Backup ───────────────────────────────────────────────────────────────
  const backup = {
    when: new Date().toISOString(),
    locations: (await client.query(`SELECT * FROM locations`)).rows,
    promotions_rels: (await client.query(`SELECT id, city_id, state_id FROM promotions`)).rows,
    header_config_rels: (await client.query(`SELECT * FROM header_config_rels WHERE locations_id IS NOT NULL`)).rows,
  }
  const backupFile = `scripts/backup-locations-${Date.now()}.json`
  writeFileSync(backupFile, JSON.stringify(backup))
  console.log(`\nBackup written: ${backupFile} (${backup.locations.length} locations)`)

  // ── Apply in one transaction ────────────────────────────────────────────
  await client.query('BEGIN')
  try {
    // renames
    for (const r of plan.renames) {
      await client.query(`UPDATE locations SET slug=$1, noindex=noindex WHERE id=$2`, [r.to, r.id])
    }
    // repoint FKs from dups -> canonical, then delete dups
    const allDupIds = []
    for (const rp of repoint) {
      await client.query(`UPDATE promotions SET city_id=$1 WHERE city_id = ANY($2::int[])`, [rp.toId, rp.fromIds])
      await client.query(`UPDATE header_config_rels SET locations_id=$1 WHERE locations_id = ANY($2::int[])`, [rp.toId, rp.fromIds])
      await client.query(`UPDATE locations SET parent_id=$1 WHERE parent_id = ANY($2::int[])`, [rp.toId, rp.fromIds])
      allDupIds.push(...rp.fromIds)
    }
    const garbageIds = plan.garbageDeletes.map(g => g.id)
    const delIds = [...allDupIds, ...garbageIds]
    if (delIds.length) {
      await client.query(`DELETE FROM payload_locked_documents_rels WHERE locations_id = ANY($1::int[])`, [delIds])
      await client.query(`UPDATE promotions SET city_id=NULL WHERE city_id = ANY($1::int[])`, [garbageIds.length ? garbageIds : [0]])
      await client.query(`UPDATE locations SET parent_id=NULL WHERE parent_id = ANY($1::int[])`, [delIds])
      await client.query(`DELETE FROM locations WHERE id = ANY($1::int[])`, [delIds])
    }
    // creates
    for (const c of plan.creates) {
      await client.query(
        `INSERT INTO locations (name, slug, kind, state, parent_id, is_live, noindex, provider_count, updated_at, created_at)
         VALUES ($1,$2,'metro',$3,$4,$5,$6,$7, now(), now())`,
        [c.name, c.slug, c.code, c.parentId, c.isLive, !c.isLive, c.count],
      )
    }
    // state flips
    for (const s of plan.stateUpdates) {
      await client.query(`UPDATE locations SET is_live=$1, noindex=$2 WHERE id=$3`, [s.isLive, s.noindex, s.id])
    }
    // metro provider_count = published clinic count by name+state (covers renamed canonicals too)
    const updCount = await client.query(`
      UPDATE locations l SET provider_count = sub.n
      FROM (SELECT lower(city) AS lc, upper(state) AS code, count(*) n
            FROM clinics WHERE status='published' AND city IS NOT NULL GROUP BY lower(city), upper(state)) sub
      WHERE l.kind IN ('metro','city') AND lower(l.name)=sub.lc AND upper(l.state)=sub.code`)
    plan.countUpdates = updCount.rowCount

    await client.query('COMMIT')
    console.log(`\nAPPLIED. provider_count set on ${plan.countUpdates} metros.`)
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('\nROLLED BACK due to error:', e.message)
    throw e
  }

  // ── Verify ───────────────────────────────────────────────────────────────
  const after = await client.query(`SELECT kind, count(*) FROM locations GROUP BY kind ORDER BY count(*) DESC`)
  console.log('\n=== locations after ==='); console.table(after.rows)
  const orphanAfter = await client.query(`
    SELECT count(*) n FROM clinics c WHERE c.status='published' AND c.city IS NOT NULL AND c.city !~ '\\d'
      AND NOT EXISTS (SELECT 1 FROM locations l WHERE l.kind IN ('metro','city') AND upper(l.state)=upper(c.state) AND lower(l.name)=lower(c.city))`)
  console.log(`published clinics still without a city page: ${orphanAfter.rows[0].n}`)
  const dupAfter = await client.query(`SELECT count(*) n FROM (SELECT lower(name),state FROM locations WHERE kind IN ('metro','city') GROUP BY lower(name),state HAVING count(*)>1) t`)
  console.log(`duplicate city groups remaining: ${dupAfter.rows[0].n}`)
} finally {
  if (client._connected !== false) { try { await client.end() } catch {} }
}

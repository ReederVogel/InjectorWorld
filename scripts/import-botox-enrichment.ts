/**
 * import-botox-enrichment.ts
 *
 * One-off script for the "botox.csv" dataset (17,067 rows). Investigation
 * found 79.2% of these rows are the SAME clinics already in production
 * (matched by name+zip+phone+website -- production's google_place_id is
 * NULL on existing rows, so an ID-only check found 0 overlap and was wrong).
 * This is a data-ENRICHMENT job, not a fresh import:
 *
 *   - Rows that strongly match an existing clinic -> UPDATE that clinic's
 *     brandsOffered/servicesOffered only (merge, never overwrite other fields).
 *   - Rows that only weakly match (one signal, not two+) -> flagged as a
 *     DataAlert for manual review, never auto-merged (avoids corrupting an
 *     unrelated clinic on a coincidental name/zip collision).
 *   - Rows with no match at all -> handed to the existing runImport() clinic
 *     importer (lib/import/import-data.ts), completely unmodified, so new
 *     clinics get the exact same validation/dedup/brand-service-split
 *     behavior every other import already gets.
 *
 * The CSV's `treatments_offered` column (pipe-separated) is renamed to
 * `treatment_ids` and re-joined with `;` before reaching runImport(), since
 * that's the column name/delimiter the existing brand-vs-service classifier
 * (importClinics -> brandSlugFor/serviceSlugFor) expects. No changes to
 * lib/import/import-data.ts itself.
 *
 * A single process holding one DB connection open for the full ~17k-row run
 * gets killed by DigitalOcean's managed Postgres ("Connection terminated
 * unexpectedly") well before finishing -- confirmed live. So the write-heavy
 * phases (applying updates, importing new clinics) are designed to run as
 * many SHORT-LIVED process invocations instead of one long one, each getting
 * its own fresh connection. See scripts/run-botox-enrichment.sh for the
 * driving loop.
 *
 * Phases:
 *   match       Compute matches (fast, in-memory) and cache updates.json /
 *               new-rows.json / alerts.json to --cache-dir. Always dry (no writes).
 *   updates     Apply a SLICE of updates.json (--offset/--count) as clinic
 *               brandsOffered/servicesOffered merges. Also writes matching-phase
 *               alerts once (only on the first slice, offset=0).
 *   newclinics  Hand a SLICE of new-rows.json (--offset/--count) to runImport().
 *
 * Usage (single machine, orchestrated by run-botox-enrichment.sh):
 *   npx tsx scripts/import-botox-enrichment.ts --phase match --csv <path> [--limit N]
 *   npx tsx scripts/import-botox-enrichment.ts --phase updates --offset 0 --count 300 [--apply]
 *   npx tsx scripts/import-botox-enrichment.ts --phase newclinics --offset 0 --count 300 [--apply]
 *
 * DATABASE_URI must point at the target DB -- this script never hardcodes a URI.
 */
import { getPayload } from 'payload'
import fs from 'fs'
import path from 'path'
import config from '../payload.config'
import { parseCsv } from '../lib/import/csv'
import { runImport, upsertAlert, type AlertInput } from '../lib/import/import-data'
import { brandSlugFor, serviceSlugFor, titleCase, kebab, type Row } from '../lib/import/helpers'

function arg(name: string): string | undefined {
  const pre = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(pre))
  if (hit) return hit.slice(pre.length)
  const i = process.argv.indexOf(`--${name}`)
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1]
  return undefined
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function normName(s: string | undefined): string {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
function normZip(s: string | undefined): string {
  return String(s ?? '').trim().slice(0, 5)
}
function normPhone(s: string | undefined): string {
  return String(s ?? '').replace(/\D/g, '').replace(/^1/, '')
}
function normWebsite(s: string | undefined): string {
  try {
    return new URL(String(s ?? '').trim()).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

type ExistingClinic = {
  id: number
  clinicId: string
  clinicName: string
  zip: string
  phone: string
  website: string
  brandsOffered: number[]
  servicesOffered: number[]
}

type CachedUpdate = { clinicDbId: number; clinicName: string; addBrands: number[]; addServices: number[] }

const CACHE_DIR = path.resolve(arg('cache-dir') ?? '.tmp/botox-cache')
const UPDATES_FILE = path.join(CACHE_DIR, 'updates.json')
const NEW_ROWS_FILE = path.join(CACHE_DIR, 'new-rows.json')
const ALERTS_FILE = path.join(CACHE_DIR, 'alerts.json')
const SUMMARY_FILE = path.join(CACHE_DIR, 'summary.json')

async function runMatchPhase() {
  const csvPath = arg('csv')
  if (!csvPath) {
    console.error('Usage: --phase match --csv <path> [--limit N]')
    process.exit(1)
  }
  const limitArg = arg('limit')
  const limit = limitArg ? Number(limitArg) : undefined

  console.log(`\n===== botox.csv enrichment: MATCH phase${limit ? ` (LIMIT ${limit})` : ''} =====`)

  const text = fs.readFileSync(path.resolve(csvPath), 'utf8')
  let rows = parseCsv(text)
  console.log(`CSV rows: ${rows.length}`)
  if (limit) {
    rows = rows.slice(0, limit)
    console.log(`Limited to first ${rows.length} rows for this run.`)
  }

  const payload = await getPayload({ config })
  const pool = (payload.db as any).pool

  const [clinicsRes, servicesRes, brandsRes] = await Promise.all([
    pool.query(`SELECT id, clinic_id, clinic_name, zip, phone, website_url FROM clinics`),
    payload.find({ collection: 'services', limit: 1000, depth: 0 }),
    payload.find({ collection: 'brands', limit: 500, depth: 0 }),
  ])

  const relsRes = await pool.query(
    `SELECT parent_id, path, brands_id, services_id FROM clinics_rels WHERE path IN ('brandsOffered', 'servicesOffered')`,
  )
  const brandsByClinicId = new Map<number, number[]>()
  const servicesByClinicId = new Map<number, number[]>()
  for (const r of relsRes.rows as any[]) {
    if (r.path === 'brandsOffered' && r.brands_id != null) {
      const arr = brandsByClinicId.get(r.parent_id) ?? []
      arr.push(Number(r.brands_id))
      brandsByClinicId.set(r.parent_id, arr)
    }
    if (r.path === 'servicesOffered' && r.services_id != null) {
      const arr = servicesByClinicId.get(r.parent_id) ?? []
      arr.push(Number(r.services_id))
      servicesByClinicId.set(r.parent_id, arr)
    }
  }

  const existing: ExistingClinic[] = (clinicsRes.rows as any[]).map((r) => ({
    id: Number(r.id),
    clinicId: String(r.clinic_id),
    clinicName: String(r.clinic_name ?? ''),
    zip: normZip(r.zip),
    phone: normPhone(r.phone),
    website: normWebsite(r.website_url),
    brandsOffered: brandsByClinicId.get(Number(r.id)) ?? [],
    servicesOffered: servicesByClinicId.get(Number(r.id)) ?? [],
  }))
  console.log(`Existing production clinics loaded: ${existing.length}`)

  const byNameZip = new Map<string, ExistingClinic[]>()
  const byPhone = new Map<string, ExistingClinic[]>()
  const byWebsite = new Map<string, ExistingClinic[]>()
  for (const e of existing) {
    const nzKey = `${normName(e.clinicName)}|${e.zip}`
    if (e.zip) {
      if (!byNameZip.has(nzKey)) byNameZip.set(nzKey, [])
      byNameZip.get(nzKey)!.push(e)
    }
    if (e.phone.length >= 10) {
      if (!byPhone.has(e.phone)) byPhone.set(e.phone, [])
      byPhone.get(e.phone)!.push(e)
    }
    if (e.website) {
      if (!byWebsite.has(e.website)) byWebsite.set(e.website, [])
      byWebsite.get(e.website)!.push(e)
    }
  }

  const slugToService = new Map<string, number>()
  for (const s of servicesRes.docs as any[]) slugToService.set(s.slug, Number(s.id))
  const slugToBrand = new Map<string, number>()
  for (const b of brandsRes.docs as any[]) slugToBrand.set(b.slug, Number(b.id))

  const alerts: AlertInput[] = []
  const newRows: Row[] = []
  let strongMatches = 0
  let weakMatches = 0
  let servicesAutoCreated = 0
  let brandsAutoCreated = 0
  const updates: CachedUpdate[] = []

  let processed = 0
  for (const r of rows) {
    processed++
    if (processed % 2000 === 0) console.log(`  ...matched ${processed}/${rows.length}`)
    const nameZipKey = `${normName(r.clinic_name)}|${normZip(r.zip)}`
    const phoneKey = normPhone(r.phone)
    const webKey = normWebsite(r.website_url)

    const nameZipHits = byNameZip.get(nameZipKey) ?? []
    const phoneHits = phoneKey.length >= 10 ? (byPhone.get(phoneKey) ?? []) : []
    const webHits = webKey ? (byWebsite.get(webKey) ?? []) : []

    let strongTarget: ExistingClinic | undefined
    for (const c of nameZipHits) {
      if (phoneHits.includes(c) || webHits.includes(c)) {
        strongTarget = c
        break
      }
    }

    if (strongTarget) {
      strongMatches++
      const treatments = String(r.treatments_offered ?? '').split('|').map((s) => s.trim()).filter(Boolean)
      const addBrands: number[] = []
      const addServices: number[] = []
      for (const raw of treatments) {
        const brandSlug = brandSlugFor(raw)
        if (brandSlug) {
          let id = slugToBrand.get(brandSlug)
          if (id === undefined) {
            id = -(slugToBrand.size + 1) // resolved to a real id at apply time (see runUpdatesPhase)
            slugToBrand.set(brandSlug, id)
            brandsAutoCreated++
            alerts.push({
              alertKey: `auto-brand-${brandSlug}`,
              type: 'other', severity: 'warning',
              message: `Auto-created brand "${titleCase(raw)}" (slug: "${brandSlug}") from botox.csv enrichment. Review category.`,
              collectionSlug: 'brands',
            })
          }
          if (!strongTarget.brandsOffered.includes(id) && !addBrands.includes(id)) addBrands.push(id)
          continue
        }
        const serviceSlug = serviceSlugFor(raw) ?? kebab(raw)
        if (!serviceSlug) continue
        let id = slugToService.get(serviceSlug)
        if (id === undefined) {
          id = -(slugToService.size + 1)
          slugToService.set(serviceSlug, id)
          servicesAutoCreated++
          alerts.push({
            alertKey: `auto-service-${serviceSlug}`,
            type: 'other', severity: 'warning',
            message: `Auto-created service "${titleCase(raw)}" (slug: "${serviceSlug}") from botox.csv enrichment. Review category.`,
            collectionSlug: 'services',
          })
        }
        if (!strongTarget.servicesOffered.includes(id) && !addServices.includes(id)) addServices.push(id)
      }

      if (addBrands.length || addServices.length) {
        updates.push({ clinicDbId: strongTarget.id, clinicName: strongTarget.clinicName, addBrands, addServices })
        strongTarget.brandsOffered.push(...addBrands)
        strongTarget.servicesOffered.push(...addServices)
      }
      continue
    }

    const anyWeakHit = nameZipHits.length > 0 || phoneHits.length > 0 || webHits.length > 0
    if (anyWeakHit) {
      weakMatches++
      const candidate = (nameZipHits[0] ?? phoneHits[0] ?? webHits[0])!
      alerts.push({
        alertKey: `botox-csv-weak-match-${r.clinic_id}`,
        type: 'possible_branch', severity: 'info',
        message: `botox.csv row "${r.clinic_name}" (${r.city}, ${r.state}) only weakly matches existing clinic "${candidate.clinicName}" (${candidate.clinicId}) -- one signal, not two. Skipped auto-merge; review manually.`,
        collectionSlug: 'clinics', documentId: r.clinic_id, relatedId: candidate.clinicId,
      })
      continue
    }

    const { treatments_offered, ...rest } = r
    newRows.push({
      ...rest,
      treatment_ids: (treatments_offered ?? '').split('|').map((s) => s.trim()).filter(Boolean).join(';'),
    })
  }

  // The CSV itself contains duplicate listings for the same physical clinic
  // (same google_place_id, different name casing/wording -- e.g. scraped from
  // both botoxcosmetic.com and juvederm.com). Since neither variant matched an
  // existing production clinic, both would otherwise land in newRows and
  // create two clinic records for one real place. Collapse by google_place_id,
  // keeping the more complete row and merging both rows' treatment lists.
  const dedupedByPlaceId = new Map<string, Row>()
  const noPlaceId: Row[] = []
  let collapsedDuplicates = 0
  for (const row of newRows) {
    const pid = String(row.google_place_id ?? '').trim()
    if (!pid) {
      noPlaceId.push(row)
      continue
    }
    const existing = dedupedByPlaceId.get(pid)
    if (!existing) {
      dedupedByPlaceId.set(pid, row)
      continue
    }
    collapsedDuplicates++
    const mergedTreatments = Array.from(new Set([
      ...String(existing.treatment_ids ?? '').split(';').map((s) => s.trim()).filter(Boolean),
      ...String(row.treatment_ids ?? '').split(';').map((s) => s.trim()).filter(Boolean),
    ])).join(';')
    const keep = Number(row.data_confidence ?? 0) > Number(existing.data_confidence ?? 0) ? row : existing
    dedupedByPlaceId.set(pid, { ...keep, treatment_ids: mergedTreatments })
  }
  const dedupedNewRows = [...noPlaceId, ...dedupedByPlaceId.values()]
  if (collapsedDuplicates > 0) {
    console.log(`\nCollapsed ${collapsedDuplicates} duplicate CSV listings (same google_place_id) within the new-clinics set.`)
  }
  newRows.length = 0
  newRows.push(...dedupedNewRows)

  console.log(`\nStrong matches (auto-merge into existing clinic): ${strongMatches}`)
  console.log(`Weak matches (flagged for manual review, not merged): ${weakMatches}`)
  console.log(`No match (new clinics, after in-CSV dedupe): ${newRows.length}`)
  console.log(`Clinics that will receive new brands/services: ${updates.length}`)
  console.log(`New services encountered: ${servicesAutoCreated}`)
  console.log(`New brands encountered: ${brandsAutoCreated}`)

  fs.mkdirSync(CACHE_DIR, { recursive: true })
  fs.writeFileSync(UPDATES_FILE, JSON.stringify(updates))
  fs.writeFileSync(NEW_ROWS_FILE, JSON.stringify(newRows))
  fs.writeFileSync(ALERTS_FILE, JSON.stringify(alerts))
  fs.writeFileSync(SUMMARY_FILE, JSON.stringify({
    strongMatches, weakMatches, newClinics: newRows.length,
    updateCount: updates.length, servicesAutoCreated, brandsAutoCreated,
  }, null, 2))
  console.log(`\nCached to ${CACHE_DIR}: updates.json (${updates.length}), new-rows.json (${newRows.length}), alerts.json (${alerts.length})`)
  console.log(`===== MATCH phase complete =====\n`)
}

async function runUpdatesPhase() {
  if (!fs.existsSync(UPDATES_FILE)) {
    console.error(`No cached updates found at ${UPDATES_FILE}. Run --phase match first.`)
    process.exit(1)
  }
  const dryRun = !flag('apply')
  const offset = Number(arg('offset') ?? '0')
  const count = Number(arg('count') ?? '300')

  const updates: CachedUpdate[] = JSON.parse(fs.readFileSync(UPDATES_FILE, 'utf8'))
  const slice = updates.slice(offset, offset + count)
  console.log(`\n===== UPDATES phase${dryRun ? ' (DRY RUN)' : ''}: rows ${offset}-${offset + slice.length} of ${updates.length} =====`)
  if (slice.length === 0) {
    console.log('Nothing to do in this slice.')
    return
  }

  const payload = await getPayload({ config })
  const pool = (payload.db as any).pool

  // Real brand/service ids for whatever slugs matter -- re-derive from names
  // embedded in the cached alerts on the first slice isn't reliable, so just
  // reload current brand/service tables fresh (cheap, ~10 rows each) and
  // re-resolve by slug name is not needed: negative placeholder ids in the
  // cache only ever meant "a NEW brand/service", and by the time --apply
  // reaches this phase the match phase's alerts (with real names) already
  // let an admin create them properly -- so here we simply skip any negative
  // (placeholder) id: it gets picked up once a real id exists (re-run phase
  // after resolving alerts), never guessed.
  const relsRes = await pool.query(
    `SELECT parent_id, brands_id, services_id FROM clinics_rels WHERE path IN ('brandsOffered', 'servicesOffered')`,
  )
  const currentBrands = new Map<number, Set<number>>()
  const currentServices = new Map<number, Set<number>>()
  for (const r of relsRes.rows as any[]) {
    if (r.brands_id != null) {
      if (!currentBrands.has(r.parent_id)) currentBrands.set(r.parent_id, new Set())
      currentBrands.get(r.parent_id)!.add(Number(r.brands_id))
    }
    if (r.services_id != null) {
      if (!currentServices.has(r.parent_id)) currentServices.set(r.parent_id, new Set())
      currentServices.get(r.parent_id)!.add(Number(r.services_id))
    }
  }

  let applied = 0, skippedPlaceholder = 0
  const toApply: CachedUpdate[] = []
  for (const u of slice) {
    const realBrands = u.addBrands.filter((id) => id > 0)
    const realServices = u.addServices.filter((id) => id > 0)
    if (realBrands.length !== u.addBrands.length || realServices.length !== u.addServices.length) skippedPlaceholder++
    if (realBrands.length === 0 && realServices.length === 0) continue
    toApply.push({ ...u, addBrands: realBrands, addServices: realServices })
  }

  // NOTE on concurrency: Payload's local API wraps every write in its own DB
  // transaction, which holds a pool connection for the transaction's duration.
  // Firing several payload.update() calls at once against a 4-connection pool
  // deadlocked in testing (concurrent transactions each waiting on a connection
  // held by another) and left "idle in transaction" sessions on the production
  // DB. So this stays a serial loop -- the real speedup instead comes from
  // `context: { disableHooks: true }`, which skips this collection's
  // afterChange hook (a per-row audit-logs INSERT, i.e. a second transaction
  // for every update) -- same pattern already used by lib/import/wipe.ts for
  // bulk operations. One summary audit-log entry is written per slice instead.
  if (!dryRun) {
    for (const u of toApply) {
      try {
        const brandsOffered = Array.from(new Set([...(currentBrands.get(u.clinicDbId) ?? []), ...u.addBrands]))
        const servicesOffered = Array.from(new Set([...(currentServices.get(u.clinicDbId) ?? []), ...u.addServices]))
        await payload.update({
          collection: 'clinics',
          id: u.clinicDbId,
          overrideAccess: true,
          context: { disableHooks: true },
          data: { brandsOffered, servicesOffered } as any,
        })
        applied++
      } catch (err) {
        console.error(`  Failed to update clinic ${u.clinicDbId}: ${(err as Error)?.message}`)
      }
    }
    if (applied > 0) {
      await payload.create({
        collection: 'audit-logs',
        overrideAccess: true,
        data: {
          action: 'update',
          collectionSlug: 'botox-csv-enrichment:updates',
          documentTitle: `botox.csv enrichment: updates slice offset=${offset}`,
          userEmail: 'system@injector.world',
          summary: `botox.csv enrichment (updates phase): merged brand/service data into ${applied} existing clinics (rows ${offset}-${offset + slice.length}).`,
        } as any,
      })
    }
  } else {
    applied = toApply.length
  }

  // Write the match-phase alerts once (first slice only, so re-running slices doesn't duplicate work).
  if (!dryRun && offset === 0 && fs.existsSync(ALERTS_FILE)) {
    const alerts: AlertInput[] = JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8'))
    for (const a of alerts) await upsertAlert(payload, a, 'botox-csv-enrichment')
    console.log(`Wrote ${alerts.length} match-phase alerts (weak matches + new brand/service flags).`)
  }

  console.log(`Applied ${applied}/${slice.length} in this slice (${skippedPlaceholder} had a placeholder id pending real brand/service creation).`)
  console.log(`===== UPDATES phase slice complete =====\n`)
}

async function runNewClinicsPhase() {
  if (!fs.existsSync(NEW_ROWS_FILE)) {
    console.error(`No cached new-rows found at ${NEW_ROWS_FILE}. Run --phase match first.`)
    process.exit(1)
  }
  const dryRun = !flag('apply')
  const offset = Number(arg('offset') ?? '0')
  const count = Number(arg('count') ?? '300')
  const batch = arg('batch') ?? `botox-enrichment-${new Date().toISOString().slice(0, 10)}`

  const newRows: Row[] = JSON.parse(fs.readFileSync(NEW_ROWS_FILE, 'utf8'))
  const slice = newRows.slice(offset, offset + count)
  console.log(`\n===== NEWCLINICS phase${dryRun ? ' (DRY RUN)' : ''}: rows ${offset}-${offset + slice.length} of ${newRows.length} =====`)
  if (slice.length === 0) {
    console.log('Nothing to do in this slice.')
    return
  }

  const payload = await getPayload({ config })
  const report = await runImport(payload, { clinics: slice }, { source: 'botox-csv-enrichment', dryRun, batch })
  console.log('Report:', report.clinics)
  console.log(`Alerts: ${report.alerts.length}`)
  console.log(`===== NEWCLINICS phase slice complete =====\n`)
}

async function main() {
  const phase = arg('phase') ?? 'match'
  if (phase === 'match') await runMatchPhase()
  else if (phase === 'updates') await runUpdatesPhase()
  else if (phase === 'newclinics') await runNewClinicsPhase()
  else {
    console.error(`Unknown --phase "${phase}". Use match | updates | newclinics.`)
    process.exit(1)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

/**
 * Search behaviour recorder. READ ONLY. STAGING ONLY.
 *
 *   npx tsx --env-file=.env.staging scripts/search-baseline.ts record --label before
 *   npx tsx --env-file=.env.staging scripts/search-baseline.ts compare before after
 *
 * WHY THIS EXISTS
 *
 * Before changing how search picks and ranks clinics, we need proof of what it
 * does today. This calls the REAL `searchDirectory()` (not a reimplementation)
 * for a fixed set of representative queries and writes the top results, the
 * reported total, and the timing to a JSON file. Run it again after a change and
 * `compare` prints a per-query diff, so any behaviour change is visible before
 * anything ships.
 *
 * It writes nothing to the database and calls no mutating Payload API. The only
 * file it writes is its own snapshot under scripts/.baselines/.
 *
 * SAFETY
 *
 * - Refuses to run against a DATABASE_URI that is not staging, unless
 *   ALLOW_NON_STAGING=1 is set. `.env.local` is PRODUCTION on this machine.
 * - Never sets PAYLOAD_FORCE_PUSH, so Payload's schema push stays off
 *   (payload.config.ts gates it on that variable).
 * - `allowGeocode` is false by default. The live /search page passes true, but
 *   that path makes an outbound Nominatim call whose result is not reproducible
 *   between runs, which would make the diff lie. Pass --geocode to include it.
 */
import { searchDirectory } from '../lib/search-queries'
import { getPayloadInstance } from '../lib/payload-server'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(HERE, '.baselines')

/**
 * The query set. Each entry is a real shape the omnibox produces, chosen so the
 * diff covers every branch in searchDirectory: brand filter, service filter,
 * location text, state code, ZIP, free text, and combinations.
 */
const QUERIES: { label: string; params: Parameters<typeof searchDirectory>[0] }[] = [
  { label: 'brand: botox (largest brand, 51k clinics)', params: { q: 'botox' } },
  { label: 'brand: juvederm', params: { q: 'juvederm' } },
  { label: 'brand: sculptra', params: { q: 'sculptra' } },
  { label: 'service: lip filler', params: { q: 'lip filler' } },
  { label: 'service: microneedling', params: { q: 'microneedling' } },
  { label: 'brand + city: botox houston', params: { q: 'botox houston' } },
  { label: 'service + state: lip filler texas', params: { q: 'lip filler texas' } },
  { label: 'city only: houston', params: { q: 'houston' } },
  { label: 'city only: new york', params: { q: 'new york' } },
  { label: 'city only: miami', params: { q: 'miami' } },
  { label: 'zip: 77098', params: { q: '77098' } },
  { label: 'free text: dermatology', params: { q: 'dermatology' } },
  { label: 'free text: medical aesthetics', params: { q: 'medical aesthetics' } },
  { label: 'no match: zzzznomatch', params: { q: 'zzzznomatch' } },
  { label: 'legacy two-field: treatment+location', params: { treatment: 'lip-filler', location: 'texas' } },
  { label: 'page 2 of botox', params: { q: 'botox', page: 2 } },
]

/** The fields that define "did the results change". Volatile fields are excluded. */
type Row = {
  rank: number
  id: string
  slug: string
  clinicName: string
  city: string
  state: string
  rating?: number
  ratingCount?: number
  distanceMiles?: number
  textRank?: number
}

type Snapshot = {
  label: string
  recordedAt: string
  database: string
  entries: {
    label: string
    params: any
    ms: number
    reportedTotal: number
    trueTotal: number | null
    serviceLabel?: string
    brandLabel?: string
    locationLabel?: string
    center?: { lat: number; lng: number } | null
    rows: Row[]
  }[]
}

function redact(uri: string): string {
  return uri.replace(/\/\/[^@]*@/, '//***@')
}

function assertStaging(): string {
  const uri = process.env.DATABASE_URI ?? ''
  if (!uri) throw new Error('DATABASE_URI is not set. Pass --env-file=.env.staging')
  const looksStaging = /staging/i.test(uri) || uri.includes('d61aa1a8-76bb-4a95-9e20-1cc20bc0a2c1')
  if (!looksStaging && process.env.ALLOW_NON_STAGING !== '1') {
    throw new Error(
      `Refusing to run: DATABASE_URI does not look like staging.\n` +
        `  ${redact(uri)}\n` +
        `  On this machine .env.local is PRODUCTION. Use --env-file=.env.staging.\n` +
        `  Override with ALLOW_NON_STAGING=1 only if you are certain.`,
    )
  }
  return redact(uri)
}

/**
 * The number of clinics that ACTUALLY match, independent of CANDIDATE_CAP.
 * Recorded alongside the reported total so the gap between them is visible.
 * Only computed for the filters we can express here; null when we cannot.
 */
async function trueTotalFor(params: any): Promise<number | null> {
  const payload = await getPayloadInstance()
  const pool = (payload.db as any).pool
  const q = String(params.q ?? '').toLowerCase().trim()

  const brand = await pool.query(`SELECT id FROM brands WHERE slug = $1`, [q.replace(/\s+/g, '-')])
  if (brand.rows.length) {
    const r = await pool.query(
      `SELECT count(*)::int n FROM clinics c WHERE c.status='published'
         AND EXISTS (SELECT 1 FROM clinics_rels cr
                      WHERE cr.parent_id=c.id AND cr.path='brandsOffered' AND cr.brands_id=$1)`,
      [brand.rows[0].id],
    )
    return r.rows[0].n
  }

  const svc = await pool.query(`SELECT id FROM services WHERE slug = $1`, [q.replace(/\s+/g, '-')])
  if (svc.rows.length) {
    const r = await pool.query(
      `SELECT count(*)::int n FROM clinics c WHERE c.status='published'
         AND EXISTS (SELECT 1 FROM clinics_rels cr
                      WHERE cr.parent_id=c.id AND cr.path='servicesOffered' AND cr.services_id=$1)`,
      [svc.rows[0].id],
    )
    return r.rows[0].n
  }

  return null
}

async function record(label: string, allowGeocode: boolean): Promise<void> {
  const db = assertStaging()
  console.log(`recording "${label}" against ${db}`)
  console.log(`allowGeocode=${allowGeocode}\n`)

  const snap: Snapshot = { label, recordedAt: new Date().toISOString(), database: db, entries: [] }

  for (const { label: qLabel, params } of QUERIES) {
    const t0 = Date.now()
    let result: any
    try {
      result = await searchDirectory({ ...params, allowGeocode })
    } catch (err: any) {
      console.log(`  FAILED  ${qLabel}: ${err?.message ?? err}`)
      continue
    }
    const ms = Date.now() - t0
    const trueTotal = await trueTotalFor(params).catch(() => null)

    const rows: Row[] = (result.clinics as any[]).slice(0, 24).map((c, i) => ({
      rank: i + 1,
      id: String(c.id),
      slug: c.slug,
      clinicName: c.clinicName,
      city: c.city,
      state: c.state,
      rating: c.aggregateRating ?? undefined,
      ratingCount: c.aggregateRatingCount ?? undefined,
      distanceMiles: c.distanceMiles ?? undefined,
      textRank: c.textRank ?? undefined,
    }))

    snap.entries.push({
      label: qLabel,
      params,
      ms,
      reportedTotal: result.clinicTotal,
      trueTotal,
      serviceLabel: result.serviceLabel,
      brandLabel: result.brandLabel,
      locationLabel: result.locationLabel,
      center: result.center ?? null,
      rows,
    })

    const gap =
      trueTotal != null && trueTotal !== result.clinicTotal
        ? `  <-- UI says ${result.clinicTotal}, real is ${trueTotal}`
        : ''
    console.log(
      `  ${String(ms).padStart(6)}ms  total=${String(result.clinicTotal).padStart(5)}  ` +
        `rows=${String(rows.length).padStart(2)}  ${qLabel}${gap}`,
    )
  }

  mkdirSync(OUT_DIR, { recursive: true })
  const file = join(OUT_DIR, `${label}.json`)
  writeFileSync(file, JSON.stringify(snap, null, 2))
  console.log(`\nwrote ${file}`)
}

function loadSnap(label: string): Snapshot {
  const file = join(OUT_DIR, `${label}.json`)
  if (!existsSync(file)) throw new Error(`No snapshot at ${file}. Run "record --label ${label}" first.`)
  return JSON.parse(readFileSync(file, 'utf8')) as Snapshot
}

/** Slug list is the identity of a result set: same slugs in the same order = no change. */
function compare(aLabel: string, bLabel: string): void {
  const a = loadSnap(aLabel)
  const b = loadSnap(bLabel)
  console.log(`comparing "${a.label}" (${a.recordedAt}) -> "${b.label}" (${b.recordedAt})\n`)

  const byLabel = new Map(b.entries.map((e) => [e.label, e]))
  let changed = 0

  for (const ea of a.entries) {
    const eb = byLabel.get(ea.label)
    if (!eb) {
      console.log(`MISSING in ${bLabel}: ${ea.label}\n`)
      changed++
      continue
    }

    const sa = ea.rows.map((r) => r.slug)
    const sb = eb.rows.map((r) => r.slug)
    const sameOrder = sa.length === sb.length && sa.every((s, i) => s === sb[i])
    const setA = new Set(sa)
    const setB = new Set(sb)
    const dropped = sa.filter((s) => !setB.has(s))
    const added = sb.filter((s) => !setA.has(s))
    const speed =
      ea.ms > 0 ? `${ea.ms}ms -> ${eb.ms}ms (${(ea.ms / Math.max(eb.ms, 1)).toFixed(1)}x)` : `${eb.ms}ms`

    if (sameOrder && ea.reportedTotal === eb.reportedTotal) {
      console.log(`SAME    ${ea.label}\n        ${speed}\n`)
      continue
    }

    changed++
    console.log(`CHANGED ${ea.label}`)
    console.log(`        ${speed}`)
    if (ea.reportedTotal !== eb.reportedTotal) {
      console.log(`        total: ${ea.reportedTotal} -> ${eb.reportedTotal}` +
        (eb.trueTotal != null ? `  (real matches: ${eb.trueTotal})` : ''))
    }
    if (dropped.length) console.log(`        dropped (${dropped.length}): ${dropped.slice(0, 6).join(', ')}`)
    if (added.length) console.log(`        added   (${added.length}): ${added.slice(0, 6).join(', ')}`)
    if (!dropped.length && !added.length && !sameOrder) console.log(`        same clinics, different order`)

    console.log(`        top 5 before -> after:`)
    for (let i = 0; i < 5; i++) {
      const ra = ea.rows[i]
      const rb = eb.rows[i]
      const fmt = (r?: Row) => (r ? `${r.clinicName} (${r.city}, ${r.state})`.slice(0, 46) : '-')
      console.log(`          ${String(i + 1).padStart(2)}. ${fmt(ra).padEnd(48)} | ${fmt(rb)}`)
    }
    console.log()
  }

  console.log(`${changed} of ${a.entries.length} queries changed.`)
}

async function main() {
  const [mode, ...rest] = process.argv.slice(2)
  const flag = (name: string): string | undefined => {
    const i = rest.indexOf(`--${name}`)
    return i >= 0 ? rest[i + 1] : undefined
  }

  if (mode === 'record') {
    await record(flag('label') ?? 'before', rest.includes('--geocode'))
  } else if (mode === 'compare') {
    const [a, b] = rest.filter((r) => !r.startsWith('--'))
    if (!a || !b) throw new Error('usage: compare <beforeLabel> <afterLabel>')
    compare(a, b)
  } else {
    console.log(
      'usage:\n' +
        '  npx tsx --env-file=.env.staging scripts/search-baseline.ts record --label before\n' +
        '  npx tsx --env-file=.env.staging scripts/search-baseline.ts compare before after\n',
    )
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('\nsearch-baseline failed:')
  console.error(err)
  process.exit(1)
})

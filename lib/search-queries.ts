import { getPayloadInstance } from './payload-server'
import { rankProviders, rankClinics } from './ranking'
import { getOrganicPins } from './promotion-queries'
import type { DirectoryProvider, DirectoryClinic } from './location-queries'
import {
  providerTsv,
  clinicTsv,
  clinicGeog,
  clinicDistanceMeters,
  toPrefixTsQuery,
  METERS_PER_MILE,
} from './search-sql'

// ─────────────────────────────────────────────────────────────────────────────
// Server-side search (ROADMAP Phase 5).
//
// Replaces the old "load the whole directory into memory and filter" approach.
// The heavy filtering now runs in Postgres using the indexes created by
// `scripts/setup-search-indexes.ts`:
//   - free-text `q` -> GIN full-text on provider/clinic names (prefix tsquery)
//   - `treatment`   -> relational EXISTS on providers_rels
//   - `location`    -> state/city/neighborhood text match
//   - `lat/lng`     -> PostGIS ST_DWithin radius (GIST geography index)
//
// SQL returns only the matching IDs (+ distance); we then hydrate those rows via
// Payload (to reuse field mapping + merit), rank, and paginate. This keeps the
// in-memory set to the FILTERED subset, not the entire directory.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_RADIUS_MILES = 25
/** Hard safety cap on candidate rows pulled from SQL before ranking. */
const CANDIDATE_CAP = 3000

export type SearchProvider = DirectoryProvider & { distanceMiles?: number }
export type SearchClinic = DirectoryClinic & { distanceMiles?: number }

export type SearchParams = {
  /** Free-text query (provider/clinic names). */
  q?: string
  /** Treatment slug or name. */
  treatment?: string
  /** Typed location text (state / city / neighborhood). Ignored when lat/lng set. */
  location?: string
  /** Geocoded coordinates. When present, radius search is used instead of text. */
  lat?: number
  lng?: number
  /** Search radius in miles (default 25). Only used with lat/lng. */
  radiusMiles?: number
  type?: 'all' | 'providers' | 'clinics'
  /** 1-based page. */
  page?: number
  /** Page size (per entity). */
  limit?: number
}

export type SearchResult = {
  providers: SearchProvider[]
  clinics: SearchClinic[]
  treatmentLabel?: string
  locationLabel?: string
  providerTotal: number
  clinicTotal: number
  page: number
  limit: number
  /** The point the search was centered on, when a location resolved to coords. */
  center?: { lat: number; lng: number } | null
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function mapProvider(p: any, distanceMiles?: number): SearchProvider {
  const clinic =
    p.clinic && typeof p.clinic === 'object'
      ? {
          id: String(p.clinic.id),
          name: p.clinic.clinicName,
          slug: p.clinic.slug,
          city: p.clinic.city,
          state: p.clinic.state,
          neighborhood: p.clinic.neighborhood ?? undefined,
          latitude: Number(p.clinic.latitude) || 0,
          longitude: Number(p.clinic.longitude) || 0,
        }
      : { id: '', name: '', slug: '', city: '', state: '', latitude: 0, longitude: 0 }

  return {
    id: String(p.id),
    slug: p.slug,
    fullName: p.fullName,
    credentials: p.credentials,
    title: p.title,
    profilePhotoUrl: p.profilePhotoUrl ?? undefined,
    aggregateRating: p.aggregateRating ?? undefined,
    aggregateRatingCount: p.aggregateRatingCount ?? undefined,
    startingPrice: p.startingPrice ?? undefined,
    treatments: Array.isArray(p.treatmentsOffered)
      ? p.treatmentsOffered.map((t: any) => (typeof t === 'object' ? t.name : '')).filter(Boolean)
      : [],
    editorsPick: !!p.editorsPick,
    licenseStateCode: p.licenseState ?? '',
    licenseNumber: p.licenseNumber ?? '',
    licenseVerificationUrl: p.licenseVerificationUrl ?? undefined,
    acceptsNewPatients: !!p.acceptsNewPatients,
    offersVirtualConsult: !!p.offersVirtualConsult,
    languages: Array.isArray(p.languages) ? p.languages : [],
    loyaltyPrograms: Array.isArray(p.loyaltyPrograms) ? p.loyaltyPrograms : [],
    bio: p.bio ?? undefined,
    updatedAt: p.updatedAt ?? undefined,
    additionalLocationCount: Array.isArray(p.additionalClinics) ? p.additionalClinics.length : 0,
    clinic,
    distanceMiles,
  }
}

function mapClinic(c: any, providerCount: number, distanceMiles?: number): SearchClinic {
  return {
    id: String(c.id),
    slug: c.slug,
    clinicName: c.clinicName,
    tagline: c.tagline ?? undefined,
    city: c.city,
    state: c.state,
    neighborhood: c.neighborhood ?? undefined,
    aggregateRating: c.aggregateRating ?? undefined,
    aggregateRatingCount: c.aggregateRatingCount ?? undefined,
    photoUrl: c.clinicPhotoUrls?.[0]?.url ?? undefined,
    serviceType: c.serviceType || 'In-Person',
    yearEstablished: c.yearEstablished ?? undefined,
    latitude: Number(c.latitude) || 0,
    longitude: Number(c.longitude) || 0,
    providerCount,
    distanceMiles,
  }
}

/**
 * A small WHERE-clause builder that tracks positional ($1, $2, …) parameters so
 * user-supplied text is always parameterized (never string-interpolated).
 */
class Where {
  clauses: string[] = []
  params: any[] = []
  add(sql: string) {
    this.clauses.push(sql)
  }
  /** Add a clause and bind a parameter; returns the $n placeholder. */
  bind(value: any): string {
    this.params.push(value)
    return `$${this.params.length}`
  }
  sql(): string {
    return this.clauses.length ? `WHERE ${this.clauses.join(' AND ')}` : ''
  }
}

export async function searchDirectory(params: SearchParams): Promise<SearchResult> {
  const payload = await getPayloadInstance()
  const pool = (payload.db as any).pool

  const q = (params.q ?? '').trim()
  const treatmentQ = (params.treatment ?? '').trim()
  const locationQ = (params.location ?? '').trim()
  const type = params.type ?? 'all'
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(Math.max(1, params.limit ?? 24), 100)
  const hasGeo = Number.isFinite(params.lat) && Number.isFinite(params.lng)
  const lat = hasGeo ? (params.lat as number) : undefined
  const lng = hasGeo ? (params.lng as number) : undefined
  const radiusMeters = (params.radiusMiles ?? DEFAULT_RADIUS_MILES) * METERS_PER_MILE

  const empty: SearchResult = {
    providers: [],
    clinics: [],
    providerTotal: 0,
    clinicTotal: 0,
    page,
    limit,
    center: hasGeo ? { lat: lat!, lng: lng! } : null,
  }

  // Nothing to search on -> return empty (never dump the whole table).
  if (!q && !treatmentQ && !locationQ && !hasGeo) return empty

  // ── Resolve treatment -> id + label ──────────────────────────────────────
  let treatmentId: number | undefined
  let treatmentLabel: string | undefined
  if (treatmentQ) {
    const tr = await payload.find({
      collection: 'treatments',
      where: { or: [{ slug: { equals: slugify(treatmentQ) } }, { name: { like: treatmentQ } }] },
      limit: 1,
      depth: 0,
    })
    const doc = tr.docs[0] as any
    if (doc) {
      treatmentId = Number(doc.id)
      treatmentLabel = doc.name
    } else {
      // A treatment was requested but does not exist -> no results.
      return { ...empty, treatmentLabel: treatmentQ }
    }
  }

  // ── Resolve location text -> state code OR city/neighborhood LIKE ─────────
  let stateCode: string | undefined
  let stateLocationId: string | undefined
  let cityLike: string | undefined
  let locationLabel: string | undefined
  if (locationQ && !hasGeo) {
    const statesRes = await payload.find({
      collection: 'locations',
      where: { kind: { equals: 'state' } },
      limit: 100,
      depth: 0,
    })
    const byName = new Map<string, { code: string; name: string; id: string }>()
    const byCode = new Map<string, { name: string; id: string }>()
    for (const s of statesRes.docs as any[]) {
      if (s.name && s.state) {
        byName.set(String(s.name).toLowerCase(), { code: s.state, name: s.name, id: String(s.id) })
        byCode.set(String(s.state).toLowerCase(), { name: s.name, id: String(s.id) })
      }
    }
    const lc = locationQ.toLowerCase()
    if (byName.has(lc)) {
      const m = byName.get(lc)!
      stateCode = m.code
      stateLocationId = m.id
      locationLabel = m.name
    } else if (byCode.has(lc)) {
      const m = byCode.get(lc)!
      stateCode = lc.toUpperCase()
      stateLocationId = m.id
      locationLabel = m.name
    } else {
      cityLike = `%${lc}%`
      locationLabel = locationQ
    }
  } else if (hasGeo) {
    locationLabel = locationQ || undefined
  }

  const tsquery = q ? toPrefixTsQuery(q) : ''

  // ── Provider candidate query ─────────────────────────────────────────────
  async function providerCandidates(): Promise<{ ids: number[]; dist: Map<number, number> }> {
    const w = new Where()
    w.add('p.clinic_id IS NOT NULL')
    if (treatmentId !== undefined) {
      w.add(
        `EXISTS (SELECT 1 FROM providers_rels r WHERE r.parent_id = p.id AND r.path = 'treatmentsOffered' AND r.treatments_id = ${w.bind(
          treatmentId,
        )})`,
      )
    }
    if (tsquery) {
      w.add(`${providerTsv('p')} @@ to_tsquery('english', ${w.bind(tsquery)})`)
    }
    if (stateCode) w.add(`c.state = ${w.bind(stateCode)}`)
    if (cityLike) w.add(`(lower(c.city) LIKE ${w.bind(cityLike)} OR lower(c.neighborhood) LIKE ${w.bind(cityLike)})`)
    if (hasGeo) {
      w.add(
        `ST_DWithin(${clinicGeog('c')}, geography(ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)), ${radiusMeters})`,
      )
    }
    const distExpr = hasGeo ? clinicDistanceMeters(lat!, lng!, 'c') : 'NULL'
    const sql = `SELECT p.id AS id, ${distExpr} AS dist_m
                 FROM providers p
                 JOIN clinics c ON c.id = p.clinic_id
                 ${w.sql()}
                 LIMIT ${CANDIDATE_CAP}`
    const res = await pool.query(sql, w.params)
    const dist = new Map<number, number>()
    const ids: number[] = []
    for (const row of res.rows) {
      ids.push(Number(row.id))
      if (row.dist_m != null) dist.set(Number(row.id), Number(row.dist_m))
    }
    return { ids, dist }
  }

  // ── Clinic candidate query ───────────────────────────────────────────────
  async function clinicCandidates(): Promise<{ ids: number[]; dist: Map<number, number> }> {
    const w = new Where()
    if (treatmentId !== undefined) {
      w.add(
        `EXISTS (SELECT 1 FROM providers p2 JOIN providers_rels r ON r.parent_id = p2.id AND r.path = 'treatmentsOffered' AND r.treatments_id = ${w.bind(
          treatmentId,
        )} WHERE p2.clinic_id = c.id)`,
      )
    }
    if (tsquery) {
      w.add(`${clinicTsv('c')} @@ to_tsquery('english', ${w.bind(tsquery)})`)
    }
    if (stateCode) w.add(`c.state = ${w.bind(stateCode)}`)
    if (cityLike) w.add(`(lower(c.city) LIKE ${w.bind(cityLike)} OR lower(c.neighborhood) LIKE ${w.bind(cityLike)})`)
    if (hasGeo) {
      w.add(
        `ST_DWithin(${clinicGeog('c')}, geography(ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)), ${radiusMeters})`,
      )
    }
    const distExpr = hasGeo ? clinicDistanceMeters(lat!, lng!, 'c') : 'NULL'
    const sql = `SELECT c.id AS id, ${distExpr} AS dist_m
                 FROM clinics c
                 ${w.sql()}
                 LIMIT ${CANDIDATE_CAP}`
    const res = await pool.query(sql, w.params)
    const dist = new Map<number, number>()
    const ids: number[] = []
    for (const row of res.rows) {
      ids.push(Number(row.id))
      if (row.dist_m != null) dist.set(Number(row.id), Number(row.dist_m))
    }
    return { ids, dist }
  }

  const toMiles = (m?: number) =>
    m != null ? Math.round((m / METERS_PER_MILE) * 10) / 10 : undefined

  // ── Run providers ────────────────────────────────────────────────────────
  let providers: SearchProvider[] = []
  let providerTotal = 0
  if (type !== 'clinics') {
    const { ids, dist } = await providerCandidates()
    providerTotal = ids.length
    if (ids.length) {
      const res = await payload.find({
        collection: 'providers',
        where: { id: { in: ids } },
        depth: 2,
        limit: ids.length,
      })
      // Honor "sponsored top" for a resolved state scope (mirrors the state hub).
      // Free-text / geo-only / city searches have no promotable scope, so no pins.
      let pinnedRanks: Map<string, number> | undefined
      if (stateLocationId) {
        try {
          pinnedRanks = await getOrganicPins('state', undefined, stateLocationId)
        } catch {
          pinnedRanks = undefined
        }
      }
      const mapped = (res.docs as any[]).map((p) =>
        mapProvider(p, toMiles(dist.get(Number(p.id)))),
      )
      providers = rankProviders(mapped, { pinnedRanks, useDistance: hasGeo }).slice(
        (page - 1) * limit,
        page * limit,
      )
    }
  }

  // ── Run clinics ──────────────────────────────────────────────────────────
  let clinics: SearchClinic[] = []
  let clinicTotal = 0
  if (type !== 'providers') {
    const { ids, dist } = await clinicCandidates()
    clinicTotal = ids.length
    if (ids.length) {
      // provider counts for these clinics (scoped to the treatment when present)
      const countWhere = new Where()
      countWhere.add(`clinic_id = ANY(${countWhere.bind(ids)})`)
      if (treatmentId !== undefined) {
        countWhere.add(
          `EXISTS (SELECT 1 FROM providers_rels r WHERE r.parent_id = providers.id AND r.path = 'treatmentsOffered' AND r.treatments_id = ${countWhere.bind(
            treatmentId,
          )})`,
        )
      }
      const countRes = await pool.query(
        `SELECT clinic_id, count(*)::int AS n FROM providers ${countWhere.sql()} GROUP BY clinic_id`,
        countWhere.params,
      )
      const countByClinic = new Map<number, number>()
      for (const row of countRes.rows) countByClinic.set(Number(row.clinic_id), Number(row.n))

      const res = await payload.find({
        collection: 'clinics',
        where: { id: { in: ids } },
        depth: 0,
        limit: ids.length,
      })
      const mapped = (res.docs as any[]).map((c) =>
        mapClinic(c, countByClinic.get(Number(c.id)) ?? 0, toMiles(dist.get(Number(c.id)))),
      )
      clinics = rankClinics(mapped, { useDistance: hasGeo }).slice(
        (page - 1) * limit,
        page * limit,
      )
    }
  }

  return {
    providers,
    clinics,
    treatmentLabel,
    locationLabel,
    providerTotal,
    clinicTotal,
    page,
    limit,
    center: hasGeo ? { lat: lat!, lng: lng! } : null,
  }
}

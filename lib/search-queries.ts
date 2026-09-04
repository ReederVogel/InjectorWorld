import { getPayloadInstance } from './payload-server'
import { getLocationSlugMap, lookupSlugs } from './location-slug-lookup'
import { rankClinics } from './ranking'
import { lookupZip } from './zip-lookup'
import { geocode } from './geocode'
import type { DirectoryClinic } from './location-queries'
import {

  clinicTsv,
  clinicGeog,
  clinicDistanceMeters,
  clinicDistanceMetersHaversine,
  clinicBoundingBoxSql,
  toPrefixTsQuery,
  METERS_PER_MILE,
} from './search-sql'
import {
  parseSearchQuery,
  buildServiceLookup,
  buildBrandLookup,
  type IntentLookups,
} from './search-intent'
import { leanHydrateClinics, leanHydrationEnabled } from './search-hydrate'
import { blendedScoreSql, rankedSqlEnabled } from './search-ranking-sql'
import { ttlMemo } from './ttl-memo'

// ── PostGIS availability cache ────────────────────────────────────────────────
// Some DB instances (DigitalOcean Managed Postgres out-of-box) do not have
// PostGIS installed — confirmed it is not even installable on the production
// cluster (not in pg_available_extensions). We check once per server process
// and cache the result so every request after the first is free. When PostGIS
// is absent, providerCandidates/clinicCandidates fall back to the plain-SQL
// Haversine expression (clinicDistanceMetersHaversine in search-sql.ts) for
// both the radius WHERE clause and the distance-for-ranking value, so geo
// search still works, just without a GIST index. Installing PostGIS on the DB
// switches back to ST_DWithin/ST_Distance automatically with no code change.
let _postgisAvailable: boolean | null = null
async function isPostGisAvailable(pool: any): Promise<boolean> {
  if (_postgisAvailable !== null) return _postgisAvailable
  try {
    // pg_proc contains one row per function; st_dwithin exists only when PostGIS
    // is installed. This never throws — a missing extension just returns 0 rows.
    const res = await pool.query(
      `SELECT 1 FROM pg_proc WHERE proname = 'st_dwithin' LIMIT 1`,
    )
    _postgisAvailable = res.rows.length > 0
  } catch {
    _postgisAvailable = false
  }
  if (!_postgisAvailable) {
    console.warn('[search] PostGIS not available — geo radius search disabled. Install PostGIS to enable.')
  }
  return _postgisAvailable
}

// ─────────────────────────────────────────────────────────────────────────────
// Server-side search (Phase 5, omnibox upgrade in Phase 13).
//
// Phase 13 turns the two-field (treatment + location) search into a true omnibox:
// a single free-text `q` is parsed (lib/search-intent.ts) into treatment +
// location + zip + leftover name text, and each part is applied as the matching
// SQL filter. Relevance uses ts_rank over the weighted tsvectors, blended with
// merit (+ distance when geocoded).
//
// The heavy filtering runs in Postgres using the indexes from
// `scripts/setup-search-indexes.ts`:
//   - free-text  -> GIN full-text on provider/clinic names (prefix tsquery) PLUS
//                   the isolated search.provider_doc (treatments/specialties/langs)
//   - treatment  -> relational EXISTS on providers_rels
//   - location   -> state/city/neighborhood text
//   - zip / geo  -> PostGIS ST_DWithin radius (geocoded centroid)
//
// SQL returns only matching IDs (+ distance + text_rank); we hydrate those rows
// via Payload (to reuse field mapping + merit), rank, and paginate.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_RADIUS_MILES = 25
/**
 * Wider radius for the place-name fallback (a typed city we have no exact data
 * for, e.g. "newport beach"): surface the nearest metro within a generous reach
 * rather than returning nothing.
 */
const FALLBACK_RADIUS_MILES = 60
/** Hard safety cap on candidate rows pulled from SQL before ranking. */
const CANDIDATE_CAP = 3000
/**
 * Extra rows fetched beyond the requested page when SEARCH_RANKED_SQL orders in
 * SQL. Absorbs any float difference between the Postgres and JS versions of the
 * blended score, so a disagreement can only ever affect rows past the margin.
 */
const RANKED_FETCH_MARGIN = 100

export type SearchClinic = DirectoryClinic & { distanceMiles?: number; textRank?: number }

export type SearchParams = {
  /** Free-text omnibox query (treatment / location / zip / name / phrase). */
  q?: string
  /** Explicit treatment slug or name (overrides what the parser finds in q). */
  treatment?: string
  /** Explicit location text (overrides the parser). Ignored when lat/lng set. */
  location?: string
  /** Geocoded coordinates. When present, radius search is used. */
  lat?: number
  lng?: number
  /** Search radius in miles (default 25). Only used with lat/lng. */
  radiusMiles?: number
  /** 1-based page. */
  page?: number
  /** Page size (per entity). */
  limit?: number
  /**
   * Allow server-side geocoding (ZIP -> coords, and a place-name fallback when a
   * name search is empty). OFF by default so the as-you-type Hero panel stays fast
   * and never geocodes a half-typed word; the /search page + the API geo=1 path
   * turn it on.
   */
  allowGeocode?: boolean
}

export type SearchResult = {
  clinics: SearchClinic[]
  serviceLabel?: string
  brandLabel?: string
  locationLabel?: string
  clinicTotal: number
  page: number
  limit: number
  /** The point the search was centered on, when a location resolved to coords. */
  center?: { lat: number; lng: number } | null
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function mapClinic(c: any, slugMap: Map<string, { citySlug: string; stateSlug: string }>, providerCount: number, distanceMiles?: number, textRank?: number): SearchClinic {
  const { citySlug, stateSlug } = lookupSlugs(c.city ?? '', c.state ?? '', slugMap)
  return {
    id: String(c.id),
    slug: c.slug,
    citySlug,
    stateSlug,
    clinicName: c.clinicName,
    tagline: c.tagline ?? undefined,
    city: c.city,
    state: c.state,
    neighborhood: c.neighborhood ?? undefined,
    aggregateRating: c.aggregateRating ?? undefined,
    aggregateRatingCount: c.aggregateRatingCount ?? undefined,
    photoUrl: c.clinicPhotoUrls?.[0]?.url ?? undefined,
    latitude: Number(c.latitude) || 0,
    longitude: Number(c.longitude) || 0,
    providerCount,
    brandsOffered: Array.isArray(c.brandsOffered)
      ? c.brandsOffered.map((b: any) => String(typeof b === 'object' ? b.id : b)).filter(Boolean)
      : [],
    servicesOffered: Array.isArray(c.servicesOffered)
      ? c.servicesOffered.map((s: any) => String(typeof s === 'object' ? s.id : s)).filter(Boolean)
      : [],
    distanceMiles,
    textRank,
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

// ── Cached intent + resolution lookups (rebuilt every few minutes) ───────────
type SearchLookups = {
  intent: IntentLookups
  slugToTreatment: Map<string, { id: number; name: string }>
  slugToBrand: Map<string, { id: number; name: string }>
  stateByName: Map<string, { code: string; name: string; id: string }>
  stateByCode: Map<string, { name: string; id: string }>
}
let lookupCache: { at: number; lk: SearchLookups } | null = null
const LOOKUP_TTL_MS = 5 * 60 * 1000

async function getLookups(payload: any, pool: any): Promise<SearchLookups> {
  if (lookupCache && Date.now() - lookupCache.at < LOOKUP_TTL_MS) return lookupCache.lk

  const [treatmentsRes, brandsRes, statesRes] = await Promise.all([
    payload.find({ collection: 'services', limit: 200, depth: 0 }),
    payload.find({ collection: 'brands', limit: 200, depth: 0 }),
    payload.find({ collection: 'locations', where: { kind: { equals: 'state' } }, limit: 200, depth: 0 }),
  ])

  const treatments = (treatmentsRes.docs as any[]).map((t) => ({
    id: Number(t.id),
    name: String(t.name),
    slug: String(t.slug),
  }))
  const slugToTreatment = new Map<string, { id: number; name: string }>()
  for (const t of treatments) slugToTreatment.set(t.slug, { id: t.id, name: t.name })

  const treatmentPhraseToSlug = buildServiceLookup(treatments)

  const brands = (brandsRes.docs as any[]).map((b) => ({
    id: Number(b.id),
    name: String(b.name),
    slug: String(b.slug),
  }))
  const slugToBrand = new Map<string, { id: number; name: string }>()
  for (const b of brands) slugToBrand.set(b.slug, { id: b.id, name: b.name })

  const brandPhraseToSlug = buildBrandLookup(brands)

  const stateByName = new Map<string, { code: string; name: string; id: string }>()
  const stateByCode = new Map<string, { name: string; id: string }>()
  const locationPhrases = new Set<string>()
  for (const s of statesRes.docs as any[]) {
    if (s.name && s.state) {
      const name = String(s.name).toLowerCase()
      const code = String(s.state).toLowerCase()
      stateByName.set(name, { code: s.state, name: s.name, id: String(s.id) })
      stateByCode.set(code, { name: s.name, id: String(s.id) })
      // Only full state NAMES go into the omnibox location lookup. Bare 2-letter
      // codes ("pa", "or", "in", "me") collide with credentials + English words,
      // so the parser must not treat them as locations. stateByCode is still used
      // to resolve an EXPLICIT location param (the legacy two-field path).
      locationPhrases.add(name)
    }
  }

  // Known cities + neighborhoods come from the clinic data itself, so any place we
  // actually have providers in is recognized as a location (not a name).
  try {
    const places = await pool.query(
      `SELECT lower(city) AS v FROM clinics WHERE city IS NOT NULL
       UNION SELECT lower(neighborhood) FROM clinics WHERE neighborhood IS NOT NULL`,
    )
    for (const row of places.rows) if (row.v) locationPhrases.add(String(row.v))
  } catch {
    /* clinics table unavailable -> location matching falls back to states only */
  }

  const lk: SearchLookups = {
    intent: { treatmentPhraseToSlug, brandPhraseToSlug, locationPhrases },
    slugToTreatment,
    slugToBrand,
    stateByName,
    stateByCode,
  }
  lookupCache = { at: Date.now(), lk }
  return lk
}

export async function searchDirectory(params: SearchParams): Promise<SearchResult> {
  const payload = await getPayloadInstance()
  const pool = (payload.db as any).pool
  const slugMap = await getLocationSlugMap()

  const rawQ = (params.q ?? '').trim()
  const explicitTreatment = (params.treatment ?? '').trim()
  const explicitLocation = (params.location ?? '').trim()
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(Math.max(1, params.limit ?? 24), 100)
  const allowGeocode = params.allowGeocode ?? false

  // One-time PostGIS check. PostGIS is confirmed unavailable (not just
  // uninstalled) on the production DigitalOcean cluster, so geo search no
  // longer depends on it: when absent, the Haversine SQL fallback below is
  // used instead of ST_DWithin/ST_Distance. `hasGeo` now means "we have
  // coordinates to filter by," independent of which SQL expression computes it.
  const geoEnabled = await isPostGisAvailable(pool)

  let hasGeo = Number.isFinite(params.lat) && Number.isFinite(params.lng)
  let lat = hasGeo ? (params.lat as number) : undefined
  let lng = hasGeo ? (params.lng as number) : undefined
  let radiusMeters = (params.radiusMiles ?? DEFAULT_RADIUS_MILES) * METERS_PER_MILE

  const empty: SearchResult = {
    clinics: [],
    clinicTotal: 0,
    page,
    limit,
    center: hasGeo ? { lat: lat!, lng: lng! } : null,
  }

  // Nothing to search on -> return empty (never dump the whole table).
  if (!rawQ && !explicitTreatment && !explicitLocation && !hasGeo) return empty

  const lk = await getLookups(payload, pool)

  // ── Parse the omnibox query into intent ──────────────────────────────────
  const parsed = rawQ ? parseSearchQuery(rawQ, lk.intent) : { freeText: '' as string }

  // ── Resolve treatment (explicit param wins, else parsed) ─────────────────
  let treatmentId: number | undefined
  let treatmentLabel: string | undefined
  let treatmentSlug = parsed.treatmentSlug
  if (explicitTreatment) {
    const phrase = explicitTreatment.toLowerCase()
    treatmentSlug = lk.intent.treatmentPhraseToSlug.get(phrase) ?? slugify(explicitTreatment)
  }
  if (treatmentSlug) {
    const t = lk.slugToTreatment.get(treatmentSlug)
    if (t) {
      treatmentId = t.id
      treatmentLabel = t.name
    } else if (explicitTreatment) {
      // An explicit treatment was requested but does not exist -> no results.
      return { ...empty, serviceLabel: explicitTreatment }
    }
  }

  // ── Resolve brand (product) from the parsed query, e.g. "juvederm" ───────
  let brandId: number | undefined
  let brandLabel: string | undefined
  if (parsed.brandSlug) {
    const b = lk.slugToBrand.get(parsed.brandSlug)
    if (b) {
      brandId = b.id
      brandLabel = b.name
    }
  }

  // ── Resolve location text -> state code OR city/neighborhood LIKE ─────────
  const locationQ = explicitLocation || parsed.location || ''
  let stateCode: string | undefined
  let stateLocationId: string | undefined
  let cityLike: string | undefined
  let locationLabel: string | undefined
  if (locationQ && !hasGeo) {
    const lc = locationQ.toLowerCase()
    // Extract a standalone 5-digit ZIP from anywhere in the string, not just an
    // exact full match -- the location field is often filled with a compound
    // label like "77098, Houston, TX" (picked from a ZIP suggestion, or from
    // IP-based city detection), which the old exact-match check silently missed,
    // falling through to a cityLike text filter that could never match anything.
    const zipMatch = lc.match(/(?:^|\D)(\d{5})(?:\D|$)/)
    if (zipMatch) {
      const zip5 = zipMatch[1]
      // ZIP: try the offline zip_codes table first (fast, no network).
      // Fall back to the geocoder if not in our dataset.
      const offlineHit = await lookupZip(zip5, pool)
      if (offlineHit) {
        lat = offlineHit.lat
        lng = offlineHit.lng
        hasGeo = true
        locationLabel = offlineHit.label
      } else if (allowGeocode) {
        const hit = await geocode(zip5)
        if (hit) {
          lat = hit.lat
          lng = hit.lng
          hasGeo = true
          locationLabel = hit.label
        } else {
          cityLike = `%${lc}%`
          locationLabel = locationQ
        }
      } else {
        cityLike = `%${lc}%`
        locationLabel = locationQ
      }
    } else if (lk.stateByName.has(lc)) {
      const m = lk.stateByName.get(lc)!
      stateCode = m.code
      stateLocationId = m.id
      locationLabel = m.name
    } else if (lk.stateByCode.has(lc)) {
      const m = lk.stateByCode.get(lc)!
      stateCode = lc.toUpperCase()
      stateLocationId = m.id
      locationLabel = m.name
    } else {
      // Compound "City, ST" / "City, State Name" labels -- exactly what the
      // location autocomplete suggests and what a clicked suggestion submits
      // -- never match a bare `city` column value as one LIKE pattern
      // ("houston, tx" != "Houston"), silently returning zero results for the
      // site's own suggestion. Split off a trailing state and match it
      // separately; keep just the city portion as the LIKE pattern.
      const commaIdx = lc.lastIndexOf(',')
      const cityPart = commaIdx > 0 ? lc.slice(0, commaIdx).trim() : lc
      const statePart = commaIdx > 0 ? lc.slice(commaIdx + 1).trim() : ''
      if (statePart && lk.stateByCode.has(statePart)) {
        const m = lk.stateByCode.get(statePart)!
        stateCode = statePart.toUpperCase()
        stateLocationId = m.id
      } else if (statePart && lk.stateByName.has(statePart)) {
        const m = lk.stateByName.get(statePart)!
        stateCode = m.code
        stateLocationId = m.id
      }
      cityLike = `%${cityPart}%`
      locationLabel = locationQ
    }
  } else if (hasGeo) {
    locationLabel = locationQ || undefined
  }

  // ── ZIP / free-text -> free-text query (+ optional geocoding) ─────────────
  // When geocoding is allowed, a ZIP becomes a radius search. When it is not
  // (live as-you-type), the ZIP is folded back into the text query so it still
  // matches clinics by their zip column (zip is in the clinic tsvector).
  let freeText = parsed.freeText
  if (parsed.zip && !hasGeo) {
    // Try offline ZIP lookup first; geocoder as fallback.
    const offlineZip = await lookupZip(parsed.zip, pool)
    if (offlineZip) {
      lat = offlineZip.lat
      lng = offlineZip.lng
      hasGeo = true
      locationLabel = locationLabel || offlineZip.label
    } else if (allowGeocode) {
      const hit = await geocode(parsed.zip)
      if (hit) {
        lat = hit.lat
        lng = hit.lng
        hasGeo = true
        locationLabel = locationLabel || hit.label
      } else {
        freeText = [freeText, parsed.zip].filter(Boolean).join(' ')
      }
    } else if (!treatmentId && !stateCode && !cityLike) {
      // Live (no-geo) mode: only fold a bare ZIP into the text query when it is the
      // sole signal (so a pure ZIP still matches a clinic by its zip column).
      // When combined with a treatment/location, drop it here; the submit path
      // (geo=1) turns it into a radius search.
      freeText = [freeText, parsed.zip].filter(Boolean).join(' ')
    }
  }

  let tsquery = freeText ? toPrefixTsQuery(freeText) : ''

  const toMiles = (m?: number) =>
    m != null ? Math.round((m / METERS_PER_MILE) * 10) / 10 : undefined

  // Radius WHERE clause + distance expression, picking PostGIS (indexed) when
  // available or the Haversine fallback (search-sql.ts) when it is not. Shared
  // by providerCandidates/clinicCandidates so the two never drift apart.
  function geoSql(alias: string): { whereClause: string | null; distExpr: string } {
    if (!hasGeo) return { whereClause: null, distExpr: 'NULL' }
    const a = alias ? `${alias}.` : ''

    // The predicate `clinics_geog_idx` was CREATEd with. Postgres will only use a
    // PARTIAL index when the query's WHERE provably implies that index's own
    // WHERE, and this one has never been stated here, so every radius search
    // sequential-scanned all 57,591 published clinics building a geography per
    // row. Measured on staging 2026-09-05 for a 25-mile search around 77098:
    //
    //   top-124 by score   5,350ms Seq Scan  ->    70ms Index Scan
    //   count(*)           3,949ms Seq Scan  ->     5ms Index Scan
    //   rows returned      1,067 either way, identical
    //
    // It costs nothing semantically. A NULL coordinate makes ST_MakePoint NULL,
    // so ST_DWithin is NULL and the row was already excluded; a (0,0) row sits
    // in the Gulf of Guinea and is outside any US radius. The index was built on
    // exactly that reasoning, and this restates it where the planner can see it.
    const hasCoords =
      `${a}latitude IS NOT NULL AND ${a}longitude IS NOT NULL ` +
      `AND ${a}latitude <> 0 AND ${a}longitude <> 0`

    if (geoEnabled) {
      return {
        whereClause: `(${hasCoords} AND ST_DWithin(${clinicGeog(alias)}, geography(ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)), ${radiusMeters}))`,
        distExpr: clinicDistanceMeters(lat!, lng!, alias),
      }
    }

    // No PostGIS: there is no GIST index to unlock, so the bounding box does the
    // narrowing instead, off the plain latitude/longitude btrees, and the
    // haversine only refines what survives. Same reasoning as the listing radius
    // filter; see boundingBoxForRadius in search-sql.ts.
    const distExpr = clinicDistanceMetersHaversine(lat!, lng!, alias)
    const box = clinicBoundingBoxSql(lat!, lng!, radiusMeters / METERS_PER_MILE, alias)
    return { whereClause: `(${hasCoords} AND ${box} AND ${distExpr} <= ${radiusMeters})`, distExpr }
  }

  // ── Clinic candidate query ───────────────────────────────────────────────
  async function clinicCandidates(): Promise<{
    ids: number[]
    dist: Map<number, number>
    rank: Map<number, number>
    /** Clinics matching the filters. Equals ids.length on the unranked path. */
    total: number
  }> {
    const params: any[] = []
    const bind = (v: any) => {
      params.push(v)
      return `$${params.length}`
    }
    const tsqRef = tsquery ? bind(tsquery) : ''
    const where: string[] = ["c.status = 'published'"]
    if (treatmentId !== undefined) {
      // The clinic's OWN offered services (clinics_rels), not its providers'.
      // Clinics carry servicesOffered directly; filtering through providers
      // returned nothing (there are no providers yet) so every clinic was dropped.
      where.push(
        `EXISTS (SELECT 1 FROM clinics_rels cr WHERE cr.parent_id = c.id AND cr.path = 'servicesOffered' AND cr.services_id = ${bind(
          treatmentId,
        )})`,
      )
    }
    if (brandId !== undefined) {
      where.push(
        `EXISTS (SELECT 1 FROM clinics_rels cr WHERE cr.parent_id = c.id AND cr.path = 'brandsOffered' AND cr.brands_id = ${bind(
          brandId,
        )})`,
      )
    }
    if (tsquery) {
      where.push(`${clinicTsv('c')} @@ to_tsquery('english', ${tsqRef})`)
    }
    if (stateCode) where.push(`c.state = ${bind(stateCode)}`)
    // ILIKE, not lower(...) LIKE. Wrapping the column in lower() is exactly what
    // stops the gin_trgm_ops index on clinic city/neighborhood text from
    // applying, so this seq-scanned all 57,591 published clinics on every
    // city-name search. Measured on staging 2026-09-05 for '%houston%':
    // 763ms Seq Scan -> 237ms, returning the identical 454 rows both ways.
    // `cityLike` is already lowercased by the caller and ILIKE is
    // case-insensitive, so the comparison itself is unchanged. Same fix the
    // suggest route made for clinic_name on 2026-08-17.
    if (cityLike) where.push(`(c.city ILIKE ${bind(cityLike)} OR c.neighborhood ILIKE ${bind(cityLike)})`)
    const clinicGeo = geoSql('c')
    if (clinicGeo.whereClause) where.push(clinicGeo.whereClause)
    const distExpr = clinicGeo.distExpr
    const rankExpr = tsquery ? `ts_rank(${clinicTsv('c')}, to_tsquery('english', ${tsqRef}))` : 'NULL'
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    // Two candidate strategies.
    //
    // Default (unranked): take any CANDIDATE_CAP rows and let JS rank those.
    // For a filter matching more than the cap that is a ranking of an arbitrary
    // slice, and `total` is the cap rather than the real number of matches.
    //
    // SEARCH_RANKED_SQL=1: order the FULL match set by the same blended score
    // rankClinics uses (lib/search-ranking-sql.ts) and take only the rows this
    // page needs plus a margin, and count the matches for real. JS ranking still
    // runs afterwards and still decides the final order; see that file for why.
    const ranked = rankedSqlEnabled()
    const orderBy = ranked
      ? `ORDER BY ${blendedScoreSql('c', {
          distExpr: hasGeo ? distExpr : null,
          tsRankExpr: tsquery ? rankExpr : null,
        })} DESC, c.id DESC`
      : ''
    // Enough rows to fill the requested page, plus a margin so a float
    // difference between Postgres numeric and JS double can only ever reorder
    // rows near the fetch boundary, never rows the visitor sees. Still capped by
    // CANDIDATE_CAP so a deep page cannot ask for an unbounded set.
    const fetchLimit = ranked
      ? Math.min(CANDIDATE_CAP, page * limit + RANKED_FETCH_MARGIN)
      : CANDIDATE_CAP

    const sql = `SELECT c.id AS id, ${distExpr} AS dist_m, ${rankExpr} AS text_rank
                 FROM clinics c
                 ${whereSql}
                 ${orderBy}
                 LIMIT ${fetchLimit}`
    const res = await pool.query(sql, params)
    const dist = new Map<number, number>()
    const rank = new Map<number, number>()
    const ids: number[] = []
    for (const row of res.rows) {
      const id = Number(row.id)
      ids.push(id)
      if (row.dist_m != null) dist.set(id, Number(row.dist_m))
      if (row.text_rank != null) rank.set(id, Number(row.text_rank))
    }

    // The real match count. Measured on production for the largest filter
    // (q=botox, 51,074 matches): 72ms server-side, so this is cheap enough to
    // run per search and is what stops the UI reporting "3000" for everything.
    let total = ids.length
    if (ranked) {
      const countRes = await pool.query(
        `SELECT count(*)::int AS n FROM clinics c ${whereSql}`,
        params,
      )
      total = Number(countRes.rows[0]?.n ?? ids.length)
    }

    return { ids, dist, rank, total }
  }

  // ── Hydrate + rank one pass ──────────────────────────────────────────────
  async function runPass(): Promise<{ clinics: SearchClinic[]; clinicTotal: number }> {
    let clinics: SearchClinic[] = []
    let clinicTotal = 0
    {
      const { ids, dist, rank, total } = await clinicCandidates()
      clinicTotal = total
      if (ids.length) {
        // Two ways to turn candidate ids into rows, same fields either way.
        // The lean path skips payload.find's unconditional relationship joins,
        // which are the whole cost of a broad search. Opt-in via
        // SEARCH_LEAN_HYDRATE=1; unset keeps the original path. See
        // lib/search-hydrate.ts for the measurements and the field parity list.
        const docs: any[] = leanHydrationEnabled()
          ? await leanHydrateClinics(pool, ids)
          : ((
              await payload.find({
                collection: 'clinics',
                where: { id: { in: ids } },
                depth: 0,
                limit: ids.length,
              })
            ).docs as any[])
        const mapped = docs.map((c) =>
          mapClinic(c, slugMap, 0, toMiles(dist.get(Number(c.id))), rank.get(Number(c.id))),
        )
        clinics = rankClinics(mapped, { useDistance: hasGeo, useText: !!tsquery }).slice(
          (page - 1) * limit,
          page * limit,
        )
      }
    }

    return { clinics, clinicTotal }
  }

  let pass = await runPass()

  // ── Place-name fallback ──────────────────────────────────────────────────
  // If a single free-text phrase matched no clinics by NAME, and
  // nothing else resolved (no treatment/location/zip/coords), it may be a place we
  // have no name match for (e.g. "newport beach"). Geocode it ONCE and re-run as a
  // radius search. Gated on allowGeocode so the live panel never geocodes a name.
  if (
    allowGeocode &&
    freeText &&
    pass.clinicTotal === 0 &&
    treatmentId === undefined &&
    brandId === undefined &&
    !stateCode &&
    !cityLike &&
    !hasGeo
  ) {
    const hit = await geocode(freeText)
    if (hit) {
      lat = hit.lat
      lng = hit.lng
      hasGeo = true
      radiusMeters = (params.radiusMiles ?? FALLBACK_RADIUS_MILES) * METERS_PER_MILE
      tsquery = '' // it was a place, not a name
      locationLabel = hit.label
      pass = await runPass()
    }
  }

  return {
    clinics: pass.clinics,
    serviceLabel: treatmentLabel,
    brandLabel,
    locationLabel,
    clinicTotal: pass.clinicTotal,
    page,
    limit,
    center: hasGeo ? { lat: lat!, lng: lng! } : null,
  }
}

/**
 * Brand + Service option lists for the /search page's filter sidebar (the same
 * `ListingFilters` component the FIND-path state/city hubs use — see
 * lib/location-queries.ts's StateHubData for the identical fetch shape).
 */
export type SearchFilterOptions = {
  brandOptions: { id: string; name: string }[]
  serviceOptions: { id: string; name: string }[]
}

/**
 * Memoised: the same two lists for every visitor, re-queried on every search
 * before 2026-09-05. See lib/ttl-memo.ts. Bypass with SEARCH_OPTION_CACHE=0.
 */
export const getSearchFilterOptions = ttlMemo(
  async function getSearchFilterOptions(): Promise<SearchFilterOptions> {
    const payload = await getPayloadInstance()
    const [brandsRes, servicesRes] = await Promise.all([
      payload.find({ collection: 'brands', limit: 100, depth: 0, sort: 'name' }),
      payload.find({ collection: 'services', limit: 100, depth: 0, sort: 'name' }),
    ])
    return {
      brandOptions: (brandsRes.docs as any[]).map((b) => ({ id: String(b.id), name: b.name })),
      serviceOptions: (servicesRes.docs as any[]).map((s) => ({ id: String(s.id), name: s.name })),
    }
  },
)

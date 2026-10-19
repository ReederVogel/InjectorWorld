import { getPayloadInstance } from './payload-server'

export type LocationSlugEntry = { citySlug: string; stateSlug: string }

type LocationRow = { name: string; slug: string; state: string | null; kind: string | null }

let _cache: Map<string, LocationSlugEntry> | null = null
let _cachedAt = 0

/**
 * 10 minutes, up from 60 seconds (2026-08-17).
 *
 * This map is on the hot path of every listing route and the search typeahead,
 * and it is derived from Locations, which change on import or via the admin,
 * not per request. At 60s a low-traffic instance rebuilt it constantly: staging
 * "load more" timings swung between 1.8s and 3.9s depending on whether the
 * request happened to be the one that paid for the rebuild.
 *
 * The cost of staleness is bounded and small: a city added in the last 10
 * minutes falls back to the kebab-cased slug in lookupSlugs() below, which is
 * what the auto-created Location's slug would be anyway.
 */
const CACHE_TTL = 10 * 60_000

export async function getLocationSlugMap(): Promise<Map<string, LocationSlugEntry>> {
  if (_cache && Date.now() - _cachedAt < CACHE_TTL) return _cache

  const payload = await getPayloadInstance()

  // Raw SQL, not payload.find(). payload.find() on 'locations' joins in every
  // relationship and array field regardless of `depth`, and there are ~4,280
  // rows. This needs four columns. Same reasoning as lib/lean-clinic-listing.ts.
  //
  // The ORDER BY is NOT cosmetic and must stay. Two Locations can still
  // normalise to the same key, because the loop below strips a trailing
  // " City": today "Union City" and "Union" (NJ), two real towns, both reduce
  // to `union,nj`. The last row written wins, so row order decides which slug
  // their clinics get in their URLs. `created_at DESC, id DESC` keeps that
  // choice fixed; without it Postgres is free to return either row last and
  // the URLs flip silently.
  //
  // The NYC duplicate ("New York City" id 51 vs "New York" id 962, both
  // `new york,ny`) was merged on 2026-10-19 by
  // scripts/fix-nyc-duplicate-location.sql.
  const pool = (payload.db as any).pool
  const res = await pool.query(
    `SELECT name, slug, state, kind::text AS kind
       FROM locations
      WHERE slug IS NOT NULL AND slug <> ''
        AND kind IN ('state', 'metro', 'city')
      ORDER BY created_at DESC, id DESC`,
  )
  const rows = res.rows as LocationRow[]

  const stateCodeToSlug = new Map<string, string>()
  const map = new Map<string, LocationSlugEntry>()

  for (const loc of rows) {
    if (loc.kind === 'state' && loc.state) {
      stateCodeToSlug.set(loc.state.toUpperCase(), loc.slug)
    }
  }

  for (const loc of rows) {
    if (loc.kind === 'metro' || loc.kind === 'city') {
      const stateCode = loc.state ?? ''
      const stateSlug = stateCodeToSlug.get(stateCode.toUpperCase()) ?? ''
      const cityName = (loc.name ?? '').replace(/\s+city$/i, '').trim().toLowerCase()
      const key = `${cityName},${stateCode.toLowerCase()}`
      map.set(key, { citySlug: loc.slug, stateSlug })
    }
  }

  _cache = map
  _cachedAt = Date.now()
  return map
}

export function lookupSlugs(
  city: string,
  state: string,
  slugMap: Map<string, LocationSlugEntry>,
): LocationSlugEntry {
  const cityName = city.replace(/\s+city$/i, '').trim().toLowerCase()
  const key = `${cityName},${state.toLowerCase()}`
  return (
    slugMap.get(key) ?? {
      citySlug: city
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, ''),
      stateSlug: state.toLowerCase(),
    }
  )
}

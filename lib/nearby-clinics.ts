/**
 * Nearest published clinics to a point, for the homepage "Featured Clinics"
 * personalization. Reuses the same PostGIS-availability check and Haversine
 * fallback as lib/search-queries.ts (search-sql.ts): the production DB
 * (DigitalOcean Managed Postgres) does not have PostGIS installed, so this
 * always runs the plain-SQL distance formula there. If PostGIS is ever
 * enabled, ST_DWithin/ST_Distance kick in automatically, no code change.
 */
import { getPayloadInstance } from './payload-server'
import { getLocationSlugMap, lookupSlugs } from './location-slug-lookup'
import { rankClinics } from './ranking'
import type { SearchClinic } from './search-queries'
import {
  clinicGeog,
  clinicDistanceMeters,
  clinicDistanceMetersHaversine,
  METERS_PER_MILE,
} from './search-sql'

let _postgisAvailable: boolean | null = null
async function isPostGisAvailable(pool: any): Promise<boolean> {
  if (_postgisAvailable !== null) return _postgisAvailable
  try {
    const res = await pool.query(`SELECT 1 FROM pg_proc WHERE proname = 'st_dwithin' LIMIT 1`)
    _postgisAvailable = res.rows.length > 0
  } catch {
    _postgisAvailable = false
  }
  return _postgisAvailable
}

// Widen the radius until there's enough of a pool to rank, or we run out of steps.
const RADIUS_STEPS_MILES = [25, 50, 100]
const CANDIDATE_BUFFER = 30

function mapRow(
  c: any,
  slugMap: Map<string, { citySlug: string; stateSlug: string }>,
  providerCount: number,
  distanceMiles: number,
): SearchClinic {
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
    clinicType: c.clinicType ?? undefined,
    startingPrice: c.startingPrice ?? undefined,
    distanceMiles,
  }
}

export async function getNearbyClinics(lat: number, lng: number, limit = 6): Promise<SearchClinic[]> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return []

  const payload = await getPayloadInstance()
  const pool = (payload.db as any).pool
  const geoEnabled = await isPostGisAvailable(pool)

  let bestRows: { id: number; distMeters: number }[] = []
  for (const radiusMiles of RADIUS_STEPS_MILES) {
    const radiusMeters = radiusMiles * METERS_PER_MILE
    const distExpr = geoEnabled ? clinicDistanceMeters(lat, lng, 'c') : clinicDistanceMetersHaversine(lat, lng, 'c')
    const whereClause = geoEnabled
      ? `ST_DWithin(${clinicGeog('c')}, geography(ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)), ${radiusMeters})`
      : `${distExpr} <= ${radiusMeters}`

    const sql = `SELECT c.id AS id, ${distExpr} AS dist_m
                 FROM clinics c
                 WHERE c.status = 'published' AND ${whereClause}
                 ORDER BY dist_m ASC
                 LIMIT ${CANDIDATE_BUFFER}`
    const res = await pool.query(sql)
    const rows = res.rows.map((r: any) => ({ id: Number(r.id), distMeters: Number(r.dist_m) }))
    if (rows.length > bestRows.length) bestRows = rows
    if (rows.length >= limit) break
  }

  if (bestRows.length === 0) return []

  const ids = bestRows.map((r) => r.id)
  const distByClinic = new Map(bestRows.map((r) => [r.id, r.distMeters / METERS_PER_MILE]))

  // No provider lookup here any more. The `providers` collection and its table
  // were removed, and this query (`SELECT ... FROM providers`) had no catch
  // around it, so every call threw "relation providers does not exist" and took
  // the homepage's Featured Clinics section down with it.
  //
  // `providerCount` stays on SearchClinic because the type is shared, but it is
  // 0 here exactly as it already is at every other call site that builds one
  // (lib/clinic-queries.ts, lib/lean-clinic-listing.ts, lib/brand-queries.ts).

  const res = await payload.find({
    collection: 'clinics',
    where: { id: { in: ids } },
    depth: 0,
    limit: ids.length,
  })

  const slugMap = await getLocationSlugMap()
  const mapped = (res.docs as any[])
    .filter((c) => c.city && c.state)
    .map((c) => mapRow(c, slugMap, 0, distByClinic.get(Number(c.id)) ?? 0))

  return rankClinics(mapped, { useDistance: true }).slice(0, limit)
}

/**
 * Geo-aware ZIP featuring resolution (Phase 14).
 *
 * Finds active Promotions with scopeType 'zip' or 'treatment+zip' whose ZIP
 * centroid is within the promotion's own zipRadiusMiles of the searched point.
 * Uses ST_DWithin on the zip_codes geography for the check.
 *
 * Returns a Map<providerId (string), rank> for use in rankProviders.
 */
import { METERS_PER_MILE } from './search-sql'

export async function getZipFeaturedProviders(
  lat: number,
  lng: number,
  pool: any,
  treatmentId?: number,
): Promise<Map<string, number>> {
  const result = new Map<string, number>()

  try {
    const now = new Date().toISOString()

    // Raw SQL join across promotions + zip_codes using PostGIS ST_DWithin.
    // The promo's "coverage area" is a circle of radius zipRadiusMiles around
    // the ZIP centroid. If the searched point is inside that circle, the promo
    // fires (provider is eligible for float-to-top).
    //
    // Outer join to zip_codes by zip_scope: if the ZIP no longer exists in the
    // dataset the row is excluded (zc.lat will be NULL).
    //
    // Only placement='sponsored-card' and 'organic-pin' attach to a provider
    // (banners have no provider). We surface sponsored-card promos here so the
    // geo-aware ZIP featuring can float them exactly like non-geo sponsorships.
    const params: any[] = [lat, lng, now]
    let treatmentFilter = ''
    if (treatmentId !== undefined) {
      params.push(treatmentId)
      treatmentFilter = `AND (p.treatment_scope_id IS NULL OR p.treatment_scope_id = $${params.length})`
    }

    const sql = `
      SELECT
        p.provider_id      AS provider_id,
        p.rank             AS rank,
        p.placement        AS placement,
        p.zip_radius_miles AS radius_miles
      FROM promotions p
      JOIN zip_codes zc ON zc.zip = p.zip_scope
      WHERE
        p.scope_type IN ('zip', 'treatment+zip')
        AND p.active = true
        AND (p.end_date IS NULL OR p.end_date > $3::timestamptz)
        AND p.provider_id IS NOT NULL
        AND zc.lat IS NOT NULL
        AND zc.lng IS NOT NULL
        AND p.zip_radius_miles IS NOT NULL
        AND ST_DWithin(
          geography(ST_SetSRID(ST_MakePoint(zc.lng, zc.lat), 4326)),
          geography(ST_SetSRID(ST_MakePoint($2, $1), 4326)),
          p.zip_radius_miles * ${METERS_PER_MILE}
        )
        ${treatmentFilter}
      ORDER BY p.rank ASC NULLS LAST
    `

    const res = await pool.query(sql, params)

    for (const row of res.rows) {
      if (!row.provider_id) continue
      const key = String(row.provider_id)
      // First promo win (lowest rank) wins if a provider has multiple zip promos.
      if (!result.has(key)) {
        result.set(key, Number(row.rank ?? 1))
      }
    }
  } catch (err: any) {
    // If PostGIS is absent (rare) or the query errors, degrade gracefully.
    console.warn('[zip-promotion-queries] ZIP featuring query failed (non-fatal):', err.message)
  }

  return result
}

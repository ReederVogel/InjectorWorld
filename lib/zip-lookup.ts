/**
 * Offline ZIP code resolution against the zip_codes table (seeded from GeoNames).
 * Used in search-queries.ts as the first-pass resolver before the network geocoder.
 */

export type ZipCentroid = {
  zip: string
  city: string
  state: string
  lat: number
  lng: number
  label: string
}

/**
 * Resolve a 5-digit ZIP to its GeoNames centroid via the local zip_codes table.
 * Returns null if the ZIP is not in the dataset (fall back to geocoder).
 */
export async function lookupZip(zip: string, pool: any): Promise<ZipCentroid | null> {
  if (!/^\d{5}$/.test(zip)) return null
  try {
    const res = await pool.query(
      `SELECT zip, city, state, lat, lng FROM zip_codes WHERE zip = $1 LIMIT 1`,
      [zip],
    )
    if (!res.rows.length) return null
    const r = res.rows[0]
    return {
      zip: String(r.zip),
      city: String(r.city),
      state: String(r.state),
      lat: Number(r.lat),
      lng: Number(r.lng),
      label: `${r.zip}, ${r.city}, ${r.state}`,
    }
  } catch {
    return null
  }
}

/**
 * Prefix-match on ZIP digits: returns up to `limit` ZIPs whose code starts
 * with the given prefix. Used by the /api/search/suggest endpoint.
 */
export async function suggestZips(
  prefix: string,
  pool: any,
  limit = 5,
): Promise<{ zip: string; city: string; state: string }[]> {
  if (!prefix || !/^\d+$/.test(prefix)) return []
  try {
    const res = await pool.query(
      `SELECT zip, city, state FROM zip_codes
       WHERE zip LIKE $1
       ORDER BY zip
       LIMIT $2`,
      [`${prefix}%`, limit],
    )
    return res.rows.map((r: any) => ({
      zip: String(r.zip),
      city: String(r.city),
      state: String(r.state),
    }))
  } catch {
    return []
  }
}

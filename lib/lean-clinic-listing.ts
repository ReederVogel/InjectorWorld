/**
 * Shared lean clinic-listing fetch, raw SQL instead of payload.find().
 *
 * Why: payload.find() on 'clinics' always joins in every relationship/array
 * field (brandsOffered, servicesOffered, languages, clinicPhotoUrls,
 * sourceUrls) regardless of `depth`, because those live in child tables and
 * Payload's Postgres adapter fetches the raw relation rows unconditionally.
 * For a brand/service page with no location filter, that means sorting and
 * joining across every matching clinic (thousands, for a popular brand like
 * Botox) before the LIMIT trims it down. This mirrors the fix already
 * verified in lib/hero-queries.ts: select only the columns mapClinic()
 * actually uses, and only join relations for the clinics that already won
 * the ORDER BY + LIMIT (via clinics_status_rating_idx), not the whole
 * matching set.
 */

export type LeanClinicRow = {
  id: number
  clinic_name: string
  slug: string
  tagline: string | null
  city: string
  state: string
  neighborhood: string | null
  aggregate_rating: number | null
  aggregate_rating_count: number | null
  service_type: string
  year_established: number | null
  latitude: number | null
  longitude: number | null
  clinic_type: string | null
  starting_price: number | null
  photo_url: string | null
  brands_offered: number[]
  services_offered: number[]
  /** Only populated when `includeLanguages` is set; otherwise absent. */
  languages?: string[]
}

export async function fetchLeanClinics(
  pool: any,
  opts: {
    relFilter?: { path: 'brandsOffered' | 'servicesOffered'; id: number }
    stateCode?: string
    cityLike?: string
    limit: number
    offset?: number
    /**
     * Opt-in: also pull the clinics_languages join rows. Off by default so the
     * existing page callers (which never render languages) keep the exact query
     * shape they were tuned with. Like the brands/services aggregates, this is
     * a correlated subquery over the already-LIMITed set, so the cost is
     * bounded by page size rather than by the number of matching clinics.
     */
    includeLanguages?: boolean
  },
): Promise<{ rows: LeanClinicRow[]; totalCount: number }> {
  const conditions: string[] = [`c.status = 'published'`]
  const params: unknown[] = []

  if (opts.relFilter) {
    params.push(opts.relFilter.id)
    const col = opts.relFilter.path === 'brandsOffered' ? 'brands_id' : 'services_id'
    conditions.push(
      `EXISTS (SELECT 1 FROM clinics_rels cr WHERE cr.parent_id = c.id AND cr.${col} = $${params.length})`,
    )
  }
  if (opts.stateCode) {
    params.push(opts.stateCode)
    conditions.push(`c.state = $${params.length}`)
  }
  if (opts.cityLike) {
    params.push(opts.cityLike)
    conditions.push(`c.city ILIKE $${params.length}`)
  }

  const where = conditions.join(' AND ')
  const limit = opts.limit
  const offset = opts.offset ?? 0
  params.push(limit, offset)

  const res = await pool.query(
    `
    WITH matched AS (
      SELECT c.id, c.clinic_name, c.slug, c.tagline, c.city, c.state, c.neighborhood,
             c.aggregate_rating, c.aggregate_rating_count, c.service_type,
             c.year_established, c.latitude, c.longitude, c.clinic_type, c.starting_price,
             c.created_at
        FROM clinics c
       WHERE ${where}
       ORDER BY c.aggregate_rating_count DESC, c.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}
    )
    SELECT m.*,
           (SELECT cpu.url FROM clinics_clinic_photo_urls cpu
             WHERE cpu._parent_id = m.id ORDER BY cpu._order ASC LIMIT 1) AS photo_url,
           COALESCE(
             (SELECT array_agg(cr.brands_id ORDER BY cr."order")
                FROM clinics_rels cr WHERE cr.parent_id = m.id AND cr.path = 'brandsOffered'),
             ARRAY[]::int[]
           ) AS brands_offered,
           COALESCE(
             (SELECT array_agg(cr.services_id ORDER BY cr."order")
                FROM clinics_rels cr WHERE cr.parent_id = m.id AND cr.path = 'servicesOffered'),
             ARRAY[]::int[]
           ) AS services_offered${
             opts.includeLanguages
               ? `,
           COALESCE(
             (SELECT array_agg(cl.value::text ORDER BY cl."order")
                FROM clinics_languages cl WHERE cl.parent_id = m.id AND cl.value IS NOT NULL),
             ARRAY[]::text[]
           ) AS languages`
               : ''
           }
      FROM matched m
     ORDER BY m.aggregate_rating_count DESC, m.created_at DESC
    `,
    params,
  )

  // Exact total count for pagination -- same filter, no ORDER BY/LIMIT needed.
  const countParams = params.slice(0, params.length - 2)
  const countRes = await pool.query(
    `SELECT count(*)::int AS n FROM clinics c WHERE ${where}`,
    countParams,
  )

  return { rows: res.rows, totalCount: countRes.rows[0]?.n ?? 0 }
}

/**
 * node-postgres hands back Postgres `numeric` columns as STRINGS (to avoid the
 * precision loss of a JS float), so `aggregate_rating` arrives as "4.2", not 4.2.
 * payload.find() coerced these for us; raw SQL does not. Consumers treat them as
 * numbers — `aggregateRating.toFixed(1)` in DirectoryClinicCard threw
 * "toFixed is not a function" and killed the build on the first service page it
 * pre-rendered. Coerce here, at the single boundary between SQL and the app.
 */
export function num(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export function leanRowToMapClinicInput(row: LeanClinicRow): any {
  return {
    id: row.id,
    clinicName: row.clinic_name,
    slug: row.slug,
    tagline: row.tagline,
    city: row.city,
    state: row.state,
    neighborhood: row.neighborhood,
    aggregateRating: num(row.aggregate_rating),
    aggregateRatingCount: num(row.aggregate_rating_count),
    serviceType: row.service_type,
    yearEstablished: num(row.year_established),
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    clinicType: row.clinic_type,
    startingPrice: num(row.starting_price),
    clinicPhotoUrls: row.photo_url ? [{ url: row.photo_url }] : [],
    brandsOffered: row.brands_offered,
    servicesOffered: row.services_offered,
  }
}

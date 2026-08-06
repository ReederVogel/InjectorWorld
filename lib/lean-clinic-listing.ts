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

export type LeanListingFilters = {
  brandIds?: number[]
  serviceIds?: number[]
  clinicTypes?: string[]
  minRating?: number
}

/** The clinic_type values the Clinics collection allows. Anything else in the
 *  query string is dropped rather than passed to SQL. */
const CLINIC_TYPES = ['medspa', 'dermatology', 'plastic-surgery', 'dental-aesthetics', 'other']

function idList(raw: string | null): number[] | undefined {
  if (!raw) return undefined
  const ids = raw
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
  return ids.length > 0 ? ids : undefined
}

/**
 * Reads the listing-filter query string that ListingFilters writes (brand, svc,
 * type, rating) into fetchLeanClinics options. Shared so every listing route
 * parses them identically, and so a junk value can never reach SQL: ids must be
 * positive integers, clinic types must be known, rating must be a real number.
 *
 * radius/lat/lng are deliberately not here. Distance still runs client-side
 * against the visitor's own coordinates.
 */
export function parseLeanListingFilters(searchParams: URLSearchParams): LeanListingFilters {
  const types = (searchParams.get('type') ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter((v) => CLINIC_TYPES.includes(v))

  const rating = Number(searchParams.get('rating'))

  return {
    brandIds: idList(searchParams.get('brand')),
    serviceIds: idList(searchParams.get('svc')),
    clinicTypes: types.length > 0 ? types : undefined,
    minRating: Number.isFinite(rating) && rating > 0 ? rating : undefined,
  }
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
     * Listing-filter params, added 2026-08-07. These used to run in the browser
     * over whatever page happened to be loaded (24 rows of up to 39,669), so
     * picking a brand almost always returned nothing. Doing them here means the
     * filter sees every matching clinic and totalCount stays truthful.
     *
     * brandIds / serviceIds are OR within a list and AND across the two, which
     * matches how the panel reads: "any of these brands" and "any of these
     * services". Both hit clinics_rels, the same table relFilter already uses.
     */
    brandIds?: number[]
    serviceIds?: number[]
    clinicTypes?: string[]
    minRating?: number
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
  if (opts.brandIds && opts.brandIds.length > 0) {
    params.push(opts.brandIds)
    conditions.push(
      `EXISTS (SELECT 1 FROM clinics_rels cr WHERE cr.parent_id = c.id AND cr.brands_id = ANY($${params.length}::int[]))`,
    )
  }
  if (opts.serviceIds && opts.serviceIds.length > 0) {
    params.push(opts.serviceIds)
    conditions.push(
      `EXISTS (SELECT 1 FROM clinics_rels cr WHERE cr.parent_id = c.id AND cr.services_id = ANY($${params.length}::int[]))`,
    )
  }
  if (opts.clinicTypes && opts.clinicTypes.length > 0) {
    params.push(opts.clinicTypes)
    // clinic_type is a Postgres enum (enum_clinics_clinic_type), so it has no
    // operator against text[]. Cast the column, not the array: casting the
    // array to the enum type would throw on any value the enum does not have,
    // and parseLeanListingFilters cannot guarantee that for a hand-typed URL.
    conditions.push(`c.clinic_type::text = ANY($${params.length}::text[])`)
  }
  if (opts.minRating != null) {
    params.push(opts.minRating)
    conditions.push(`c.aggregate_rating >= $${params.length}`)
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

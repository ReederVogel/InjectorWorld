/**
 * Lean hydration for search results (2026-09-04). OPT-IN, OFF BY DEFAULT.
 *
 * WHAT THIS REPLACES
 *
 * `searchDirectory()` turns its SQL candidate ids into result objects with:
 *
 *   payload.find({ collection: 'clinics', where: { id: { in: ids } }, limit: ids.length })
 *
 * `payload.find()` joins every relationship and array field on `clinics`
 * regardless of `depth`, because `depth` only controls whether RELATED DOCS are
 * populated, not whether the raw join happens. Measured on production for one
 * `q=botox` search (3,000 candidate ids, the CANDIDATE_CAP):
 *
 *   clinics rows                    3,000 rows   ~4.1 MB
 *   clinics_clinic_photo_urls      34,383 rows   ~6.1 MB
 *   clinics_rels                   58,137 rows   ~2.6 MB
 *
 * All of that is pulled, converted to JS objects, ranked, and then 24 rows are
 * kept. The candidate SQL that selects those 3,000 ids runs in 8ms; the
 * hydration is the entire cost of the request.
 *
 * WHAT THIS DOES INSTEAD
 *
 * One query that returns exactly the columns `mapClinic()` reads, plus the ONE
 * photo it uses and the relationship ids the client-side filters need. Same
 * rows, same fields, same values. Nothing is dropped and nothing is re-ordered
 * by this module, so `rankClinics()` receives the same input it always did.
 *
 * WHY THE SHAPE LOOKS LIKE A PAYLOAD DOC
 *
 * It returns camelCase objects with `clinicPhotoUrls: [{ url }]`, exactly what
 * `payload.find()` hands back, so `mapClinic()` in search-queries.ts does not
 * change at all. That keeps the diff at the call site to a single branch.
 *
 * FIELD PARITY (checked against lib/search-queries.ts mapClinic and the merit
 * scorer it feeds):
 *   ranking reads  -> aggregateRating, aggregateRatingCount, photoUrl, tagline,
 *                     providerCount (hardcoded 0 at the call site), distance, textRank
 *   UI reads       -> id, slug, clinicName, city, state, neighborhood,
 *                     latitude, longitude, brandsOffered, servicesOffered
 * Every one of those is selected below. `clinicType` and `startingPrice` are
 * optional on DirectoryClinic and are NOT read by mapClinic in search-queries.ts,
 * so they are deliberately not fetched.
 *
 * ENABLING IT
 *
 * Set SEARCH_LEAN_HYDRATE=1. Unset (the default) keeps the existing
 * payload.find() path byte for byte. Prove equivalence before flipping it
 * anywhere real:
 *
 *   npx tsx --env-file=.env.staging scripts/search-baseline.ts record --label before
 *   SEARCH_LEAN_HYDRATE=1 npx tsx --env-file=.env.staging scripts/search-baseline.ts record --label after
 *   npx tsx --env-file=.env.staging scripts/search-baseline.ts compare before after
 */

/** The subset of a Payload clinic doc that `mapClinic()` in search-queries.ts reads. */
export type LeanClinicDoc = {
  id: number
  slug: string
  clinicName: string
  tagline: string | null
  city: string | null
  state: string | null
  neighborhood: string | null
  aggregateRating: number | null
  aggregateRatingCount: number | null
  clinicPhotoUrls: { url: string }[]
  latitude: number | null
  longitude: number | null
  brandsOffered: number[]
  servicesOffered: number[]
}

/**
 * Fetch the display fields for a set of clinic ids.
 *
 * The three LATERAL subqueries each hit an existing index
 * (`clinics_clinic_photo_urls` on `_parent_id`, and the partial
 * `clinics_rels_brand_parent_idx` / `clinics_rels_service_parent_idx` composites
 * added on 2026-08-xx), so this stays an index walk rather than the wide joins
 * payload.find produces.
 *
 * The photo subquery is `ORDER BY _order LIMIT 1` because the old code read
 * `clinicPhotoUrls[0].url`, and Payload materialises that array in `_order`.
 * The relationship aggregates order by `"order"` then `id` for the same reason:
 * that is the sequence Payload returns them in, and `rankClinics` uses a stable
 * sort, so preserving it keeps tie ordering identical.
 *
 * `order` is a reserved word in SQL and must stay quoted.
 */
export async function leanHydrateClinics(pool: any, ids: number[]): Promise<LeanClinicDoc[]> {
  if (!ids.length) return []

  const res = await pool.query(
    `SELECT c.id,
            c.slug,
            c.clinic_name              AS "clinicName",
            c.tagline,
            c.city,
            c.state,
            c.neighborhood,
            c.aggregate_rating         AS "aggregateRating",
            c.aggregate_rating_count   AS "aggregateRatingCount",
            c.latitude,
            c.longitude,
            p.url                      AS "photoUrl",
            COALESCE(b.ids, ARRAY[]::int[]) AS "brandsOffered",
            COALESCE(s.ids, ARRAY[]::int[]) AS "servicesOffered"
       FROM clinics c
       LEFT JOIN LATERAL (
            SELECT ph.url
              FROM clinics_clinic_photo_urls ph
             WHERE ph._parent_id = c.id
             ORDER BY ph._order
             LIMIT 1
       ) p ON true
       LEFT JOIN LATERAL (
            SELECT array_agg(cr.brands_id ORDER BY cr."order", cr.id) AS ids
              FROM clinics_rels cr
             WHERE cr.parent_id = c.id
               AND cr.path = 'brandsOffered'
               AND cr.brands_id IS NOT NULL
       ) b ON true
       LEFT JOIN LATERAL (
            SELECT array_agg(cr.services_id ORDER BY cr."order", cr.id) AS ids
              FROM clinics_rels cr
             WHERE cr.parent_id = c.id
               AND cr.path = 'servicesOffered'
               AND cr.services_id IS NOT NULL
       ) s ON true
      WHERE c.id = ANY($1::int[])`,
    [ids],
  )

  return (res.rows as any[]).map((r) => ({
    id: Number(r.id),
    slug: r.slug,
    clinicName: r.clinicName,
    tagline: r.tagline,
    city: r.city,
    state: r.state,
    neighborhood: r.neighborhood,
    // Numeric columns arrive as strings from node-postgres; mapClinic passes
    // aggregateRating straight through to the merit scorer, which does numeric
    // comparisons, so they are coerced here exactly as Payload would.
    aggregateRating: r.aggregateRating == null ? null : Number(r.aggregateRating),
    aggregateRatingCount: r.aggregateRatingCount == null ? null : Number(r.aggregateRatingCount),
    // Shaped as the array field, so mapClinic's `c.clinicPhotoUrls?.[0]?.url`
    // works unchanged. Empty array when the clinic has no photo, which is what
    // makes the merit scorer's noPhoto penalty fire identically.
    clinicPhotoUrls: r.photoUrl ? [{ url: r.photoUrl }] : [],
    latitude: r.latitude == null ? null : Number(r.latitude),
    longitude: r.longitude == null ? null : Number(r.longitude),
    brandsOffered: (r.brandsOffered ?? []).map(Number),
    servicesOffered: (r.servicesOffered ?? []).map(Number),
  }))
}

/** Whether the lean path is enabled. Off unless SEARCH_LEAN_HYDRATE=1. */
export function leanHydrationEnabled(): boolean {
  return process.env.SEARCH_LEAN_HYDRATE === '1'
}

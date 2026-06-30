/**
 * Shared raw-SQL fragments for search (Phase 5, expanded in Phase 13).
 *
 * The full-text and geography expressions here MUST match the ones indexed by
 * `scripts/setup-search-indexes.ts`, or Postgres cannot use the GIN / GIST
 * indexes. They are defined once here and imported by both the index script and
 * the query layer (`lib/search-queries.ts`).
 *
 * Functions take a table alias so the same expression works both in the index
 * (qualified with the real table name) and in a multi-table join query (qualified
 * with a short alias). Postgres resolves either to the same column Var, so the
 * index still applies.
 *
 * Phase 13: the tsvectors are now WEIGHTED (setweight A>B>C>D) so ts_rank can
 * order matches by where the hit landed (a name hit beats an address hit). The
 * clinic document gained the address columns (real columns on `clinics`).
 * Provider treatments / specialties / languages live in SEPARATE tables, so they
 * cannot go into an expression index on `providers`; they are denormalized into an
 * isolated `search.provider_doc` tsvector table instead (see providerDocTsv +
 * scripts/setup-search-indexes.ts). No public-schema column is added, so `db:push`
 * leaves everything alone and the whole thing is reversible by dropping the table.
 */

/**
 * Provider in-row full-text document (columns that live on the `providers` row).
 * Weighted: A = full name (highest), B = title + tagline, C = bio.
 */
export function providerTsv(alias = 'providers'): string {
  const a = alias ? `${alias}.` : ''
  return `(
    setweight(to_tsvector('english', coalesce(${a}full_name,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(${a}title,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(${a}tagline,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(${a}bio,'')), 'C'))`
}

/**
 * Clinic full-text document. Weighted: A = clinic name, B = tagline,
 * C = neighborhood + city, D = street address + state + zip + county.
 * All of these are real columns on the `clinics` table.
 */
export function clinicTsv(alias = 'clinics'): string {
  const a = alias ? `${alias}.` : ''
  return `(
    setweight(to_tsvector('english', coalesce(${a}clinic_name,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(${a}tagline,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(${a}neighborhood,'')), 'C') ||
    setweight(to_tsvector('english', coalesce(${a}city,'')), 'C') ||
    setweight(to_tsvector('english', coalesce(${a}address_line1,'')), 'D') ||
    setweight(to_tsvector('english', coalesce(${a}state,'')), 'D') ||
    setweight(to_tsvector('english', coalesce(${a}zip,'')), 'D') ||
    setweight(to_tsvector('english', coalesce(${a}county,'')), 'D'))`
}

/**
 * Provider "extra" full-text document, built from relationship/array fields that
 * are NOT columns on the providers row: treatments offered, specialties, and
 * languages. Weighted A > B > C in that order (a treatment typed as free text
 * should match strongly). This same expression is used two ways so the index
 * content stays consistent:
 *   - the full rebuild in setup-search-indexes.ts passes SQL join expressions
 *   - the freshness hook (lib/search-doc.ts) passes bind-parameter placeholders
 * Pass each argument as a SQL text expression (e.g. "coalesce(t.names,'')" or
 * "$2").
 */
export function providerDocTsv(treatments: string, specialties: string, languages: string): string {
  return (
    `setweight(to_tsvector('english', ${treatments}), 'A') || ` +
    `setweight(to_tsvector('english', ${specialties}), 'B') || ` +
    `setweight(to_tsvector('english', ${languages}), 'C')`
  )
}

/** PostGIS geography point from a clinic's lat/lng (lng, lat order). */
export function clinicGeog(alias = 'clinics'): string {
  const a = alias ? `${alias}.` : ''
  return `geography(ST_SetSRID(ST_MakePoint(${a}longitude::double precision, ${a}latitude::double precision), 4326))`
}

/**
 * Great-circle distance in METERS from a clinic to a point.
 * `lat`/`lng` are interpolated as numeric literals (already validated/parsed by
 * the caller), never raw user text, so this is injection-safe.
 */
export function clinicDistanceMeters(lat: number, lng: number, alias = 'clinics'): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Invalid coordinates: lat=' + lat + ' lng=' + lng)
  }
  // Interpolated directly — must be validated numbers, never raw user strings.
  return `ST_Distance(${clinicGeog(alias)}, geography(ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)))`
}

/**
 * Great-circle distance in METERS from a clinic to a point, computed with the
 * Haversine formula directly on the `latitude`/`longitude` columns. No PostGIS
 * required — this is the fallback used when the `postgis` extension is not
 * available on the database (confirmed unavailable, not just uninstalled, on
 * the current DigitalOcean managed Postgres cluster). At directory scale
 * (~10-15k clinics) an unindexed scan computing this per row is trivial; if
 * PostGIS ever becomes available, search-queries.ts prefers ST_Distance instead.
 *
 * `lat`/`lng` are interpolated as numeric literals (already validated/parsed by
 * the caller), never raw user text, so this is injection-safe — same contract
 * as clinicDistanceMeters above.
 */
export function clinicDistanceMetersHaversine(lat: number, lng: number, alias = 'clinics'): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Invalid coordinates: lat=' + lat + ' lng=' + lng)
  }
  const a = alias ? `${alias}.` : ''
  const EARTH_RADIUS_METERS = 6371000
  return `(
    ${EARTH_RADIUS_METERS} * acos(
      LEAST(1.0, GREATEST(-1.0,
        cos(radians(${lat})) * cos(radians(${a}latitude::double precision)) *
        cos(radians(${a}longitude::double precision) - radians(${lng})) +
        sin(radians(${lat})) * sin(radians(${a}latitude::double precision))
      ))
    )
  )`
}

/** Table-qualified constants used by the index-creation script. */
export const PROVIDER_TSV = providerTsv('providers')
export const CLINIC_TSV = clinicTsv('clinics')
export const CLINIC_GEOG = clinicGeog('clinics')

/** Meters per mile (search radius is expressed in miles). */
export const METERS_PER_MILE = 1609.344

/**
 * Build a prefix tsquery string from free-text input, for partial-word matching.
 * "lena park" -> "lena:* & park:*". We construct it from sanitized tokens rather
 * than passing user text to to_tsquery() (which throws on malformed syntax).
 * Returns '' when there is nothing searchable.
 */
export function toPrefixTsQuery(input: string): string {
  const tokens = (input || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
  if (tokens.length === 0) return ''
  return tokens.map((t) => `${t}:*`).join(' & ')
}

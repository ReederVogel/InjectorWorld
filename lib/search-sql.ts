/**
 * Shared raw-SQL fragments for Phase 5 search.
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
 */

/** Columns folded into the provider full-text document. */
export function providerTsv(alias = 'providers'): string {
  const a = alias ? `${alias}.` : ''
  return `to_tsvector('english',
    coalesce(${a}full_name,'') || ' ' ||
    coalesce(${a}title,'') || ' ' ||
    coalesce(${a}tagline,'') || ' ' ||
    coalesce(${a}bio,''))`
}

/** Columns folded into the clinic full-text document. */
export function clinicTsv(alias = 'clinics'): string {
  const a = alias ? `${alias}.` : ''
  return `to_tsvector('english',
    coalesce(${a}clinic_name,'') || ' ' ||
    coalesce(${a}tagline,'') || ' ' ||
    coalesce(${a}neighborhood,'') || ' ' ||
    coalesce(${a}city,''))`
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
  return `ST_Distance(${clinicGeog(alias)}, geography(ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)))`
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

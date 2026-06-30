/** Coercion + normalization helpers for CSV import. */
import { lookupZip } from '../zip-lookup'

export type Row = Record<string, string>

export function str(v: string | undefined): string | undefined {
  if (v == null) return undefined
  const t = String(v).trim()
  return t === '' ? undefined : t
}

export function num(v: string | undefined): number | undefined {
  const s = str(v)
  if (s === undefined) return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

export function int(v: string | undefined): number | undefined {
  const n = num(v)
  return n === undefined ? undefined : Math.trunc(n)
}

export function bool(v: string | undefined, fallback = false): boolean {
  const s = str(v)?.toLowerCase()
  if (s === undefined) return fallback
  return s === 'true' || s === '1' || s === 'yes' || s === 'y'
}

export function isoDate(v: string | undefined): string | undefined {
  const s = str(v)
  if (s === undefined) return undefined
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

/** Split a semicolon list into trimmed non-empty parts. */
export function list(v: string | undefined): string[] {
  const s = str(v)
  if (s === undefined) return []
  return s
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean)
}

/** Semicolon list -> array of { [key]: value } (Payload array field shape). */
export function listOfObj(v: string | undefined, key: string): Array<Record<string, string>> {
  return list(v).map((value) => ({ [key]: value }))
}

/** A US ZIP is 5 digits, optionally + 4 (ZIP+4). */
export function isValidZip(v: string | undefined): boolean {
  const s = str(v)
  if (s === undefined) return true // missing is handled elsewhere; only flag present-but-malformed
  return /^\d{5}(-\d{4})?$/.test(s)
}

/**
 * Cross-validate a ZIP against the offline `zip_codes` table (GeoNames): does the
 * ZIP exist, and if so does its real city/state match what the row claims? Catches
 * "Houston, TX" with a Newark ZIP, which the format-only `isValidZip()` cannot.
 * Returns null when the ZIP is missing/malformed (nothing to cross-check) or when
 * it matches; otherwise a short reason string for the alert message.
 */
export async function validateZipLocation(
  zip: string | undefined,
  city: string | undefined,
  state: string | undefined,
  pool: any,
): Promise<string | null> {
  const z = str(zip)
  if (!z || !/^\d{5}$/.test(z)) return null
  const hit = await lookupZip(z, pool)
  if (!hit) return `ZIP ${z} was not found in the zip_codes reference table`
  if (!city || !state) return null
  const cityMatches = normalizeCity(hit.city) === normalizeCity(city)
  const stateMatches = hit.state.toUpperCase() === state.toUpperCase()
  if (cityMatches && stateMatches) return null
  return `ZIP ${z} resolves to ${hit.city}, ${hit.state} but the row says ${city}, ${state}`
}

/** Latitude must be -90..90, longitude -180..180. */
export function isValidLat(n: number | undefined): boolean {
  return n === undefined || (n >= -90 && n <= 90)
}
export function isValidLng(n: number | undefined): boolean {
  return n === undefined || (n >= -180 && n <= 180)
}

/**
 * Normalize a US phone to E.164 ("+1XXXXXXXXXX") when confidently a 10-digit
 * (or 1 + 10) US number. Returns { value, valid }: `value` is the normalized
 * string (or the trimmed original when it can't be normalized) and `valid` is
 * whether it is already a clean E.164-looking US number or was normalizable.
 */
export function normalizePhone(v: string | undefined): { value: string | undefined; valid: boolean } {
  const s = str(v)
  if (s === undefined) return { value: undefined, valid: true }
  const digits = s.replace(/\D/g, '')
  if (digits.length === 10) return { value: `+1${digits}`, valid: true }
  if (digits.length === 11 && digits.startsWith('1')) return { value: `+${digits}`, valid: true }
  // Not a clean US number — keep the original text, flag as invalid.
  return { value: s, valid: false }
}

export function kebab(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function providerSlug(fullName: string, credentials: string, city: string | undefined): string {
  const parts = [kebab(fullName), credentials.toLowerCase()]
  if (city) parts.push(kebab(city))
  return parts.filter(Boolean).join('-')
}

/**
 * Clinic slug = kebab(clinicName) + '-' + zip.
 * The ZIP suffix (not the city) keeps slugs stable and unique-ish across the
 * directory. Callers must still resolve collisions (same name + same zip) by
 * appending -2, -3, … — see clinic-slug.ts / the slug migration.
 */
export function clinicSlug(clinicName: string, zip: string | undefined): string {
  const z = String(zip ?? '').match(/\d{5}/)?.[0] ?? String(zip ?? '').trim()
  return [kebab(clinicName), z].filter(Boolean).join('-')
}

/** Comma or semicolon list -> trimmed non-empty parts. Handles both separators (URLs never contain , or ;). */
export function commaOrSemiList(v: string | undefined): string[] {
  const s = str(v)
  if (s === undefined) return []
  return s.split(/[,;]/).map((x) => x.trim()).filter(Boolean)
}

/** commaOrSemiList -> array of { [key]: value } (Payload array field shape). */
export function commaOrSemiListOfObj(v: string | undefined, key: string): Array<Record<string, string>> {
  return commaOrSemiList(v).map((value) => ({ [key]: value }))
}

/** Title-case a string: "lip filler" → "Lip Filler". */
export function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Normalize a city name for matching against Location records ("New York City" ~ "New York"). */
export function normalizeCity(s: string): string {
  return s
    .toLowerCase()
    .replace(/\bcity\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * CSV label -> canonical brand slug (product names: Botox, Juvederm, etc.)
 */
const BRAND_ALIASES: Record<string, string> = {
  botox: 'botox',
  dysport: 'dysport',
  xeomin: 'xeomin',
  jeuveau: 'jeuveau',
  daxxify: 'daxxify',
  juvederm: 'juvederm',
  restylane: 'restylane',
  sculptra: 'sculptra',
  radiesse: 'radiesse',
  kybella: 'kybella',
}

/** Set of canonical brand slugs for fast membership checks. */
export const BRAND_SLUGS = new Set(Object.values(BRAND_ALIASES))

/**
 * CSV label -> canonical service slug (body-area treatments: Lip Filler, Masseter Botox, etc.)
 */
const SERVICE_ALIASES: Record<string, string> = {
  'lip filler': 'lip-filler',
  lips: 'lip-filler',
  'cheek filler': 'cheek-filler',
  cheeks: 'cheek-filler',
  'jawline filler': 'jawline-filler',
  jawline: 'jawline-filler',
  'tear trough': 'tear-trough',
  'tear trough filler': 'tear-trough',
  'under eye': 'tear-trough',
  masseter: 'masseter-botox',
  'masseter botox': 'masseter-botox',
  'forehead botox': 'forehead-botox',
  forehead: 'forehead-botox',
  'brow lift': 'brow-lift',
  prp: 'prp',
  'prp therapy': 'prp',
  microneedling: 'microneedling',
  'thread lift': 'thread-lift',
}

/** Set of canonical service slugs for fast membership checks. */
export const SERVICE_SLUGS = new Set(Object.values(SERVICE_ALIASES))

/** Returns canonical brand slug for a CSV label, or null. */
export function brandSlugFor(label: string): string | null {
  const norm = label.toLowerCase().trim()
  return BRAND_ALIASES[norm] ?? (BRAND_SLUGS.has(norm) ? norm : null)
}

/** Returns canonical service slug for a CSV label, or null. */
export function serviceSlugFor(label: string): string | null {
  const norm = label.toLowerCase().trim()
  return SERVICE_ALIASES[norm] ?? (SERVICE_SLUGS.has(norm) ? norm : null)
}

/** Returns canonical slug for any CSV treatment label (brand or service), or null. */
export function treatmentSlugFor(label: string): string | null {
  return brandSlugFor(label) ?? serviceSlugFor(label) ?? kebab(label) ?? null
}

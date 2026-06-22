/** Coercion + normalization helpers for CSV import. */

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
 * Treatment name/alias -> canonical slug. CSV uses short labels
 * ("Tear Trough", "Masseter") that don't always equal the DB name.
 */
const TREATMENT_ALIASES: Record<string, string> = {
  botox: 'botox',
  dysport: 'dysport',
  xeomin: 'xeomin',
  jeuveau: 'jeuveau',
  daxxify: 'daxxify',
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
  kybella: 'kybella',
  sculptra: 'sculptra',
  prp: 'prp',
  'prp therapy': 'prp',
  microneedling: 'microneedling',
  'thread lift': 'thread-lift',
}

/** Returns a canonical treatment slug for a CSV label, or null if unknown. */
export function treatmentSlugFor(label: string): string | null {
  const norm = label.toLowerCase().trim()
  if (TREATMENT_ALIASES[norm]) return TREATMENT_ALIASES[norm]
  const slug = kebab(label)
  // Allow direct slug matches too (caller verifies against DB).
  return slug || null
}

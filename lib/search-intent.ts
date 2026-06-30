/**
 * Server-side search intent parser (Phase 13).
 *
 * Turns a single free-text omnibox query into structured intent:
 *   - treatment  (matched against the Treatments list + the import alias map)
 *   - location   (matched against state names/codes + known city/neighborhood names)
 *   - zip        (a 5-digit US ZIP)
 *   - freeText   (whatever is left -> provider / clinic name full-text)
 *
 * This is the PRIMARY mechanism for "type anything": each matched part is applied
 * as the corresponding filter in searchDirectory. It is a pure function given the
 * lookup tables (which searchDirectory builds from the DB), so it is trivially
 * testable and does no IO itself.
 *
 * Matching is greedy and phrase-aware (longest n-gram wins) so "lip filler new
 * york" splits into treatment="lip-filler" + location="new york", and a bare
 * provider name like "lena park" stays as freeText.
 */
import { treatmentSlugFor } from './import/helpers'

export type ParsedIntent = {
  treatmentSlug?: string
  /** Product brand slug (e.g. "juvederm"), when the query named one. */
  brandSlug?: string
  /** Raw location phrase to feed the existing location resolver (state/city). */
  location?: string
  /** 5-digit ZIP, if one was present. */
  zip?: string
  /** Leftover tokens -> provider/clinic name full-text. */
  freeText: string
}

export type IntentLookups = {
  /** Lowercased treatment phrase (name / alias / slug-as-words) -> canonical slug. */
  treatmentPhraseToSlug: Map<string, string>
  /** Lowercased brand phrase (name / slug-as-words) -> canonical slug. */
  brandPhraseToSlug: Map<string, string>
  /** Lowercased known location phrases (state names, state codes, cities, neighborhoods). */
  locationPhrases: Set<string>
}

const MAX_PHRASE_WORDS = 3

// Honorifics + credential suffixes are noise in a NAME query (they live in the
// providers.credentials column, not in the searched name tsvector). Stripping them
// keeps "Jenna Wu, PA" / "Dr. Lena Park MD" matching the stored full name. "pa",
// "do", etc. would also collide with state codes / English words, which is the
// other reason 2-letter state codes are kept OUT of the location lookup.
const NAME_NOISE = new Set([
  'dr', 'dr.', 'doctor', 'md', 'do', 'np', 'pa', 'rn', 'dds', 'dmd', 'facs', 'faad',
])

function normalize(raw: string): string {
  return (raw || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Build the brand lookup from the live Brands rows (e.g. "juvederm" -> "juvederm",
 * "rha collection" -> "rha-collection"). Brands are product names (Juvederm,
 * Restylane, Sculptra...) which are distinct from treatments (lip-filler,
 * masseter-botox...); a query like "juvederm" must resolve here, not as freeText.
 */
export function buildBrandLookup(brands: { name: string; slug: string }[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const b of brands) {
    map.set(b.name.toLowerCase(), b.slug)
    map.set(b.slug.replace(/-/g, ' '), b.slug)
    map.set(b.slug, b.slug)
  }
  return map
}

/**
 * Build the treatment lookup from the live Treatments rows plus the shared import
 * alias map (reused so the omnibox understands the same shorthands the importer
 * does, e.g. "lips" -> lip-filler, "under eye" -> tear-trough).
 */
export function buildTreatmentLookup(
  treatments: { name: string; slug: string }[],
): Map<string, string> {
  const map = new Map<string, string>()
  const validSlugs = new Set(treatments.map((t) => t.slug))
  for (const t of treatments) {
    const slug = t.slug
    map.set(t.name.toLowerCase(), slug)
    map.set(slug.replace(/-/g, ' '), slug)
    map.set(slug, slug)
  }
  // Layer the import alias map on top, but only for aliases that resolve to a real
  // treatment slug in this DB (so we never offer a treatment that does not exist).
  // treatmentSlugFor returns the alias map's slug or a kebab of the label.
  for (const phrase of ALIAS_PHRASES) {
    const slug = treatmentSlugFor(phrase)
    if (slug && validSlugs.has(slug)) map.set(phrase, slug)
  }
  return map
}

// The alias phrases the importer recognizes. Kept here as the set of human labels
// to test; treatmentSlugFor() owns the actual phrase->slug mapping.
const ALIAS_PHRASES = [
  'botox', 'dysport', 'xeomin', 'jeuveau', 'daxxify',
  'lip filler', 'lips', 'cheek filler', 'cheeks', 'jawline filler', 'jawline',
  'tear trough', 'tear trough filler', 'under eye', 'masseter', 'masseter botox',
  'kybella', 'sculptra', 'prp', 'prp therapy', 'microneedling', 'thread lift',
]

/** Find the first phrase (longest n-gram, left to right) present in `lookup`. */
function findFirstPhrase(
  tokens: string[],
  consumed: boolean[],
  has: (phrase: string) => boolean,
): { phrase: string; start: number; len: number } | null {
  for (let i = 0; i < tokens.length; i++) {
    if (consumed[i]) continue
    const maxLen = Math.min(MAX_PHRASE_WORDS, tokens.length - i)
    for (let len = maxLen; len >= 1; len--) {
      // phrase must be over contiguous, unconsumed tokens
      let ok = true
      for (let k = 0; k < len; k++) if (consumed[i + k]) { ok = false; break }
      if (!ok) continue
      const phrase = tokens.slice(i, i + len).join(' ')
      if (has(phrase)) return { phrase, start: i, len }
    }
  }
  return null
}

export function parseSearchQuery(raw: string, lk: IntentLookups): ParsedIntent {
  const norm = normalize(raw)
  if (!norm) return { freeText: '' }

  // 1) ZIP: pull the first standalone 5-digit group out.
  let zip: string | undefined
  const zipMatch = norm.match(/(?:^|\s)(\d{5})(?=$|\s)/)
  let working = norm
  if (zipMatch) {
    zip = zipMatch[1]
    working = (norm.slice(0, zipMatch.index) + ' ' + norm.slice((zipMatch.index ?? 0) + zipMatch[0].length)).trim()
  }

  const tokens = working.split(/[\s,]+/).filter(Boolean)
  const consumed = new Array(tokens.length).fill(false)

  // 2) Treatment: first phrase that maps to a treatment slug.
  let treatmentSlug: string | undefined
  const tHit = findFirstPhrase(tokens, consumed, (p) => lk.treatmentPhraseToSlug.has(p))
  if (tHit) {
    treatmentSlug = lk.treatmentPhraseToSlug.get(tHit.phrase)
    for (let k = 0; k < tHit.len; k++) consumed[tHit.start + k] = true
  }

  // 3) Brand: first phrase that maps to a product brand slug (e.g. "juvederm").
  let brandSlug: string | undefined
  const bHit = findFirstPhrase(tokens, consumed, (p) => lk.brandPhraseToSlug.has(p))
  if (bHit) {
    brandSlug = lk.brandPhraseToSlug.get(bHit.phrase)
    for (let k = 0; k < bHit.len; k++) consumed[bHit.start + k] = true
  }

  // 4) Location: longest known location phrase among the rest.
  let location: string | undefined
  const lHit = findFirstPhrase(tokens, consumed, (p) => lk.locationPhrases.has(p))
  if (lHit) {
    location = lHit.phrase
    for (let k = 0; k < lHit.len; k++) consumed[lHit.start + k] = true
  }

  // 5) Whatever is left is the free-text name query (minus honorific/credential noise).
  const freeText = tokens
    .filter((_, i) => !consumed[i])
    .filter((t) => !NAME_NOISE.has(t))
    .join(' ')
    .trim()

  return { treatmentSlug, brandSlug, location, zip, freeText }
}

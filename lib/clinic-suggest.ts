/**
 * Typeahead clinics by name, matched in memory (2026-11-20).
 *
 * Every typed word must start a word of the clinic's name or place (city, state
 * code), in any order, and at least one must be in the name, so the list
 * follows the visitor word by word: "beauty medica" finds "Beauty Medica",
 * "dr shel" finds "Dr. Shel ...", "beauty medica houston" the Houston one.
 * Ranked by how well the NAME matches: 0 exact, 1 starts with the text, 2 the
 * text at a word start, 3 every word in the name, 4 a word only in the place;
 * then, inside 3 and 4, the shorter name; then rating as before.
 *
 * Was SQL: one unbroken phrase at the start of the name or of a word, ranked by
 * rating alone, so four 5.0 "... Beauty Medical ..." clinics pushed the 4.8
 * "Beauty Medica" out of the four slots, and "dr shel" never matched "Dr. Shel".
 *
 * In memory because the same matching in SQL cost 50-350ms a keystroke on
 * staging, on a pool of 4 connections that page renders share. The published
 * names are ~45k short rows (a few MB), loaded once per instance and refreshed
 * in the background every 10 minutes, so a newly hidden clinic can linger that
 * long. Not the full-text index either: its english stemming stores "Medical"
 * as "medic", which a half-typed "medica" can never prefix-match.
 */

export type SuggestClinic = {
  id: number
  slug: string
  name: string
  city: string
  state: string
  rating: number
  ratingCount: number
  /** Name as accent-free lowercase words, each after one space: "Dr. Shel" -> " dr shel". */
  nk: string
  /** City and state code the same way: " sugar land tx". */
  pk: string
}

const words = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)

const key = (s: string) => words(s).map((w) => ` ${w}`).join('')

export function toSuggestClinic(r: any): SuggestClinic {
  const name = String(r.clinic_name ?? '')
  const city = String(r.city ?? '')
  const state = String(r.state ?? '')
  return {
    id: Number(r.id),
    slug: String(r.slug ?? ''),
    name,
    city,
    state,
    // -1 sorts a missing rating last, as NULLS LAST did.
    rating: r.aggregate_rating == null ? -1 : Number(r.aggregate_rating),
    ratingCount: r.aggregate_rating_count == null ? -1 : Number(r.aggregate_rating_count),
    nk: key(name),
    pk: key(`${city} ${state}`),
  }
}

export function matchClinics(rows: SuggestClinic[], input: string, limit: number): SuggestClinic[] {
  const typed = words(input).slice(0, 6).map((w) => ` ${w}`)
  if (typed.length === 0) return []
  const phrase = typed.join('')
  const hits: { c: SuggestClinic; tier: number }[] = []
  for (const c of rows) {
    let inName = 0
    let ok = true
    for (const w of typed) {
      if (c.nk.includes(w)) inName++
      else if (!c.pk.includes(w)) {
        ok = false
        break
      }
    }
    if (!ok || inName === 0) continue
    const tier =
      c.nk === phrase ? 0
      : c.nk.startsWith(phrase) ? 1
      : c.nk.includes(phrase) ? 2
      : inName === typed.length ? 3
      : 4
    hits.push({ c, tier })
  }
  hits.sort(
    (a, b) =>
      a.tier - b.tier ||
      (a.tier >= 3 ? a.c.nk.length - b.c.nk.length : 0) ||
      b.c.rating - a.c.rating ||
      b.c.ratingCount - a.c.ratingCount ||
      b.c.id - a.c.id,
  )
  return hits.slice(0, limit).map((h) => h.c)
}

const TTL_MS = 10 * 60 * 1000
let cache: { at: number; rows: SuggestClinic[] } | null = null
let loading: Promise<void> | null = null

/** Every published clinic, ready for matchClinics. Throws only when a cold instance cannot load. */
export async function getSuggestClinics(pool: any): Promise<SuggestClinic[]> {
  if ((!cache || Date.now() - cache.at > TTL_MS) && !loading) {
    loading = pool
      .query(
        `SELECT id, slug, clinic_name, city, state, aggregate_rating, aggregate_rating_count
           FROM clinics WHERE status = 'published'`,
      )
      .then((res: any) => {
        cache = { at: Date.now(), rows: res.rows.map(toSuggestClinic) }
      })
      .catch((err: any) => console.error('[clinic-suggest] load failed:', err?.message ?? err))
      .finally(() => {
        loading = null
      })
  }
  // Stale rows answer at once while the refresh runs; only a cold instance waits.
  if (!cache) await loading
  if (!cache) throw new Error('clinic names not loaded')
  return cache.rows
}

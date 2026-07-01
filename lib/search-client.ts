/**
 * Client-side helpers for the omnibox (Phase 13).
 *
 * Thin fetch wrappers around /api/search and /api/search/suggest, shared by the
 * homepage Hero and the header search bar so debounced calls + shapes stay
 * consistent. All failures resolve to empty (never throw into the UI).
 */

export type Suggestion = {
  type: 'treatment' | 'brand' | 'location' | 'provider' | 'clinic' | 'zip'
  label: string
  sublabel?: string
  /** Where selecting this suggestion navigates. */
  href: string
}

/**
 * Brand/Treatment suggestions are search modifiers, not a distinct page to jump
 * to -- picking one should run a search (like the "Popular" pills do), not
 * navigate to the brand/service hub page. Provider/Clinic/Location/ZIP
 * suggestions each have their own real destination page, so those still
 * navigate via `suggestion.href` directly.
 */
export function isSearchModifierSuggestion(type: Suggestion['type']): boolean {
  return type === 'treatment' || type === 'brand'
}

export async function fetchSuggest(
  q: string,
  signal?: AbortSignal,
  type?: 'treatment' | 'location' | 'all',
): Promise<Suggestion[]> {
  const term = q.trim()
  if (term.length < 2) return []
  try {
    const p = new URLSearchParams({ q: term })
    if (type && type !== 'all') p.set('type', type)
    const res = await fetch(`/api/search/suggest?${p.toString()}`, { signal })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data.suggestions) ? data.suggestions : []
  } catch {
    return []
  }
}

export type ApiSearchResults = {
  providers: any[]
  clinics: any[]
  providerTotal: number
  clinicTotal: number
  treatmentLabel?: string
  brandLabel?: string
  locationLabel?: string
  center?: { lat: number; lng: number } | null
}

export async function fetchSearchResults(
  opts: { q?: string; location?: string; lat?: number; lng?: number; limit?: number; geo?: boolean },
  signal?: AbortSignal,
): Promise<ApiSearchResults | null> {
  const p = new URLSearchParams()
  if (opts.q) p.set('q', opts.q)
  if (opts.location) p.set('location', opts.location)
  if (opts.lat != null) p.set('lat', String(opts.lat))
  if (opts.lng != null) p.set('lng', String(opts.lng))
  if (opts.limit) p.set('limit', String(opts.limit))
  if (opts.geo) p.set('geo', '1')
  try {
    const res = await fetch(`/api/search?${p.toString()}`, { signal })
    if (!res.ok) return null
    return (await res.json()) as ApiSearchResults
  } catch {
    return null
  }
}

/** Build the /search URL for a single free-text omnibox submit. */
export function searchHref(q: string): string {
  const term = q.trim()
  return term ? `/search?q=${encodeURIComponent(term)}` : '/search'
}

/** Build the /search URL for the two-field (what + where) hero search. */
export function searchHrefTwoField(what: string, where: string): string {
  const p = new URLSearchParams()
  if (what.trim()) p.set('q', what.trim())
  if (where.trim()) p.set('location', where.trim())
  const qs = p.toString()
  return qs ? `/search?${qs}` : '/search'
}

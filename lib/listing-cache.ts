/**
 * Response cache for the public clinic-listing API routes (2026-08-15).
 *
 * WHY THIS EXISTS
 *
 * The default listing is now ordered around the visitor's IP-derived location.
 * That ordering cannot use an index: no index is sorted by distance from an
 * arbitrary point, so Postgres computes a distance band for every matching row
 * and sorts the lot before it can name the first 24. Measured against staging's
 * 39,669 clinics that took ~1.1s, against ~0.6s for the old rating-ordered
 * query, which walks an index and stops after 24 rows.
 *
 * Paging does not reduce that work. Asking for rows 25 to 48 still requires
 * ranking everything first, which is why a deep page measured the same as the
 * first one. The cost is per REQUEST, and it lands on a connection pool
 * deliberately capped at 4. Multiplying that by every visitor is the shape of
 * the 2026-07-29 outage.
 *
 * WHAT MAKES CACHING WORK HERE
 *
 * IP geolocation is city-level, not street-level, so the thousands of visitors
 * in one city resolve to the same coordinates. Coordinates are additionally
 * rounded before they are sent (see toServerFilterParams), so one city collapses
 * to one cache key. The first visitor pays the full query; everyone behind them
 * for the next 5 minutes is served from memory.
 *
 * These responses are a pure function of the query string. No cookie, no
 * session, no user field. That is what makes both layers below safe, and it is
 * the property to re-check before adding anything personalized to a listing.
 */
import { NextResponse } from 'next/server'
import { BoundedTtlCache } from './bounded-ttl-cache'

/**
 * 5 minutes. Long enough that a busy city pays one query per window, short
 * enough that a newly published clinic appears without a deploy. The listing
 * pages themselves are ISR at 600s, so this is not the slowest link anyway.
 */
const TTL_MS = 5 * 60 * 1000

/**
 * Entry cap, not a byte cap. One entry is a page of 24 clinics, roughly 20-40KB
 * of JSON, so 200 entries is a ceiling of about 8MB. The key space is
 * (route x location x filters x page), which is unbounded in principle, hence a
 * hard cap and oldest-first eviction rather than a plain Map. An unbounded Map
 * keyed on request data is a memory-exhaustion primitive, which is exactly the
 * bug lib/geo-ip.ts was written to fix.
 */
const MAX_ENTRIES = 200

const cache = new BoundedTtlCache<string>(MAX_ENTRIES, TTL_MS)

/**
 * Shared-cache header, same pattern and reasoning as /api/search.
 *
 * This is the layer that survives across server instances, where the in-memory
 * cache above does not. `public` is safe ONLY because these responses never
 * vary by user or cookie. Do not copy this onto anything auth-dependent.
 */
export const LISTING_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=600'

/**
 * Cache key for a listing request.
 *
 * Built from EVERY query parameter, sorted, rather than from a hand-picked
 * list. A hand-picked list is one forgotten parameter away from serving the
 * wrong results, and that failure is silent: the response looks perfectly
 * valid, it just answers a different question than the one asked.
 */
export function listingCacheKey(route: string, params: URLSearchParams): string {
  const entries = [...params.entries()].sort((a, b) =>
    a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0]),
  )
  return `${route}?${entries.map(([k, v]) => `${k}=${v}`).join('&')}`
}

/** Cached response for this key, or null on a miss. */
export function getCachedListing(key: string): NextResponse | null {
  const hit = cache.get(key)
  if (hit === undefined) return null
  return new NextResponse(hit, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': LISTING_CACHE_CONTROL,
      'X-Listing-Cache': 'hit',
    },
  })
}

/**
 * Store a successful listing response and return it.
 *
 * Only ever called on the success path. Caching an error would pin a transient
 * database failure in front of every visitor in that city for five minutes.
 */
export function cacheListing(key: string, body: unknown): NextResponse {
  const json = JSON.stringify(body)
  cache.set(key, json)
  return new NextResponse(json, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': LISTING_CACHE_CONTROL,
      'X-Listing-Cache': 'miss',
    },
  })
}

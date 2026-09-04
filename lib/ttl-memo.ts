/**
 * Cross-request TTL memoisation with single-flight.
 *
 * WHY THIS EXISTS
 *
 * `/search` renders four things in one `Promise.all`: the search itself, the
 * "top results" block, the brand/service filter lists, and the state filter
 * list. Only the first depends on the query. The other three return the same
 * few hundred bytes for every visitor and change when an admin edits a brand,
 * a service, or publishes a clinic, which is not per request.
 *
 * They were re-queried on every single search anyway, and they land on a
 * connection pool capped at 4 (payload.config.ts) at the same moment as the
 * search query itself, so they do not just cost their own time, they queue
 * behind and ahead of the query the visitor is actually waiting for.
 *
 * WHY SINGLE-FLIGHT MATTERS MORE THAN THE CACHE HERE
 *
 * A plain TTL cache still lets every concurrent request through on a miss. With
 * a pool of 4, ten simultaneous searches arriving just after a TTL expiry all
 * run the same query, and the pool is exhausted by work that is duplicated ten
 * times over. Holding the in-flight promise and handing it to every waiter
 * means one query per TTL window no matter how many callers arrive together.
 * That is the same "thundering herd after expiry" shape that made the
 * getLookups() rebuild in search-queries.ts expensive.
 *
 * FAILURE BEHAVIOUR
 *
 * A rejected in-flight promise is evicted, never cached, so one transient
 * database error cannot be pinned in front of every visitor for the whole TTL.
 * The rejection propagates to the callers waiting on it, exactly as an
 * un-memoised call would.
 *
 * STALENESS
 *
 * Up to `ttlMs`. These lists already tolerate that: the omnibox suggest route
 * (app/api/search/suggest/route.ts) has cached the very same services, brands
 * and city lists for 5 minutes since Phase 13, and public pages are ISR at 300s
 * anyway, so a filter list is never the freshest thing on the page.
 *
 * KILL SWITCH
 *
 * Set SEARCH_OPTION_CACHE=0 to bypass every memo built here without a deploy.
 * Anything else (including unset) keeps caching on.
 */

/** Default window. Matches the suggest route's TTL for the same underlying data. */
export const OPTION_CACHE_TTL_MS = 5 * 60 * 1000

/** Whether memoisation is active. On unless SEARCH_OPTION_CACHE is exactly "0". */
export function optionCacheEnabled(): boolean {
  return process.env.SEARCH_OPTION_CACHE !== '0'
}

type Entry<V> = { value?: V; at: number; inFlight?: Promise<V> }

/**
 * Memoise an async function on a string key, with a TTL and single-flight.
 *
 * `maxEntries` bounds the key space. For a keyed memo the key is derived from
 * user input, so an unbounded Map here would be a memory-exhaustion primitive;
 * oldest-first eviction is the same rule BoundedTtlCache applies, reimplemented
 * rather than reused because entries here hold a pending promise as well as a
 * value.
 */
export function ttlMemo<A extends any[], V>(
  fn: (...args: A) => Promise<V>,
  opts: { ttlMs?: number; maxEntries?: number; key?: (...args: A) => string } = {},
): (...args: A) => Promise<V> {
  const ttlMs = opts.ttlMs ?? OPTION_CACHE_TTL_MS
  const maxEntries = opts.maxEntries ?? 1
  const keyOf = opts.key ?? (() => '')
  const store = new Map<string, Entry<V>>()

  return async (...args: A): Promise<V> => {
    if (!optionCacheEnabled()) return fn(...args)

    const key = keyOf(...args)
    const hit = store.get(key)

    // A live in-flight call is joined rather than duplicated, even past the TTL:
    // whoever started it is already fetching exactly what this caller wants.
    if (hit?.inFlight) return hit.inFlight
    if (hit && hit.value !== undefined && Date.now() - hit.at < ttlMs) return hit.value

    const inFlight = fn(...args)
    // Insert before awaiting, so a caller arriving in the same tick joins it.
    if (store.size >= maxEntries && !store.has(key)) {
      const oldest = store.keys().next().value
      if (oldest !== undefined) store.delete(oldest)
    }
    store.set(key, { at: Date.now(), inFlight, value: hit?.value })

    try {
      const value = await inFlight
      store.set(key, { value, at: Date.now() })
      return value
    } catch (err) {
      // Never cache a failure. Drop the entry so the next caller retries.
      store.delete(key)
      throw err
    }
  }
}

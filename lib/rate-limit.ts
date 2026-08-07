import { NextResponse, type NextRequest } from 'next/server'

/**
 * Shared rate limiter with a pluggable backing store.
 *
 * Two stores, selected automatically at first use:
 *
 *   - Redis (shared)   — used when REDIS_URL is set AND the optional `ioredis`
 *                        package is installed. Counters live in Redis, so every
 *                        app instance enforces ONE shared limit and counters
 *                        survive restarts and deploys.
 *   - Memory (default) — the original per-process Map. Correct for a single
 *                        instance, which is the current deployment.
 *
 * WHY THIS MATTERS: with an in-memory store and N instances behind a load
 * balancer, the effective limit is N times the configured one, because each
 * process keeps its own counter. A restart also wipes every counter, handing
 * an attacker a fresh budget on each deploy. Neither is visible in testing;
 * both show up exactly when you scale out.
 *
 * MIGRATION IS ZERO-RISK BY DESIGN. With no REDIS_URL, behaviour is byte-for-
 * byte what it was before. Set REDIS_URL and install `ioredis` to switch. If
 * Redis is configured but unreachable at runtime, the limiter degrades to the
 * memory store and keeps serving rather than failing requests: a limiter
 * outage must never become a site outage.
 *
 * `check()` is async. Callers MUST await it. A non-awaited call returns a
 * Promise, which is always truthy, so `if (!limiter.check(k))` would silently
 * disable the limit. That is why the sync signature was not kept.
 */

type Entry = { count: number; resetAt: number }

interface LimitStore {
  /** Increments the counter for `key` and returns the new count. */
  hit(key: string, windowMs: number): Promise<number>
}

/** Per-process Map. Lazy cleanup every 10 minutes prevents unbounded growth. */
class MemoryStore implements LimitStore {
  private readonly map = new Map<string, Entry>()
  private lastCleanup = Date.now()

  async hit(key: string, windowMs: number): Promise<number> {
    const now = Date.now()
    this.cleanup(now)
    const entry = this.map.get(key)
    if (!entry || now > entry.resetAt) {
      this.map.set(key, { count: 1, resetAt: now + windowMs })
      return 1
    }
    entry.count++
    return entry.count
  }

  private cleanup(now: number) {
    if (now - this.lastCleanup < 10 * 60 * 1000) return
    for (const [k, v] of this.map) {
      if (now > v.resetAt) this.map.delete(k)
    }
    this.lastCleanup = now
  }
}

/**
 * Redis fixed-window counter: INCR the key, and set the TTL only on the first
 * hit of a window. Both commands go in one pipeline, so the round trip cost is
 * a single RTT. INCR is atomic, so concurrent requests across instances cannot
 * lose an increment.
 */
class RedisStore implements LimitStore {
  constructor(private readonly client: any) {}

  async hit(key: string, windowMs: number): Promise<number> {
    const k = `rl:${key}`
    const results = await this.client
      .multi()
      .incr(k)
      .pexpire(k, windowMs, 'NX') // 'NX' = only set a TTL if none exists yet
      .exec()
    // ioredis exec() returns [[err, value], ...]
    const count = results?.[0]?.[1]
    if (typeof count !== 'number') throw new Error('unexpected INCR reply')
    return count
  }
}

const memoryStore = new MemoryStore()

/**
 * Resolved once per process. `undefined` until first use, then either a
 * RedisStore or the shared MemoryStore.
 */
let storePromise: Promise<LimitStore> | null = null

async function getStore(): Promise<LimitStore> {
  if (storePromise) return storePromise

  storePromise = (async (): Promise<LimitStore> => {
    const url = process.env.REDIS_URL
    if (!url) return memoryStore

    try {
      // Optional dependency, loaded only when REDIS_URL is actually set.
      //
      // The specifier is held in a variable ON PURPOSE. A string literal would
      // make TypeScript resolve `ioredis` at compile time and the bundler try
      // to include it, both of which fail while the package is not installed.
      // Indirecting through a variable keeps this a pure runtime lookup, so the
      // app builds and boots with or without the package present. If it is
      // missing, the import throws and we fall through to the memory store.
      const spec = 'ioredis'
      const mod: any = await import(/* webpackIgnore: true */ spec)
      const Redis = mod.default ?? mod
      const client = new Redis(url, {
        maxRetriesPerRequest: 2,
        // Fail fast: a slow Redis must not add latency to every request.
        connectTimeout: 2000,
        enableOfflineQueue: false,
        lazyConnect: false,
      })
      client.on('error', (err: any) => {
        console.error('[rate-limit] redis error:', err?.message ?? err)
      })
      console.info('[rate-limit] using shared Redis store')
      return new RedisStore(client)
    } catch (err: any) {
      console.warn(
        `[rate-limit] REDIS_URL is set but Redis is unavailable (${err?.message ?? err}). ` +
          'Falling back to per-process in-memory limits. Run `npm i ioredis` if the ' +
          'package is missing.',
      )
      return memoryStore
    }
  })()

  return storePromise
}

export class RateLimiter {
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /**
   * Returns true if the request is allowed, false if it should be rejected
   * with 429. MUST be awaited.
   */
  async check(key: string): Promise<boolean> {
    try {
      const store = await getStore()
      const count = await store.hit(key, this.windowMs)
      return count <= this.limit
    } catch (err: any) {
      // Redis blip. Degrade to the local counter rather than 500 the route.
      console.error('[rate-limit] store failed, using memory:', err?.message ?? err)
      try {
        const count = await memoryStore.hit(key, this.windowMs)
        return count <= this.limit
      } catch {
        // Even the memory path failed, which should be impossible. Allow the
        // request: a broken limiter must not take the site down.
        return true
      }
    }
  }
}

/**
 * One-line guard for a route handler:
 *
 *     const blocked = await enforceLimit(req, limiter, 'city-clinics')
 *     if (blocked) return blocked
 *
 * The `bucket` prefix matters. Keying purely on the IP makes every route that
 * does so share ONE budget, so a visitor who browses normally can exhaust a
 * limit they never came close to on any single endpoint. Prefixing gives each
 * route its own counter for the same caller, which is what the numbers in each
 * route were actually chosen to mean.
 */
export async function enforceLimit(
  req: NextRequest,
  limiter: RateLimiter,
  bucket: string,
): Promise<NextResponse | null> {
  if (await limiter.check(`${bucket}:${getIp(req)}`)) return null
  return NextResponse.json(
    { error: 'Too many requests. Please slow down.' },
    { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } },
  )
}

/**
 * CSRF origin check for write API routes.
 *
 * Rejects requests from unknown domains and requests with no Origin header.
 * Browsers always send Origin on same-origin fetch() POST/DELETE calls.
 * A missing Origin means the caller is not a browser — those callers should
 * use service tokens, not cookie-based auth.
 */
export function checkOrigin(req: NextRequest): boolean {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'
  const origin = req.headers.get('origin')
  // Null/missing Origin must be rejected, not trusted.
  // Legitimate same-origin browser requests always include Origin on POST/DELETE.
  // Server-to-server calls (no Origin) should use service tokens, not cookie auth.
  if (!origin) return false
  // Accept both the apex and "www." form of the configured site domain --
  // visitors land on either depending on how they navigate (typed directly,
  // shared link, bookmark), and desktop vs. mobile testing has already hit
  // both variants failing when only one was whitelisted.
  const allowed = [siteUrl, 'http://localhost:3000', 'http://localhost:3001'].filter(Boolean)
  try {
    const siteHost = new URL(siteUrl).hostname
    const altHost = siteHost.startsWith('www.') ? siteHost.slice(4) : `www.${siteHost}`
    allowed.push(`${new URL(siteUrl).protocol}//${altHost}`)
  } catch {
    /* siteUrl unparsable -- fall back to the base allowed list only */
  }
  try {
    const requestOrigin = new URL(origin).origin
    return allowed.some((u) => requestOrigin === new URL(u).origin)
  } catch {
    return false
  }
}

/**
 * Extract the real client IP from proxy headers.
 *
 * This value keys every rate limit in the application, so getting it wrong
 * fails in one of two bad ways:
 *   - too permissive: the value is client-controlled, so an attacker rotates
 *     it and bypasses every limit;
 *   - too restrictive: every request resolves to the load balancer's own IP,
 *     so all users share one bucket and a single active user locks out
 *     everyone else.
 *
 * Resolution order, most trustworthy first:
 *
 * 1. `CF-Connecting-IP` — set by Cloudflare itself and stripped from any
 *    client-supplied copy at the edge. Unambiguous: it is always exactly the
 *    client IP, with no list parsing and no hop counting. Preferred whenever
 *    the site is behind Cloudflare. Only trusted when TRUST_CF_HEADERS is
 *    enabled, because if traffic can reach the origin directly (bypassing
 *    Cloudflare) a client could forge this header.
 *
 * 2. `X-Forwarded-For` — a comma-separated list where each proxy APPENDS the
 *    address it received the connection from. The rightmost entries are
 *    therefore the ones added by infrastructure you control, and the leftmost
 *    are whatever the client sent. Reading the leftmost entry (the original
 *    behaviour of this function) is spoofable by design.
 *
 *    TRUSTED_PROXY_COUNT is the number of trusted proxy hops between the
 *    public internet and this process. With the DigitalOcean App Platform
 *    default of a single hop, the platform appends the verified client IP as
 *    the last entry, so index [len - 1] is correct.
 *
 * 3. `X-Real-IP` — single value, set by some proxies. Last resort.
 *
 * VERIFY THIS ON YOUR ACTUAL TOPOLOGY. The correct index depends on how many
 * proxies sit in front of the app, and that changed when this project moved
 * from Railway to DigitalOcean. `GET /api/_debug/ip` (admin-only) echoes the
 * raw headers and the resolved value so the setting can be confirmed against
 * a request from a known external address rather than assumed.
 *
 * CRITICAL: whichever header you trust, the platform in front of the app must
 * strip or overwrite any client-supplied copy of it. Otherwise a client can
 * pad the list to shift the index and reach the spoofable region again.
 */
export function getIp(req: NextRequest): string {
  // Cloudflare sets this itself and strips client-supplied copies at the edge.
  // Gated: only trust it when we know all traffic actually arrives via CF.
  if (process.env.TRUST_CF_HEADERS === 'true') {
    const cf = req.headers.get('cf-connecting-ip')
    if (cf) return cf.trim()
  }

  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const ips = xff.split(',').map((s) => s.trim()).filter(Boolean)
    const trustCount = Math.max(1, parseInt(process.env.TRUSTED_PROXY_COUNT || '1', 10))
    // Count in from the right: those entries were appended by trusted hops.
    // Clamped to 0 so a shorter-than-expected list degrades to the leftmost
    // entry rather than returning undefined.
    const idx = Math.max(0, ips.length - trustCount)
    if (ips[idx]) return ips[idx]
  }

  return req.headers.get('x-real-ip') || 'unknown'
}

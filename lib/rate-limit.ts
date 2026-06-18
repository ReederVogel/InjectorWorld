import type { NextRequest } from 'next/server'

/* SCALING WARNING: This rate limiter uses an in-memory Map. It resets on every restart and is NOT shared across instances. Migrate to Redis before running more than one server process. */

/**
 * Shared in-memory rate limiter.
 *
 * One instance per API route, created at module level so it persists across
 * requests within a process. Lazy cleanup evicts expired entries every 10 minutes
 * so long-running processes don't accumulate stale IP entries (memory-leak fix for
 * the old inline Map pattern where entries were never evicted).
 *
 * IMPORTANT — per-process only: move to Redis (REDIS_URL) before scaling to more
 * than one instance. See ROADMAP Phase 12 note in docs/DECISIONS.md.
 */
type Entry = { count: number; resetAt: number }

export class RateLimiter {
  private readonly map = new Map<string, Entry>()
  private lastCleanup = Date.now()

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  check(key: string): boolean {
    const now = Date.now()
    this._cleanup(now)
    const entry = this.map.get(key)
    if (!entry || now > entry.resetAt) {
      this.map.set(key, { count: 1, resetAt: now + this.windowMs })
      return true
    }
    if (entry.count >= this.limit) return false
    entry.count++
    return true
  }

  private _cleanup(now: number) {
    if (now - this.lastCleanup < 10 * 60 * 1000) return
    for (const [k, v] of this.map) {
      if (now > v.resetAt) this.map.delete(k)
    }
    this.lastCleanup = now
  }
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
  const allowed = [siteUrl, 'http://localhost:3000', 'http://localhost:3001'].filter(Boolean)
  try {
    const requestOrigin = new URL(origin).origin
    return allowed.some((u) => requestOrigin === new URL(u).origin)
  } catch {
    return false
  }
}

/**
 * Extract the real client IP from standard proxy headers.
 *
 * Railway and DigitalOcean App Platform both APPEND the real client IP as
 * the rightmost entry in X-Forwarded-For. Reading the leftmost entry (the
 * old behaviour) lets any client spoof the IP by sending their own
 * X-Forwarded-For header, bypassing all rate limits.
 *
 * TRUSTED_PROXY_COUNT (default 1) is the number of trusted proxy hops between
 * the internet and this app process. With 1 hop (Railway / DO App Platform
 * default), the real client IP is at index [len - 1 - 1] = second-from-right.
 *
 * Wait — Railway appends the verified client IP as the last entry, so with
 * trustCount=1 we want index [len - trustCount] = last entry. Adjust
 * TRUSTED_PROXY_COUNT to match your actual deployment topology.
 *
 * CRITICAL: ensure your host platform is configured to strip (or override)
 * any client-supplied X-Forwarded-For headers it receives, otherwise a
 * client can still pad the header to shift the index.
 */
export function getIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const ips = xff.split(',').map((s) => s.trim()).filter(Boolean)
    const trustCount = Math.max(1, parseInt(process.env.TRUSTED_PROXY_COUNT || '1', 10))
    // Real client IP is the entry just before the trusted proxy hops at the right.
    const idx = Math.max(0, ips.length - trustCount)
    if (ips[idx]) return ips[idx]
  }
  return req.headers.get('x-real-ip') || 'unknown'
}

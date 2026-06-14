import type { NextRequest } from 'next/server'

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
 * Allows same-origin requests and server-to-server calls (no Origin header).
 * Rejects cross-origin POSTs from unknown domains.
 */
export function checkOrigin(req: NextRequest): boolean {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'
  const origin = req.headers.get('origin')
  if (!origin) return true // server-to-server or same-origin request (browser omits Origin)
  try {
    return new URL(origin).origin === new URL(siteUrl).origin
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

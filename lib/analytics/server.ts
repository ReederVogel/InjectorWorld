import 'server-only'
import type { NextRequest } from 'next/server'
import type { Payload } from 'payload'
import { createHash } from 'node:crypto'
import { getIp } from '@/lib/rate-limit'

const PRIVATE = /^(127\.|::1$|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::ffff:)/

/**
 * Resolves the real client IP via lib/rate-limit's getIp (which reads the
 * trusted X-Forwarded-For entry by proxy hop count, not the spoofable
 * leftmost one), then nulls out private/local addresses the same way
 * app/api/geo/ip/route.ts does.
 */
export function clientIp(req: NextRequest): string | null {
  const ip = getIp(req)
  if (!ip || ip === 'unknown' || PRIVATE.test(ip)) return null
  return ip
}

/** sha256(ip + ANALYTICS_IP_SALT). Null if either ip or the salt is missing. */
export function hashIp(ip: string | null): string | null {
  const salt = process.env.ANALYTICS_IP_SALT
  if (!ip || !salt) return null
  return createHash('sha256').update(`${ip}${salt}`).digest('hex')
}

export type CoarseGeo = { city: string | null; state: string | null }

const NULL_GEO: CoarseGeo = { city: null, state: null }
const geoCache = new Map<string, { r: CoarseGeo; at: number }>()
const GEO_TTL = 60 * 60 * 1000

// ip-api.com free tier allows 45 req/min. Cap under that so a traffic spike
// degrades to null geo instead of getting the whole app rate-limited by them.
const GEO_MAX_PER_MIN = 40
let geoLookupsThisWindow = 0
let geoWindowStart = Date.now()

export async function coarseGeo(ip: string | null): Promise<CoarseGeo> {
  if (!ip) return NULL_GEO

  const hit = geoCache.get(ip)
  if (hit && Date.now() - hit.at < GEO_TTL) return hit.r

  const now = Date.now()
  if (now - geoWindowStart > 60 * 1000) {
    geoWindowStart = now
    geoLookupsThisWindow = 0
  }
  if (geoLookupsThisWindow >= GEO_MAX_PER_MIN) return NULL_GEO
  geoLookupsThisWindow++

  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,city,region`, {
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    })
    const d = await res.json()
    if (d.status !== 'success') throw new Error('geoip failed')
    const r: CoarseGeo = {
      city: typeof d.city === 'string' ? d.city || null : null,
      state: typeof d.region === 'string' ? d.region || null : null,
    }
    geoCache.set(ip, { r, at: Date.now() })
    return r
  } catch {
    return NULL_GEO
  }
}

export function parseDevice(ua: string | null): 'mobile' | 'tablet' | 'desktop' {
  if (!ua) return 'desktop'
  const isTablet = /iPad/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))
  if (isTablet) return 'tablet'
  const isMobile = /Mobi|iPhone|iPod|Android|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  if (isMobile) return 'mobile'
  return 'desktop'
}

export function parseBrowser(ua: string | null): string | null {
  if (!ua) return null
  if (/Edg\//i.test(ua)) return 'Edge'
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return 'Opera'
  if (/CriOS/i.test(ua)) return 'Chrome'
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return 'Chrome'
  if (/FxiOS/i.test(ua)) return 'Firefox'
  if (/Firefox\//i.test(ua)) return 'Firefox'
  if (/Safari\//i.test(ua) && /Version\//i.test(ua)) return 'Safari'
  return 'Other'
}

const BOT_RE = /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|headless|phantomjs|python-requests|python-urllib|curl|wget|scrapy|ahrefs|semrush|mj12bot|dotbot|petalbot|go-http-client|axios\/|node-fetch/i

/** No UA at all is treated as non-browser traffic on this public endpoint. */
export function isBot(ua: string | null): boolean {
  if (!ua) return true
  return BOT_RE.test(ua)
}

export type EventRow = {
  eventType: string
  path: string | null
  entityType: string | null
  entityId: number | null
  sessionId: string | null
  visitorId: string | null
  referrer: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  ipHash: string | null
  geoCity: string | null
  geoState: string | null
  device: string | null
  browser: string | null
  meta: Record<string, unknown> | null
}

/* ── Batched event writer ───────────────────────────────────────────────────
 *
 * One INSERT per pageview means one pool connection per pageview, against a
 * pool capped at 4 (payload.config.ts). Under traffic that puts analytics in
 * direct contention with page rendering for the same connections, which is
 * exactly backwards: analytics is the droppable workload.
 *
 * So events are buffered and flushed as a single multi-row INSERT, either when
 * the buffer reaches BATCH_SIZE or after FLUSH_MS, whichever comes first. A
 * burst of 50 pageviews becomes one query holding one connection briefly,
 * instead of 50 queries queueing behind each other.
 *
 * Correctness details that matter:
 *
 *  - `ts` is captured at ENQUEUE time and inserted explicitly. Relying on the
 *    column's `DEFAULT now()` would stamp every event in a batch with the
 *    flush time, skewing timings by up to FLUSH_MS.
 *  - The buffer is capped (MAX_BUFFER). If the database is down, events are
 *    dropped rather than accumulated until the process runs out of memory.
 *    Analytics loss is acceptable; an OOM crash is not.
 *  - A flush failure drops that batch and logs. It never throws into the
 *    caller, which is inside `after()` on a public beacon route.
 *  - SIGTERM/SIGINT/beforeExit trigger a final flush so a normal deploy does
 *    not lose the last partial batch.
 *
 * Set ANALYTICS_BATCH=false to fall back to the original one-insert-per-event
 * behaviour without a code change.
 */

const BATCH_SIZE = 50
const FLUSH_MS = 2000
const MAX_BUFFER = 5000

type BufferedRow = EventRow & { ts: Date }

let buffer: BufferedRow[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let bufferPool: any = null
let droppedSinceLastLog = 0
let exitHooksBound = false

const EVENT_COLUMNS =
  'ts, event_type, path, entity_type, entity_id, session_id, visitor_id, referrer, ' +
  'utm_source, utm_medium, utm_campaign, ip_hash, geo_city, geo_state, device, browser, meta'

const COLS_PER_ROW = 17

function rowValues(r: BufferedRow): unknown[] {
  return [
    r.ts,
    r.eventType,
    r.path,
    r.entityType,
    r.entityId,
    r.sessionId,
    r.visitorId,
    r.referrer,
    r.utmSource,
    r.utmMedium,
    r.utmCampaign,
    r.ipHash,
    r.geoCity,
    r.geoState,
    r.device,
    r.browser,
    r.meta ? JSON.stringify(r.meta) : null,
  ]
}

async function flushBuffer(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (buffer.length === 0) return

  // Take the batch before awaiting so concurrent enqueues start a fresh buffer
  // and cannot be lost or double-inserted by this flush.
  const batch = buffer
  buffer = []
  const pool = bufferPool
  if (!pool) return

  if (droppedSinceLastLog > 0) {
    console.warn(`[analytics] dropped ${droppedSinceLastLog} events (buffer full)`)
    droppedSinceLastLog = 0
  }

  const params: unknown[] = []
  const tuples = batch.map((row, i) => {
    params.push(...rowValues(row))
    const base = i * COLS_PER_ROW
    const placeholders = Array.from({ length: COLS_PER_ROW }, (_, j) => `$${base + j + 1}`)
    return `(${placeholders.join(',')})`
  })

  try {
    await pool.query(
      `INSERT INTO analytics.events (${EVENT_COLUMNS}) VALUES ${tuples.join(',')}`,
      params,
    )
  } catch (err) {
    // Drop the batch. Retrying risks compounding load during a DB incident,
    // which is the moment analytics matters least.
    console.error(`[analytics] batch insert of ${batch.length} events failed:`, err)
  }
}

function bindExitHooks(): void {
  if (exitHooksBound) return
  exitHooksBound = true
  const finalFlush = () => {
    void flushBuffer()
  }
  process.once('SIGTERM', finalFlush)
  process.once('SIGINT', finalFlush)
  process.once('beforeExit', finalFlush)
}

/**
 * Queues one analytics event. Resolves as soon as the event is buffered, not
 * when it reaches the database.
 *
 * Signature is unchanged from the original direct-insert version, so callers
 * need no modification.
 */
export async function insertEvent(payload: Payload, row: EventRow): Promise<void> {
  const pool = (payload.db as any).pool
  if (!pool) return

  if (process.env.ANALYTICS_BATCH === 'false') {
    await insertEventDirect(pool, { ...row, ts: new Date() })
    return
  }

  bufferPool = pool
  bindExitHooks()

  if (buffer.length >= MAX_BUFFER) {
    droppedSinceLastLog++
    return
  }

  buffer.push({ ...row, ts: new Date() })

  if (buffer.length >= BATCH_SIZE) {
    await flushBuffer()
    return
  }
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      void flushBuffer()
    }, FLUSH_MS)
    // Do not hold the event loop open purely for a pending analytics flush.
    if (typeof flushTimer === 'object' && 'unref' in flushTimer) flushTimer.unref()
  }
}

/** Original single-row path, kept for ANALYTICS_BATCH=false and exit flushes. */
async function insertEventDirect(pool: any, row: BufferedRow): Promise<void> {
  const placeholders = Array.from({ length: COLS_PER_ROW }, (_, i) => `$${i + 1}`).join(',')
  await pool.query(
    `INSERT INTO analytics.events (${EVENT_COLUMNS}) VALUES (${placeholders})`,
    rowValues(row),
  )
}

/** Exposed for tests and for the rollup script to drain before it aggregates. */
export async function flushAnalyticsBuffer(): Promise<void> {
  await flushBuffer()
}

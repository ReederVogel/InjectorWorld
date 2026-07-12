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

export async function insertEvent(payload: Payload, row: EventRow): Promise<void> {
  const pool = (payload.db as any).pool
  if (!pool) return
  await pool.query(
    `INSERT INTO analytics.events
      (event_type, path, entity_type, entity_id, session_id, visitor_id, referrer,
       utm_source, utm_medium, utm_campaign, ip_hash, geo_city, geo_state, device, browser, meta)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [
      row.eventType,
      row.path,
      row.entityType,
      row.entityId,
      row.sessionId,
      row.visitorId,
      row.referrer,
      row.utmSource,
      row.utmMedium,
      row.utmCampaign,
      row.ipHash,
      row.geoCity,
      row.geoState,
      row.device,
      row.browser,
      row.meta ? JSON.stringify(row.meta) : null,
    ],
  )
}

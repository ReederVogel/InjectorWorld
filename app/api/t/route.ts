import { NextRequest, NextResponse, after } from 'next/server'
import { getPayload } from 'payload'
import { z } from 'zod'
import config from '@/payload.config'
import { clientIp, hashIp, coarseGeo, parseDevice, parseBrowser, isBot, insertEvent } from '@/lib/analytics/server'
import { RateLimiter } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const EVENT_TYPES = [
  'pageview',
  'clinic_view',
  'booking_open',
  'booking_submit',
  'contact_reveal',
  'outbound_click',
  'cta_click',
  'search',
  'share',
] as const

const EventSchema = z
  .object({
    event_type: z.enum(EVENT_TYPES),
    path: z.string().max(512).optional(),
    entityType: z.string().max(40).optional(),
    entityId: z.number().int().positive().optional(),
    sessionId: z.string().max(64).optional(),
    visitorId: z.string().max(64).optional(),
    referrer: z.string().max(512).optional(),
    utmSource: z.string().max(512).optional(),
    utmMedium: z.string().max(512).optional(),
    utmCampaign: z.string().max(512).optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((data) => !data.meta || JSON.stringify(data.meta).length <= 2048, {
    message: 'meta too large',
    path: ['meta'],
  })

// Public, unauthenticated endpoint -- 120 events per IP per minute.
//
// Uses the shared RateLimiter rather than a private Map, so this endpoint gets
// the Redis-backed shared counter automatically once REDIS_URL is set. It
// previously duplicated the limiter inline, which meant it kept per-process
// limits even after the shared one was migrated. The `t:` key prefix keeps its
// budget separate from the search/auth limiters for the same IP.
const limiter = new RateLimiter(120, 60 * 1000)

function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 })
}

/**
 * Ingest beacon for first-party analytics. Never throws a 500 -- this is a
 * public route called by navigator.sendBeacon from every page, so any
 * failure here must degrade to a silent no-op, not a broken UI.
 *
 * navigator.sendBeacon sends the body as text/plain, so content-type is
 * ignored on purpose; the body is read as text and parsed as JSON.
 */
export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get('user-agent')
    if (isBot(ua)) return noContent()

    let raw: unknown
    try {
      raw = JSON.parse(await req.text())
    } catch {
      return noContent()
    }

    const parsed = EventSchema.safeParse(raw)
    if (!parsed.success) return noContent()

    const data = parsed.data
    if (data.path && (data.path.startsWith('/admin') || data.path.startsWith('/api'))) {
      return noContent()
    }

    const ip = clientIp(req)
    if (!(await limiter.check(`t:${ip || 'anon'}`))) return noContent()

    const ipHash = hashIp(ip)
    const device = parseDevice(ua)
    const browser = parseBrowser(ua)

    // Do the geo lookup + insert after the response is already sent, so the
    // beacon call itself stays fast regardless of ip-api.com latency.
    after(async () => {
      try {
        const geo = await coarseGeo(ip)
        const payload = await getPayload({ config })
        await insertEvent(payload, {
          eventType: data.event_type,
          path: data.path ?? null,
          entityType: data.entityType ?? null,
          entityId: data.entityId ?? null,
          sessionId: data.sessionId ?? null,
          visitorId: data.visitorId ?? null,
          referrer: data.referrer ?? null,
          utmSource: data.utmSource ?? null,
          utmMedium: data.utmMedium ?? null,
          utmCampaign: data.utmCampaign ?? null,
          ipHash,
          geoCity: geo.city,
          geoState: geo.state,
          device,
          browser,
          meta: data.meta ?? null,
        })
      } catch (err) {
        console.error('[analytics] deferred insert failed:', err)
      }
    })

    return noContent()
  } catch (err) {
    console.error('[analytics] ingest error:', err)
    return noContent()
  }
}

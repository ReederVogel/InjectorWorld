import { NextRequest, NextResponse } from 'next/server'
import { RateLimiter, getIp } from '@/lib/rate-limit'
import { geoFromCloudflare, lookupGeo, NULL_GEO, type GeoResult } from '@/lib/geo-ip'
import { getPayloadInstance } from '@/lib/payload-server'
import { lookupZip } from '@/lib/zip-lookup'

export const dynamic = 'force-dynamic'

/**
 * Coarse geo for the calling browser, used to prefill location inputs.
 *
 * Response shape is unchanged from the original implementation, because six
 * client components read it directly (HeroSearch, ListingFilters,
 * FeaturedClinicsSection, ZipPromoBanner, IpStateHint, AssistantWidget) and all
 * of them expect exactly these keys.
 *
 * What changed is everything behind it. The previous version:
 *
 *   - read the LEFTMOST X-Forwarded-For entry, which the caller writes, so the
 *     "client IP" was whatever the caller said it was;
 *   - never checked the value was an IP before putting it in an outbound URL;
 *   - cached into a Map with no size limit, keyed on that same spoofable value,
 *     which made unbounded memory growth a one-header trick;
 *   - had no rate limit, so every uncached value cost an outbound HTTP call and
 *     a few thousand of them would get this server banned by the geo provider.
 *
 * Address resolution now goes through getIp() (trusted proxy hop, not the
 * leftmost entry) and the lookup itself through lib/geo-ip, which validates the
 * address, bounds the cache, and caps outbound calls per minute.
 */

/**
 * Generous on purpose. Several components call this on mount, so a single
 * homepage view can legitimately produce four or five requests, and a user
 * browsing quickly will produce more. The point of the limit is to turn
 * "unbounded" into "bounded", not to police normal use — the shared cache in
 * lib/geo-ip already makes repeat calls for the same address free.
 */
const limiter = new RateLimiter(120, 60 * 1000)

export type GeoIpResult = GeoResult

export async function GET(req: NextRequest) {
  const ip = getIp(req)

  if (!(await limiter.check(`geo:${ip}`))) {
    // Answer 200 with empty geo rather than 429. Callers treat this as optional
    // decoration and a non-200 would surface as a console error on a page that
    // is otherwise working fine.
    return NextResponse.json(NULL_GEO, { headers: { 'Cache-Control': 'no-store' } })
  }

  // Cloudflare's visitor location headers first: instant, and no outbound
  // budget to run out of. lookupGeo returns NULL_GEO for anything that is not
  // a valid public address, so no separate validation branch is needed here.
  const fromCf = geoFromCloudflare(req.headers)
  const result = fromCf ?? (await lookupGeo(ip))

  /**
   * A postal code is only a ZIP when it is a US postal code. Returning the raw
   * value let every consumer treat a six digit PIN as a five digit ZIP. Nulling
   * it here fixes all six consumers at once rather than one hook.
   *
   * `country` is additive and `zip` keeps its type, so the response contract
   * that HeroSearch, ListingFilters, FeaturedClinicsSection, ZipPromoBanner,
   * IpStateHint and AssistantWidget read is unchanged.
   */
  const usZip = result.country === 'US' && result.zip && /^\d{5}$/.test(result.zip)
  const body = usZip ? result : { ...result, zip: null }

  /**
   * `?centre=1` (2026-09-24): also return the centre of that ZIP from our own
   * zip_codes table, so the near-me listing gets everything it needs in ONE
   * request instead of /api/geo/ip followed by /api/geo/zip. Distances are
   * measured from the ZIP centre, never the IP point (locked 2026-09-12).
   * Additive: the six existing callers never pass it and see the same body.
   * See docs/PAGE-SPEED-PLAN-2026-09-24.md TASK 3.
   */
  let centre: { lat: number; lng: number; city: string | null; state: string | null } | null = null
  if (usZip && req.nextUrl.searchParams.get('centre') === '1') {
    try {
      const payload = await getPayloadInstance()
      const hit = await lookupZip(body.zip as string, (payload.db as any).pool)
      if (hit) centre = { lat: hit.lat, lng: hit.lng, city: hit.city, state: hit.state }
    } catch {
      // The hook falls back to /api/geo/zip when centre is null.
    }
  }

  return NextResponse.json(
    { ...body, source: fromCf ? 'cf' : 'ipapi', ...(centre ? { centre } : {}) },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

import { NextRequest, NextResponse } from 'next/server'
import { RateLimiter, getIp } from '@/lib/rate-limit'
import { lookupGeo, NULL_GEO, type GeoResult } from '@/lib/geo-ip'

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

  // lookupGeo returns NULL_GEO for anything that is not a valid public address,
  // so no separate validation branch is needed here.
  const result = await lookupGeo(ip)

  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}

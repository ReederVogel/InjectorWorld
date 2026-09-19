import { NextRequest, NextResponse } from 'next/server'
import { getPayloadInstance } from '@/lib/payload-server'
import { getLocationSlugMap, lookupSlugs } from '@/lib/location-slug-lookup'
import {
  fetchLeanClinics,
  leanRowToListingJson,
  parseLeanListingFilters,
} from '@/lib/lean-clinic-listing'
import { RateLimiter, enforceLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * Public and unauthenticated, and every call runs a database query against a
 * pool that is deliberately capped at 4 connections (see payload.config.ts).
 * Without a limit, a few dozen concurrent requests take the pool and the whole
 * site stops answering — that failure was reproduced against staging.
 *
 * 60/minute matches /api/search. One page of results is one request, so a real
 * visitor clicking through pagination never approaches it.
 */
const limiter = new RateLimiter(60, 60 * 1000)

function parsePage(value: string | null): number {
  const n = Number(value ?? '1')
  return Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1
}

function parseLimit(value: string | null): number {
  const n = Number(value ?? '24')
  return Number.isFinite(n) ? Math.min(48, Math.max(12, Math.floor(n))) : 24
}

function clinicCityName(locationName: string): string {
  return locationName.replace(/\s+city$/i, '').trim()
}

export async function GET(req: NextRequest) {
  const blocked = await enforceLimit(req, limiter, 'city-clinics')
  if (blocked) return blocked

  const { searchParams } = req.nextUrl
  const stateSlug = searchParams.get('stateSlug')
  const citySlug = searchParams.get('citySlug')
  const page = parsePage(searchParams.get('page'))
  const limit = parseLimit(searchParams.get('limit'))

  if (!stateSlug) return NextResponse.json({ error: 'Missing stateSlug' }, { status: 400 })
  if (!citySlug) return NextResponse.json({ error: 'Missing citySlug' }, { status: 400 })

  const payload = await getPayloadInstance()
  const [stateRes, cityRes] = await Promise.all([
    payload.find({
      collection: 'locations',
      where: { and: [{ slug: { equals: stateSlug } }, { kind: { equals: 'state' } }] },
      limit: 1,
      depth: 0,
    }),
    payload.find({
      collection: 'locations',
      where: { and: [{ slug: { equals: citySlug } }, { kind: { in: ['city', 'metro'] } }] },
      limit: 1,
      depth: 0,
    }),
  ])

  const stateLoc = stateRes.docs[0]
  const cityLoc = cityRes.docs[0]
  if (!stateLoc) return NextResponse.json({ error: 'State not found' }, { status: 404 })
  if (!cityLoc) return NextResponse.json({ error: 'City not found' }, { status: 404 })

  const stateCode = stateLoc.state ?? cityLoc.state ?? ''
  const cityName = clinicCityName(cityLoc.name ?? '')
  const pool = (payload.db as any).pool

  // Moved off payload.find() 2026-09-19, for the ordering and pagination
  // reasons in app/api/state-clinics/route.ts, and for one more that is
  // specific to this route: the old where clause was { city: { like: cityName } },
  // which Payload compiles to ILIKE '%value%', a SUBSTRING match. The same bug
  // was fixed in lib/location-queries.ts on 2026-09-07 and this route was
  // missed, so /clinics/ohio/cleveland-oh rendered 44 clinics and its first
  // Load more returned totalDocs 56 with Cleveland Heights rows in it.
  // fetchLeanClinics uses `c.city ILIKE $n` with no wildcards, which is an
  // exact case-insensitive match and agrees with the page's own count query.
  /**
   * Distance ORDERING is the visitor's IP talking, and on a state or city page
   * they have already chosen a place (CLAUDE.md "Page furniture", locked
   * 2026-09-10). parseLeanListingFilters derives `near` from bare coordinates,
   * which ListingFilters sends on every page as soon as its own geo call
   * answers, so spreading the parsed filters straight in handed this route the
   * near-me sort by accident.
   *
   * The radius FILTER stays. That one is an explicit choice in the filter
   * panel, page 1 is re-queried from this same endpoint when it is made, and
   * with a radius set nearest-first is the order the visitor asked for.
   * See docs/LISTING-FIX-PLAN-2026-09-19.md section 1.8.
   */
  const { near, ...parsedFilters } = parseLeanListingFilters(searchParams)
  const listingFilters = parsedFilters.radiusMiles != null ? { ...parsedFilters, near } : parsedFilters

  const [slugMap, res] = await Promise.all([
    getLocationSlugMap(),
    fetchLeanClinics(pool, {
      stateCode: stateCode || undefined,
      cityLike: cityName || undefined,
      limit,
      offset: (page - 1) * limit,
      ...listingFilters,
    }),
  ])

  const clinics = res.rows.map((c) =>
    leanRowToListingJson(c, lookupSlugs(c.city ?? '', c.state ?? '', slugMap)),
  )

  const hasNextPage = page * limit < res.totalCount
  return NextResponse.json({
    clinics,
    totalDocs: res.totalCount,
    hasNextPage,
    nextPage: hasNextPage ? page + 1 : null,
  })
}

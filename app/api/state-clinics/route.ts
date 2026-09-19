import { NextRequest, NextResponse } from 'next/server'
import { getPayloadInstance } from '@/lib/payload-server'
import { getLocationSlugMap, lookupSlugs } from '@/lib/location-slug-lookup'
import {
  fetchLeanClinics,
  leanRowToListingJson,
  parseLeanListingFilters,
} from '@/lib/lean-clinic-listing'
import { RateLimiter, enforceLimit } from '@/lib/rate-limit'

// Public, unauthenticated, hits the 4-connection pool on every call.
// See app/api/city-clinics/route.ts for why this is not optional.
const limiter = new RateLimiter(60, 60 * 1000)

function parsePage(value: string | null): number {
  const n = Number(value ?? '1')
  return Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1
}

function parseLimit(value: string | null): number {
  const n = Number(value ?? '24')
  return Number.isFinite(n) ? Math.min(48, Math.max(12, Math.floor(n))) : 24
}

export async function GET(req: NextRequest) {
  const blocked = await enforceLimit(req, limiter, 'state-clinics')
  if (blocked) return blocked

  const { searchParams } = req.nextUrl
  const stateSlug = searchParams.get('stateSlug')
  const page = parsePage(searchParams.get('page'))
  const limit = parseLimit(searchParams.get('limit'))

  if (!stateSlug) return NextResponse.json({ error: 'Missing stateSlug' }, { status: 400 })

  const payload = await getPayloadInstance()
  const stateRes = await payload.find({
    collection: 'locations',
    where: { and: [{ slug: { equals: stateSlug } }, { kind: { equals: 'state' } }] },
    limit: 1,
    depth: 0,
  })
  const stateLoc = stateRes.docs[0]
  if (!stateLoc) return NextResponse.json({ error: 'State not found' }, { status: 404 })

  const stateCode = stateLoc.state ?? ''
  const pool = (payload.db as any).pool

  // Moved off payload.find() 2026-09-19. payload.find() cannot express a
  // NULLS LAST sort and had no tiebreak at all, so two things were wrong at
  // once: 38,998 of 57,592 published clinics have a null review count and
  // Postgres sorts nulls FIRST under DESC, which put review-less clinics at
  // the top of every state page; and the resulting tie group let a row land on
  // two adjacent pages while another fell through the gap (72 rows fetched,
  // 65 unique on Texas). fetchLeanClinics carries both NULLS LAST and the
  // c.id DESC tiebreak, and it is what /api/clinics-list, /api/brand-clinics
  // and /api/service-city-clinics already use. See
  // docs/LISTING-FIX-PLAN-2026-09-19.md TASK 1.
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

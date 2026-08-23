import { NextRequest, NextResponse } from 'next/server'
import { getPayloadInstance } from '@/lib/payload-server'
import { getLocationSlugMap, lookupSlugs } from '@/lib/location-slug-lookup'
import { boundingBoxWhere, parseLeanListingFilters } from '@/lib/lean-clinic-listing'
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

  const where = [
    { state: { equals: stateCode } },
    { status: { equals: 'published' } },
  ] as any[]

  // Listing filters, added 2026-08-07. Applied server-side so they see every
  // matching clinic and so totalDocs counts the filtered set.
  const listingFilters = parseLeanListingFilters(searchParams)
  if (listingFilters.brandIds) where.push({ brandsOffered: { in: listingFilters.brandIds } })
  if (listingFilters.serviceIds) where.push({ servicesOffered: { in: listingFilters.serviceIds } })
  if (listingFilters.clinicTypes) where.push({ clinicType: { in: listingFilters.clinicTypes } })
  if (listingFilters.minRating != null) {
    where.push({ aggregateRating: { greater_than_equal: listingFilters.minRating } })
  }
  where.push(...boundingBoxWhere(listingFilters))

  const [slugMap, clinicsRes] = await Promise.all([
    getLocationSlugMap(),
    payload.find({
      collection: 'clinics',
      where: { and: where },
      limit,
      page,
      depth: 0,
      sort: '-aggregateRatingCount',
    }),
  ])

  const clinics = (clinicsRes.docs as any[]).map((c: any) => {
    const slugs = lookupSlugs(c.city ?? '', c.state ?? '', slugMap)
    return {
      id: String(c.id),
      slug: c.slug,
      citySlug: slugs.citySlug,
      stateSlug: slugs.stateSlug,
      clinicName: c.clinicName,
      tagline: c.tagline ?? undefined,
      city: c.city,
      state: c.state,
      neighborhood: c.neighborhood ?? undefined,
      aggregateRating: c.aggregateRating ?? undefined,
      aggregateRatingCount: c.aggregateRatingCount ?? undefined,
      photoUrl: c.clinicPhotoUrls?.[0]?.url ?? undefined,
      latitude: Number(c.latitude) || 0,
      longitude: Number(c.longitude) || 0,
      providerCount: 0,
      clinicType: c.clinicType ?? undefined,
      startingPrice: c.startingPrice ?? undefined,
      brandsOffered: Array.isArray(c.brandsOffered)
        ? c.brandsOffered.map((b: any) => String(typeof b === 'object' ? b.id : b)).filter(Boolean)
        : [],
      servicesOffered: Array.isArray(c.servicesOffered)
        ? c.servicesOffered.map((s: any) => String(typeof s === 'object' ? s.id : s)).filter(Boolean)
        : [],
    }
  })

  return NextResponse.json({
    clinics,
    totalDocs: clinicsRes.totalDocs,
    hasNextPage: clinicsRes.hasNextPage,
    nextPage: clinicsRes.nextPage,
  })
}

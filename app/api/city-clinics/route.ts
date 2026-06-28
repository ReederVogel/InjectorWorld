import { NextRequest, NextResponse } from 'next/server'
import { getPayloadInstance } from '@/lib/payload-server'
import { getLocationSlugMap, lookupSlugs } from '@/lib/location-slug-lookup'

export const dynamic = 'force-dynamic'

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

  const [slugMap, clinicsRes] = await Promise.all([
    getLocationSlugMap(),
    payload.find({
      collection: 'clinics',
      where: {
        and: [
          { city: { like: cityName } },
          { state: { equals: stateCode } },
          { status: { equals: 'published' } },
        ],
      },
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
      serviceType: c.serviceType || 'In-Person',
      yearEstablished: c.yearEstablished ?? undefined,
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

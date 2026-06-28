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

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const stateCode = searchParams.get('stateCode') ?? ''
  const city = searchParams.get('city') ?? ''
  const page = parsePage(searchParams.get('page'))
  const limit = parseLimit(searchParams.get('limit'))

  const payload = await getPayloadInstance()

  const where: any = { status: { equals: 'published' } }
  if (stateCode) where.state = { equals: stateCode }
  if (city) where.city = { equals: city }

  const [slugMap, res] = await Promise.all([
    getLocationSlugMap(),
    payload.find({
      collection: 'clinics',
      where: { and: [where] },
      limit,
      page,
      depth: 1,
      sort: '-aggregateRating',
    }),
  ])

  const clinics = (res.docs as any[]).map((c: any) => {
    const s = lookupSlugs(c.city ?? '', c.state ?? '', slugMap)
    const photos: string[] = (c.clinicPhotoUrls ?? [])
      .map((p: any) => typeof p === 'string' ? p : p?.url)
      .filter(Boolean)
    return {
      id: String(c.id),
      slug: c.slug,
      citySlug: s.citySlug,
      stateSlug: s.stateSlug,
      clinicName: c.clinicName,
      tagline: c.tagline ?? null,
      city: c.city ?? '',
      state: c.state ?? '',
      neighborhood: c.neighborhood ?? null,
      aggregateRating: c.aggregateRating ?? null,
      aggregateRatingCount: c.aggregateRatingCount ?? null,
      photoUrl: photos[0] ?? null,
      serviceType: c.serviceType || 'In-Person',
      yearEstablished: c.yearEstablished ?? null,
      latitude: Number(c.latitude) || 0,
      longitude: Number(c.longitude) || 0,
      clinicType: c.clinicType ?? null,
      startingPrice: c.startingPrice ?? null,
      languages: Array.isArray(c.languages) ? c.languages : [],
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
    totalDocs: res.totalDocs,
    hasNextPage: res.hasNextPage ?? false,
    page: res.page,
  })
}

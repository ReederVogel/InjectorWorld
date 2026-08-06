import { NextRequest, NextResponse } from 'next/server'
import { getPayloadInstance } from '@/lib/payload-server'
import { getLocationSlugMap, lookupSlugs } from '@/lib/location-slug-lookup'
import { fetchLeanClinics, num, parseLeanListingFilters } from '@/lib/lean-clinic-listing'

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
  const pool = (payload.db as any).pool

  // Raw SQL instead of payload.find(). payload.find() on 'clinics' joins in
  // EVERY relationship and array field regardless of `depth`, so the old
  // implementation sorted and joined across every matching clinic (tens of
  // thousands, unfiltered) before LIMIT trimmed it to 24. That is the exact
  // pattern that caused the 2026-07-29 outage. See lib/lean-clinic-listing.ts
  // for the full explanation.
  //
  // Behaviour note: the lean query adds `created_at DESC` as a tiebreak after
  // `aggregate_rating_count DESC`. payload.find() had no tiebreak, which made
  // pagination unstable (a clinic could appear on two pages or none when many
  // share a rating count). Ordering within a tie group may therefore differ
  // slightly from before; pagination is now correct where it previously was not.
  const [slugMap, res] = await Promise.all([
    getLocationSlugMap(),
    fetchLeanClinics(pool, {
      stateCode: stateCode || undefined,
      cityLike: city || undefined,
      limit,
      offset: (page - 1) * limit,
      includeLanguages: true,
      // Listing filters run in SQL as of 2026-08-07, so `total` below is the
      // real number of matches, not the unfiltered count.
      ...parseLeanListingFilters(searchParams),
    }),
  ])

  const clinics = res.rows.map((c) => {
    const s = lookupSlugs(c.city ?? '', c.state ?? '', slugMap)
    return {
      id: String(c.id),
      slug: c.slug,
      citySlug: s.citySlug,
      stateSlug: s.stateSlug,
      clinicName: c.clinic_name,
      tagline: c.tagline ?? null,
      city: c.city ?? '',
      state: c.state ?? '',
      neighborhood: c.neighborhood ?? null,
      // numeric columns arrive from pg as strings — see num() for why. The card
      // calls aggregateRating.toFixed(1), so passing "4.2" through crashes it.
      aggregateRating: num(c.aggregate_rating),
      aggregateRatingCount: num(c.aggregate_rating_count),
      photoUrl: c.photo_url ?? null,
      serviceType: c.service_type || 'In-Person',
      yearEstablished: num(c.year_established),
      latitude: Number(c.latitude) || 0,
      longitude: Number(c.longitude) || 0,
      clinicType: c.clinic_type ?? null,
      startingPrice: num(c.starting_price),
      languages: c.languages ?? [],
      // IDs come back as raw ints from SQL; the response contract is strings.
      brandsOffered: (c.brands_offered ?? []).map((b) => String(b)),
      servicesOffered: (c.services_offered ?? []).map((x) => String(x)),
      // Providers aren't live yet; DirectoryClinicCard hides this row at 0.
      providerCount: 0,
    }
  })

  return NextResponse.json({
    clinics,
    totalDocs: res.totalCount,
    hasNextPage: page * limit < res.totalCount,
    page,
  })
}

import { getPayloadInstance } from './payload-server'
import { getLocationSlugMap, lookupSlugs } from './location-slug-lookup'

// ─── Types ───────────────────────────────────────────────────────────────────

export type BrandLocation = {
  id: string
  slug: string
  clinicName: string
  citySlug: string
  stateSlug: string
  city: string
  state: string
  neighborhood?: string
  aggregateRating?: number
  aggregateRatingCount?: number
  photoUrl?: string
  latitude: number
  longitude: number
  providerCount: number
  /** True when this clinic's state is a launched (live) market. */
  isLive: boolean
}

export type BrandProvider = {
  id: string
  slug: string
  fullName: string
  credentials: string
  title: string
  profilePhotoUrl?: string
  aggregateRating?: number
  clinicCity: string
  clinicState: string
  clinicCitySlug: string
  clinicStateSlug: string
}

export type BrandListItem = {
  id: string
  slug: string
  name: string
  description?: string
  logoUrl?: string
  websiteUrl?: string
  locationCount: number
  stateCount: number
  cities: string[]
  /** Best photo to show on the brand card (first branch with a photo). */
  photoUrl?: string
}

export type BrandDetail = {
  id: string
  brandId: string
  slug: string
  name: string
  description?: string
  logoUrl?: string
  websiteUrl?: string
  instagramUrl?: string
  tiktokUrl?: string
  linkedinUrl?: string
  claimed: boolean
  locations: BrandLocation[]
  providers: BrandProvider[]
  states: string[]
  cities: string[]
  /** Whether at least one branch is in a live market (drives indexability). */
  hasLiveLocation: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** State codes (e.g. ["CA","TX"]) whose state Location is switched live in admin. */
async function getLiveStateCodes(payload: any): Promise<Set<string>> {
  try {
    const res = await payload.find({
      collection: 'locations',
      where: { and: [{ kind: { equals: 'state' } }, { isLive: { equals: true } }] },
      limit: 100,
      depth: 0,
    })
    const codes = new Set<string>()
    for (const loc of res.docs) {
      const code = (loc.state || '').toUpperCase()
      if (code) codes.add(code)
    }
    return codes
  } catch {
    return new Set<string>()
  }
}

function clinicPhoto(c: any): string | undefined {
  return Array.isArray(c.clinicPhotoUrls) && c.clinicPhotoUrls[0]?.url
    ? c.clinicPhotoUrls[0].url
    : undefined
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/** All brands that have at least one linked clinic, with summary stats. */
export async function getBrandsListing(): Promise<BrandListItem[]> {
  const payload = await getPayloadInstance()
  const brandsRes = await payload.find({ collection: 'brands', limit: 500, depth: 0, sort: 'name' })
  if (brandsRes.docs.length === 0) return []

  // One clinics query covers every brand; group in memory (no per-brand round trip).
  const clinicsRes = await payload.find({
    collection: 'clinics',
    where: { brand: { exists: true } },
    limit: 5000,
    depth: 0,
  })
  const byBrand = new Map<string, any[]>()
  for (const c of clinicsRes.docs) {
    const brandId = c.brand && typeof c.brand === 'object' ? String(c.brand.id) : String(c.brand)
    if (!brandId || brandId === 'null' || brandId === 'undefined') continue
    const list = byBrand.get(brandId) ?? []
    list.push(c)
    byBrand.set(brandId, list)
  }

  const items: BrandListItem[] = []
  for (const b of brandsRes.docs) {
    const clinics = byBrand.get(String(b.id)) ?? []
    if (clinics.length === 0) continue // a brand with no branches has no hub to show
    const states = Array.from(new Set(clinics.map((c) => c.state))).filter(Boolean)
    const cities = Array.from(new Set(clinics.map((c) => c.city))).filter(Boolean)
    items.push({
      id: String(b.id),
      slug: b.slug,
      name: b.name,
      description: b.description ?? undefined,
      logoUrl: b.logoUrl ?? undefined,
      websiteUrl: b.websiteUrl ?? undefined,
      locationCount: clinics.length,
      stateCount: states.length,
      cities,
      photoUrl: clinics.map(clinicPhoto).find(Boolean),
    })
  }
  return items.sort((a, b) => b.locationCount - a.locationCount)
}

export async function getBrandBySlug(slug: string): Promise<BrandDetail | null> {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'brands',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
  })
  const b = res.docs[0]
  if (!b) return null

  // Clinics under this brand
  const clinicsRes = await payload.find({
    collection: 'clinics',
    where: { brand: { equals: b.id } },
    limit: 500,
    depth: 0,
    sort: '-aggregateRatingCount',
  })

  const [liveStates, slugMap] = await Promise.all([
    getLiveStateCodes(payload),
    getLocationSlugMap(),
  ])
  const clinicIds = clinicsRes.docs.map((c: any) => c.id)

  // Provider counts per clinic + all providers under the brand, in one query.
  let providerDocs: any[] = []
  if (clinicIds.length > 0) {
    const provRes = await payload.find({
      collection: 'providers',
      where: { clinic: { in: clinicIds } },
      limit: 1000,
      depth: 1,
      sort: '-aggregateRatingCount',
    })
    providerDocs = provRes.docs
  }

  const countByClinic = new Map<string, number>()
  for (const p of providerDocs) {
    const cid = p.clinic && typeof p.clinic === 'object' ? String(p.clinic.id) : String(p.clinic)
    countByClinic.set(cid, (countByClinic.get(cid) ?? 0) + 1)
  }

  const locations: BrandLocation[] = clinicsRes.docs.map((c: any) => {
    const s = lookupSlugs(c.city ?? '', c.state ?? '', slugMap)
    return {
    id: String(c.id),
    slug: c.slug,
    clinicName: c.clinicName,
    citySlug: s.citySlug,
    stateSlug: s.stateSlug,
    city: c.city,
    state: c.state,
    neighborhood: c.neighborhood ?? undefined,
    aggregateRating: c.aggregateRating ?? undefined,
    aggregateRatingCount: c.aggregateRatingCount ?? undefined,
    photoUrl: clinicPhoto(c),
    latitude: Number(c.latitude) || 0,
    longitude: Number(c.longitude) || 0,
    providerCount: countByClinic.get(String(c.id)) ?? 0,
    isLive: liveStates.has((c.state || '').toUpperCase()),
  }
  })

  const providers: BrandProvider[] = providerDocs.map((p: any) => {
    const clinicCity = p.clinic && typeof p.clinic === 'object' ? p.clinic.city : ''
    const clinicState = p.clinic && typeof p.clinic === 'object' ? p.clinic.state : ''
    const ps = lookupSlugs(clinicCity, clinicState, slugMap)
    return {
      id: String(p.id),
      slug: p.slug,
      fullName: p.fullName,
      credentials: p.credentials,
      title: p.title,
      profilePhotoUrl: p.profilePhotoUrl ?? undefined,
      aggregateRating: p.aggregateRating ?? undefined,
      clinicCity,
      clinicState,
      clinicCitySlug: ps.citySlug,
      clinicStateSlug: ps.stateSlug,
    }
  })

  const states = Array.from(new Set(locations.map((l) => l.state))).filter(Boolean)
  const cities = Array.from(new Set(locations.map((l) => l.city))).filter(Boolean)

  return {
    id: String(b.id),
    brandId: b.brandId,
    slug: b.slug,
    name: b.name,
    description: b.description ?? undefined,
    logoUrl: b.logoUrl ?? undefined,
    websiteUrl: b.websiteUrl ?? undefined,
    instagramUrl: b.instagramUrl ?? undefined,
    tiktokUrl: b.tiktokUrl ?? undefined,
    linkedinUrl: b.linkedinUrl ?? undefined,
    claimed: !!b.claimed,
    locations,
    providers,
    states,
    cities,
    hasLiveLocation: locations.some((l) => l.isLive),
  }
}


export async function getAllBrandSlugs(): Promise<string[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({ collection: 'brands', limit: 5000, depth: 0 })
  return res.docs.map((b: any) => b.slug).filter(Boolean)
}

/**
 * Minimal brand summary for a single clinic page ("Part of [Brand]" + sibling
 * branches). Returns null when the clinic has no brand. Excludes the current
 * clinic from the sibling list.
 */
export async function getBrandForClinic(
  brandRef: any,
  currentClinicId: string,
): Promise<{
  id: string
  slug: string
  name: string
  logoUrl?: string
  otherLocations: Array<{ id: string; slug: string; clinicName: string; city: string; state: string; citySlug: string; stateSlug: string }>
} | null> {
  if (!brandRef) return null
  const payload = await getPayloadInstance()
  const brandId = typeof brandRef === 'object' ? brandRef.id : brandRef

  let brand: any
  try {
    brand = await payload.findByID({ collection: 'brands', id: brandId, depth: 0 })
  } catch {
    return null
  }
  if (!brand) return null

  const [clinicsRes, slugMap] = await Promise.all([
    payload.find({
      collection: 'clinics',
      where: { brand: { equals: brandId } },
      limit: 200,
      depth: 0,
      sort: 'state',
    }),
    getLocationSlugMap(),
  ])

  const otherLocations = clinicsRes.docs
    .filter((c: any) => String(c.id) !== String(currentClinicId))
    .map((c: any) => {
      const s = lookupSlugs(c.city ?? '', c.state ?? '', slugMap)
      return {
        id: String(c.id),
        slug: c.slug,
        clinicName: c.clinicName,
        city: c.city,
        state: c.state,
        citySlug: s.citySlug,
        stateSlug: s.stateSlug,
      }
    })

  return {
    id: String(brand.id),
    slug: brand.slug,
    name: brand.name,
    logoUrl: brand.logoUrl ?? undefined,
    otherLocations,
  }
}

import { cache } from 'react'
import { getPayloadInstance } from './payload-server'
import { getLocationSlugMap, lookupSlugs } from './location-slug-lookup'
import { byMeritDesc } from './merit'
import { getAnsweredQAs, type QAItem } from './qa-queries'
import type { DirectoryClinic, LocationInfo, FaqRow } from './location-queries'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BrandInfo = {
  id: string
  name: string
  slug: string
  manufacturer?: string
  category: string
  tagline?: string
  shortDescription?: string
  iconSlug?: string
  guide: { title: string; slug: string; lede: string } | null
  avgPriceFromUsd?: number
  avgPriceToUsd?: number
  priceUnit?: string
  longevityLabel?: string
  downtimeLabel?: string
  websiteUrl?: string
  logoUrl?: string
}

export type BrandIndexEntry = {
  id: string
  name: string
  slug: string
  category: string
  tagline?: string
  clinicCount: number
}

export type BrandStateEntry = { code: string; name: string; slug: string }

export type BrandCityEntry = {
  name: string
  slug: string
  clinicCount: number
  stateCode: string
  stateSlug: string
}

export type BrandPillarData = {
  brand: BrandInfo
  topClinics: DirectoryClinic[]
  states: BrandStateEntry[]
  allCities: BrandCityEntry[]
  relatedServices: Array<{ id: string; name: string; slug: string }>
  faqs: FaqRow[]
  totalClinics: number
}

export type BrandStateData = {
  brand: BrandInfo
  state: LocationInfo
  cities: LocationInfo[]
  faqs: FaqRow[]
  totalClinics: number
}

export type BrandCityData = {
  brand: BrandInfo
  city: LocationInfo
  stateLocation: LocationInfo | null
  clinics: DirectoryClinic[]
  relatedServices: Array<{ id: string; name: string; slug: string }>
  faqs: FaqRow[]
  totalClinics: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapBrand(b: any): BrandInfo {
  return {
    id: String(b.id),
    name: b.name,
    slug: b.slug,
    manufacturer: b.manufacturer ?? undefined,
    category: b.category ?? '',
    tagline: b.tagline ?? undefined,
    shortDescription: b.shortDescription ?? undefined,
    iconSlug: b.iconSlug ?? undefined,
    guide:
      b.guide && typeof b.guide === 'object'
        ? { title: b.guide.title, slug: b.guide.slug, lede: b.guide.lede }
        : null,
    avgPriceFromUsd: b.avgPriceFromUsd ?? undefined,
    avgPriceToUsd: b.avgPriceToUsd ?? undefined,
    priceUnit: b.priceUnit ?? undefined,
    longevityLabel: b.longevityLabel ?? undefined,
    downtimeLabel: b.downtimeLabel ?? undefined,
    websiteUrl: b.websiteUrl ?? undefined,
    logoUrl: b.logoUrl ?? undefined,
  }
}

function mapLocation(c: any, stateCodeOverride?: string) {
  return {
    id: String(c.id),
    name: c.name ?? '',
    slug: c.slug,
    kind: c.kind ?? '',
    stateCode: stateCodeOverride ?? c.state ?? '',
    latitude: c.latitude ?? undefined,
    longitude: c.longitude ?? undefined,
    providerCount: c.providerCount ?? 0,
    isLive: c.isLive === true,
    noindex: c.noindex !== false,
  }
}

function mapClinic(c: any, slugMap: Map<string, any>, clinicCount?: number): DirectoryClinic {
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
    providerCount: clinicCount ?? 0,
    clinicType: c.clinicType ?? undefined,
    startingPrice: c.startingPrice ?? undefined,
  }
}

async function getFaqsByScope(payload: any, scope: string, brandTag?: string, cityTag?: string): Promise<FaqRow[]> {
  const where: any = { scope: { equals: scope } }
  if (brandTag) where.treatmentTag = { like: brandTag }
  if (cityTag) where.cityTag = { like: cityTag }
  const res = await payload.find({ collection: 'faqs', where, limit: 8, sort: 'sortRank', depth: 0 })
  return res.docs.map((f: any) => ({ id: String(f.id), question: f.question, answer: f.answer }))
}

// ─── Brands index — /brands ───────────────────────────────────────────────────

export const getBrandsIndex = cache(async function getBrandsIndex(): Promise<BrandIndexEntry[]> {
  const payload = await getPayloadInstance()

  const [brandsRes, pool] = await Promise.all([
    payload.find({ collection: 'brands', limit: 500, depth: 0, sort: 'name' }),
    Promise.resolve((payload.db as any).pool),
  ])

  // Clinic count per brand via raw SQL for accuracy.
  const counts = new Map<string, number>()
  try {
    const r = await pool.query(
      `SELECT cr.brands_id AS bid, count(*)::int AS n
         FROM clinics c
         JOIN clinics_rels cr ON cr.parent_id = c.id AND cr.brands_id IS NOT NULL
        WHERE c.status = 'published'
        GROUP BY cr.brands_id`,
    )
    for (const row of r.rows) counts.set(String(row.bid), Number(row.n))
  } catch { /* counts stay 0 */ }

  return (brandsRes.docs as any[]).map((b) => ({
    id: String(b.id),
    name: b.name,
    slug: b.slug,
    category: b.category ?? '',
    tagline: b.tagline ?? undefined,
    clinicCount: counts.get(String(b.id)) ?? 0,
  }))
})

// ─── Brand pillar — /brands/[brand] ──────────────────────────────────────────

export const getBrandPillar = cache(async function getBrandPillar(brandSlug: string): Promise<BrandPillarData | null> {
  const payload = await getPayloadInstance()

  const brandRes = await payload.find({
    collection: 'brands',
    where: { slug: { equals: brandSlug } },
    limit: 1,
    depth: 2,
  })
  const b = brandRes.docs[0]
  if (!b) return null

  const [slugMap, topClinicsRes, statesRes, allCitiesRes, faqs, relatedServicesRes] = await Promise.all([
    getLocationSlugMap(),
    payload.find({
      collection: 'clinics',
      where: { and: [{ brandsOffered: { in: [b.id] } }, { status: { equals: 'published' } }] },
      limit: 12,
      depth: 0,
      sort: '-aggregateRating',
    }),
    payload.find({ collection: 'locations', where: { kind: { equals: 'state' } }, limit: 60, sort: 'name', depth: 0 }),
    payload.find({ collection: 'locations', where: { kind: { in: ['metro', 'city'] } }, limit: 500, sort: 'name', depth: 0 }),
    getFaqsByScope(payload, 'treatment', b.name),
    payload.find({ collection: 'services', limit: 100, depth: 0, sort: 'name' }),
  ])

  // Total clinic count
  let totalClinics = topClinicsRes.totalDocs ?? 0
  try {
    const pool = (payload.db as any).pool
    const r = await pool.query(
      `SELECT count(*)::int AS n FROM clinics c
         JOIN clinics_rels cr ON cr.parent_id = c.id AND cr.brands_id = $1
        WHERE c.status = 'published'`,
      [b.id],
    )
    totalClinics = Number(r.rows[0]?.n ?? 0)
  } catch { /* use totalDocs */ }

  const stateSlugByCode = new Map<string, string>(
    (statesRes.docs as any[]).map((s: any) => [s.state ?? '', s.slug as string]),
  )

  const allCities: BrandCityEntry[] = (allCitiesRes.docs as any[])
    .map((c: any) => {
      const stateCode: string = c.state ?? ''
      return {
        name: c.name,
        slug: c.slug,
        clinicCount: c.providerCount ?? 0,
        stateCode,
        stateSlug: stateSlugByCode.get(stateCode) ?? '',
      }
    })
    .filter((c) => c.stateCode)

  const stateCodes = new Set(allCities.map((c) => c.stateCode))
  const states: BrandStateEntry[] = (statesRes.docs as any[])
    .map((s: any) => ({ code: s.state ?? '', name: s.name, slug: s.slug }))
    .filter((s) => s.code && stateCodes.has(s.code))

  const relatedServices = (relatedServicesRes.docs as any[]).map((s: any) => ({
    id: String(s.id),
    name: s.name,
    slug: s.slug,
  }))

  return {
    brand: mapBrand(b),
    topClinics: (topClinicsRes.docs as any[]).map((c: any) => mapClinic(c, slugMap)),
    states,
    allCities,
    relatedServices,
    faqs,
    totalClinics,
  }
})

// ─── Brand × state — /brands/[brand]/[state] ─────────────────────────────────

export const getBrandState = cache(async function getBrandState(
  brandSlug: string,
  stateSlug: string,
): Promise<BrandStateData | null> {
  const payload = await getPayloadInstance()

  const [brandRes, stateRes] = await Promise.all([
    payload.find({ collection: 'brands', where: { slug: { equals: brandSlug } }, limit: 1, depth: 0 }),
    payload.find({ collection: 'locations', where: { and: [{ slug: { equals: stateSlug } }, { kind: { equals: 'state' } }] }, limit: 1, depth: 0 }),
  ])

  const brand = brandRes.docs[0]
  const stateLoc = stateRes.docs[0]
  if (!brand || !stateLoc) return null

  const stateCode: string = stateLoc.state ?? ''

  const [citiesRes, faqs] = await Promise.all([
    payload.find({
      collection: 'locations',
      where: { and: [{ kind: { in: ['metro', 'city'] } }, { state: { equals: stateCode } }] },
      limit: 24,
      sort: '-providerCount',
      depth: 0,
    }),
    getFaqsByScope(payload, 'treatment', brand.name),
  ])

  // Total clinics in this state with this brand
  let totalClinics = 0
  try {
    const pool = (payload.db as any).pool
    const r = await pool.query(
      `SELECT count(*)::int AS n FROM clinics c
         JOIN clinics_rels cr ON cr.parent_id = c.id AND cr.brands_id = $1
        WHERE c.status = 'published' AND upper(c.state) = $2`,
      [brand.id, stateCode.toUpperCase()],
    )
    totalClinics = Number(r.rows[0]?.n ?? 0)
  } catch { /* 0 */ }

  return {
    brand: mapBrand(brand),
    state: mapLocation(stateLoc, stateCode),
    cities: citiesRes.docs.map((c: any) => mapLocation(c)),
    faqs,
    totalClinics,
  }
})

// ─── Brand × city — /brands/[brand]/[state]/[city] ───────────────────────────

export const getBrandCityDirectory = cache(async function getBrandCityDirectory(
  brandSlug: string,
  stateSlug: string,
  citySlug: string,
): Promise<BrandCityData | null> {
  const payload = await getPayloadInstance()

  const [brandRes, cityRes, stateRes] = await Promise.all([
    payload.find({ collection: 'brands', where: { slug: { equals: brandSlug } }, limit: 1, depth: 0 }),
    payload.find({ collection: 'locations', where: { and: [{ slug: { equals: citySlug } }, { kind: { in: ['city', 'metro'] } }] }, limit: 1, depth: 1 }),
    payload.find({ collection: 'locations', where: { and: [{ slug: { equals: stateSlug } }, { kind: { equals: 'state' } }] }, limit: 1, depth: 0 }),
  ])

  const brand = brandRes.docs[0]
  const cityLoc = cityRes.docs[0]
  if (!brand || !cityLoc) return null

  const stateCode: string = cityLoc.state ?? ''
  const cityName = (cityLoc.name as string).replace(/\s+city$/i, '').trim()
  const stateLoc = stateRes.docs[0] ?? null

  const [slugMap, clinicsRes, relatedServicesRes, faqs] = await Promise.all([
    getLocationSlugMap(),
    payload.find({
      collection: 'clinics',
      where: {
        and: [
          { city: { like: cityName } },
          { state: { equals: stateCode } },
          { status: { equals: 'published' } },
          { brandsOffered: { in: [brand.id] } },
        ],
      },
      limit: 500,
      depth: 0,
    }),
    payload.find({ collection: 'services', limit: 100, depth: 0, sort: 'name' }),
    getFaqsByScope(payload, 'city', brand.name, cityName),
  ])

  const totalClinics = clinicsRes.totalDocs ?? clinicsRes.docs.length

  const clinics: DirectoryClinic[] = (clinicsRes.docs as any[])
    .map((c: any) => mapClinic(c, slugMap))
    .sort((a, b) => (b.aggregateRatingCount ?? 0) - (a.aggregateRatingCount ?? 0))

  const relatedServices = (relatedServicesRes.docs as any[]).map((s: any) => ({
    id: String(s.id),
    name: s.name,
    slug: s.slug,
  }))

  return {
    brand: mapBrand(brand),
    city: {
      ...mapLocation(cityLoc, stateCode),
      providerCount: totalClinics,
    },
    stateLocation: stateLoc ? mapLocation(stateLoc, stateCode) : null,
    clinics,
    relatedServices,
    faqs,
    totalClinics,
  }
})

// ─── All brand slugs (for generateStaticParams) ───────────────────────────────

export async function getAllBrandSlugs(): Promise<string[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({ collection: 'brands', limit: 1000, depth: 0 })
  return res.docs.map((b: any) => b.slug).filter(Boolean)
}

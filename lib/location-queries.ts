import { cache } from 'react'
import { getPayloadInstance } from './payload-server'
import { byMeritDesc } from './merit'
import { getWorthItScore, type WorthItResult } from './worth-it'
import { getAnsweredQAs, type QAItem } from './qa-queries'

// ─── Shared types ────────────────────────────────────────────────────────────

export type DirectoryProvider = {
  id: string
  slug: string
  fullName: string
  credentials: string
  title: string
  profilePhotoUrl?: string
  aggregateRating?: number
  aggregateRatingCount?: number
  startingPrice?: number
  treatments: string[]
  editorsPick: boolean
  licenseStateCode: string
  licenseNumber: string
  licenseVerificationUrl?: string
  acceptsNewPatients: boolean
  offersVirtualConsult: boolean
  languages: string[]
  loyaltyPrograms: string[]
  /** Provider bio text. Used in merit completeness scoring. */
  bio?: string
  /** Payload updatedAt ISO string. Used in merit recency scoring. */
  updatedAt?: string
  clinic: {
    id: string
    name: string
    slug: string
    city: string
    state: string
    neighborhood?: string
    latitude: number
    longitude: number
  }
}

/** A clinic surfaced in a city/treatment directory listing. */
export type DirectoryClinic = {
  id: string
  slug: string
  clinicName: string
  tagline?: string
  city: string
  state: string
  neighborhood?: string
  aggregateRating?: number
  aggregateRatingCount?: number
  photoUrl?: string
  serviceType: string
  yearEstablished?: number
  latitude: number
  longitude: number
  /** Number of providers at this clinic offering the directory's treatment. */
  providerCount: number
}

export type LocationInfo = {
  id: string
  name: string
  slug: string
  kind: string
  stateCode: string
  latitude?: number
  longitude?: number
  providerCount: number
  /** Markets control (Phase 3). Whether this market is launched. Default false. */
  isLive: boolean
  /** Markets control (Phase 3). Whether to keep this page out of indexes. Default true. */
  noindex: boolean
}

export type FaqRow = { id: string; question: string; answer: string }
export type TreatmentInfo = {
  id: string
  name: string
  slug: string
  tagline?: string
  iconSlug?: string
  category: string
  painIndex?: number
  longevityLabel?: string
  downtimeLabel?: string
  avgPriceFromUsd?: number
  avgPriceToUsd?: number
  priceUnit?: string
}
export type NeighborhoodInfo = { id: string; name: string; slug: string; providerCount: number }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapProvider(p: any): DirectoryProvider {
  const clinic =
    p.clinic && typeof p.clinic === 'object'
      ? {
          id: String(p.clinic.id),
          name: p.clinic.clinicName,
          slug: p.clinic.slug,
          city: p.clinic.city,
          state: p.clinic.state,
          neighborhood: p.clinic.neighborhood ?? undefined,
          latitude: Number(p.clinic.latitude) || 0,
          longitude: Number(p.clinic.longitude) || 0,
        }
      : { id: '', name: '', slug: '', city: '', state: '', latitude: 0, longitude: 0 }

  return {
    id: String(p.id),
    slug: p.slug,
    fullName: p.fullName,
    credentials: p.credentials,
    title: p.title,
    profilePhotoUrl: p.profilePhotoUrl ?? undefined,
    aggregateRating: p.aggregateRating ?? undefined,
    aggregateRatingCount: p.aggregateRatingCount ?? undefined,
    startingPrice: p.startingPrice ?? undefined,
    treatments: Array.isArray(p.treatmentsOffered)
      ? p.treatmentsOffered.map((t: any) => (typeof t === 'object' ? t.name : '')).filter(Boolean)
      : [],
    editorsPick: !!p.editorsPick,
    licenseStateCode: p.licenseState ?? '',
    licenseNumber: p.licenseNumber ?? '',
    licenseVerificationUrl: p.licenseVerificationUrl ?? undefined,
    acceptsNewPatients: !!p.acceptsNewPatients,
    offersVirtualConsult: !!p.offersVirtualConsult,
    languages: Array.isArray(p.languages) ? p.languages : [],
    loyaltyPrograms: Array.isArray(p.loyaltyPrograms) ? p.loyaltyPrograms : [],
    bio: p.bio ?? undefined,
    updatedAt: p.updatedAt ?? undefined,
    clinic,
  }
}

function mapTreatment(t: any): TreatmentInfo {
  return {
    id: String(t.id),
    name: t.name,
    slug: t.slug,
    tagline: t.tagline ?? undefined,
    iconSlug: t.iconSlug ?? undefined,
    category: t.category ?? '',
    painIndex: t.painIndex ?? undefined,
    longevityLabel: t.longevityLabel ?? undefined,
    downtimeLabel: t.downtimeLabel ?? undefined,
    avgPriceFromUsd: t.avgPriceFromUsd ?? undefined,
    avgPriceToUsd: t.avgPriceToUsd ?? undefined,
    priceUnit: t.priceUnit ?? undefined,
  }
}

function mapLocation(c: any, stateCodeOverride?: string): LocationInfo {
  return {
    id: String(c.id),
    name: c.name,
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

async function getFaqsByScope(
  payload: any,
  scope: string,
  treatmentTag?: string,
  cityTag?: string,
): Promise<FaqRow[]> {
  const where: any = { scope: { equals: scope } }
  if (treatmentTag) where.treatmentTag = { like: treatmentTag }
  if (cityTag) where.cityTag = { like: cityTag }

  const res = await payload.find({
    collection: 'faqs',
    where,
    limit: 8,
    sort: 'sortRank',
    depth: 0,
  })
  return res.docs.map((f: any) => ({
    id: String(f.id),
    question: f.question,
    answer: f.answer,
  }))
}

// Derive a clinic-city name from a location name (e.g. "New York City" → "New York")
function clinicCityName(locationName: string): string {
  return locationName.replace(/\s+city$/i, '').trim()
}

// ─── City directory (1.1) ────────────────────────────────────────────────────

export type CityPricing = {
  avgBotoxPerUnit: number | null
  avgFillerPerSyringe: number | null
  sampleSize: number
}

export type CityDirectoryData = {
  treatment: TreatmentInfo
  city: LocationInfo
  stateLocation: LocationInfo | null
  providers: DirectoryProvider[]
  /** Clinics in this city with at least one provider offering this treatment. */
  clinics: DirectoryClinic[]
  neighborhoods: NeighborhoodInfo[]
  faqs: FaqRow[]
  cityPricing: CityPricing
}

export const getCityDirectory = cache(async function getCityDirectory(
  treatmentSlug: string,
  citySlug: string,
): Promise<CityDirectoryData | null> {
  const payload = await getPayloadInstance()

  const [treatmentRes, cityRes] = await Promise.all([
    payload.find({ collection: 'treatments', where: { slug: { equals: treatmentSlug } }, limit: 1, depth: 0 }),
    payload.find({ collection: 'locations', where: { slug: { equals: citySlug } }, limit: 1, depth: 1 }),
  ])

  const treatment = treatmentRes.docs[0]
  const cityLoc = cityRes.docs[0]
  if (!treatment || !cityLoc) return null

  const stateCode: string = cityLoc.state ?? ''
  const cityName: string = clinicCityName(cityLoc.name)

  const clinicsRes = await payload.find({
    collection: 'clinics',
    where: {
      and: [
        { city: { like: cityName } },
        { state: { equals: stateCode } },
      ],
    },
    limit: 200,
    depth: 0,
  })
  const clinicIds = clinicsRes.docs.map((c: any) => c.id)

  // No sort here — the catch-all page applies merit ordering + organic pins
  // after fetching sponsored providers to deduplicate.
  const providersRes =
    clinicIds.length > 0
      ? await payload.find({
          collection: 'providers',
          where: {
            and: [
              { clinic: { in: clinicIds } },
              { treatmentsOffered: { in: [treatment.id] } },
            ],
          },
          limit: 100,
          depth: 2,
        })
      : { docs: [] }

  const allProviders: DirectoryProvider[] = (providersRes.docs as any[])
    .filter((p: any) => p.clinic && typeof p.clinic === 'object')
    .map(mapProvider)

  // Count providers-offering-this-treatment per clinic, then surface only the
  // clinics that have at least one (keeps the Clinics tab treatment-scoped).
  const providerCountByClinic = new Map<string, number>()
  for (const p of allProviders) {
    if (!p.clinic.id) continue
    providerCountByClinic.set(p.clinic.id, (providerCountByClinic.get(p.clinic.id) ?? 0) + 1)
  }
  const clinics: DirectoryClinic[] = (clinicsRes.docs as any[])
    .filter((c: any) => providerCountByClinic.has(String(c.id)))
    .map((c: any) => ({
      id: String(c.id),
      slug: c.slug,
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
      providerCount: providerCountByClinic.get(String(c.id)) ?? 0,
    }))
    .sort((a, b) => (b.aggregateRatingCount ?? 0) - (a.aggregateRatingCount ?? 0))

  const hoodsRes = await payload.find({
    collection: 'locations',
    where: {
      and: [
        { kind: { equals: 'neighborhood' } },
        { parent: { equals: cityLoc.id } },
      ],
    },
    limit: 20,
    sort: 'sortRank',
    depth: 0,
  })
  const neighborhoods: NeighborhoodInfo[] = hoodsRes.docs.map((h: any) => ({
    id: String(h.id),
    name: h.name,
    slug: h.slug,
    providerCount: h.providerCount ?? 0,
  }))

  const stateRes = await payload.find({
    collection: 'locations',
    where: { and: [{ kind: { equals: 'state' } }, { state: { equals: stateCode } }] },
    limit: 1,
    depth: 0,
  })
  const stateLoc = stateRes.docs[0] ?? null

  const faqs = await getFaqsByScope(payload, 'city', treatment.name, cityName)

  // Compute city-level average pricing from raw provider docs (before mapProvider strips pricing)
  const rawProviders = (providersRes.docs as any[]).filter(
    (p: any) => p.clinic && typeof p.clinic === 'object',
  )
  const botoxUnits = rawProviders
    .map((p: any) => p.pricingBotoxPerUnit as number | null)
    .filter((v): v is number => v != null && v > 0)
  const fillerPrices = rawProviders
    .map((p: any) => p.pricingFillerPerSyringe as number | null)
    .filter((v): v is number => v != null && v > 0)
  const cityPricing: CityPricing = {
    avgBotoxPerUnit: botoxUnits.length > 0
      ? Math.round(botoxUnits.reduce((s, v) => s + v, 0) / botoxUnits.length)
      : null,
    avgFillerPerSyringe: fillerPrices.length > 0
      ? Math.round(fillerPrices.reduce((s, v) => s + v, 0) / fillerPrices.length)
      : null,
    sampleSize: rawProviders.length,
  }

  return {
    treatment: mapTreatment(treatment),
    city: {
      ...mapLocation(cityLoc, stateCode),
      providerCount: allProviders.length || cityLoc.providerCount || 0,
    },
    stateLocation: stateLoc ? mapLocation(stateLoc, stateCode) : null,
    providers: allProviders,
    clinics,
    neighborhoods,
    faqs,
    cityPricing,
  }
})

// ─── Treatment pillar (1.2) ──────────────────────────────────────────────────

export type TreatmentPillarData = {
  treatment: TreatmentInfo & {
    shortDescription?: string
    bodyAreas: string[]
  }
  guide: { title: string; slug: string; lede: string } | null
  topCities: LocationInfo[]
  topProviders: DirectoryProvider[]
  faqs: FaqRow[]
  worthIt: WorthItResult
  relatedQAs: QAItem[]
}

export const getTreatmentPillar = cache(async function getTreatmentPillar(treatmentSlug: string): Promise<TreatmentPillarData | null> {
  const payload = await getPayloadInstance()
  const treatRes = await payload.find({
    collection: 'treatments',
    where: { slug: { equals: treatmentSlug } },
    limit: 1,
    depth: 2,
  })
  const t = treatRes.docs[0]
  if (!t) return null

  const [topCitiesRes, topProvidersRes, faqs, worthIt, relatedQAs] = await Promise.all([
    payload.find({ collection: 'locations', where: { kind: { equals: 'metro' } }, limit: 12, sort: 'sortRank', depth: 0 }),
    payload.find({ collection: 'providers', where: { editorsPick: { equals: true } }, limit: 6, depth: 2, sort: 'featuredRank' }),
    getFaqsByScope(payload, 'treatment', t.name),
    getWorthItScore(t.name),
    getAnsweredQAs({ treatmentTag: t.name, limit: 3 }),
  ])

  const guide =
    t.guide && typeof t.guide === 'object'
      ? { title: t.guide.title, slug: t.guide.slug, lede: t.guide.lede }
      : null

  return {
    treatment: {
      ...mapTreatment(t),
      shortDescription: t.shortDescription ?? undefined,
      bodyAreas: Array.isArray(t.bodyAreas) ? t.bodyAreas : [],
    },
    guide,
    topCities: topCitiesRes.docs.map((c: any) => mapLocation(c)),
    topProviders: (topProvidersRes.docs as any[])
      .filter((p: any) => p.clinic && typeof p.clinic === 'object')
      .map(mapProvider),
    faqs,
    worthIt,
    relatedQAs,
  }
})

// ─── Treatment + state (1.3) ─────────────────────────────────────────────────

export type TreatmentStateData = {
  treatment: TreatmentInfo
  state: LocationInfo
  cities: LocationInfo[]
  topProviders: DirectoryProvider[]
  faqs: FaqRow[]
}

export const getTreatmentState = cache(async function getTreatmentState(
  treatmentSlug: string,
  stateSlug: string,
): Promise<TreatmentStateData | null> {
  const payload = await getPayloadInstance()

  const [treatRes, stateRes] = await Promise.all([
    payload.find({ collection: 'treatments', where: { slug: { equals: treatmentSlug } }, limit: 1, depth: 0 }),
    payload.find({ collection: 'locations', where: { and: [{ slug: { equals: stateSlug } }, { kind: { equals: 'state' } }] }, limit: 1, depth: 0 }),
  ])

  const treatment = treatRes.docs[0]
  const stateLoc = stateRes.docs[0]
  if (!treatment || !stateLoc) return null

  const stateCode: string = stateLoc.state ?? ''

  const [citiesRes, providersRes, faqs] = await Promise.all([
    payload.find({
      collection: 'locations',
      where: { and: [{ kind: { in: ['metro', 'city'] } }, { state: { equals: stateCode } }] },
      limit: 20, sort: 'sortRank', depth: 0,
    }),
    payload.find({
      collection: 'providers',
      where: { licenseState: { equals: stateCode } },
      limit: 20, depth: 2,
    }),
    getFaqsByScope(payload, 'treatment', treatment.name),
  ])

  return {
    treatment: mapTreatment(treatment),
    state: mapLocation(stateLoc, stateCode),
    cities: citiesRes.docs.map((c: any) => mapLocation(c)),
    topProviders: (providersRes.docs as any[])
      .filter((p: any) => p.clinic && typeof p.clinic === 'object')
      .map(mapProvider)
      .sort(byMeritDesc)
      .slice(0, 6),
    faqs,
  }
})

// ─── Neighborhood (1.4) ──────────────────────────────────────────────────────

export type NeighborhoodData = {
  treatment: TreatmentInfo
  city: LocationInfo
  neighborhood: LocationInfo
  providers: DirectoryProvider[]
  faqs: FaqRow[]
}

export async function getNeighborhoodDirectory(
  treatmentSlug: string,
  citySlug: string,
  neighborhoodSlug: string,
): Promise<NeighborhoodData | null> {
  const cityData = await getCityDirectory(treatmentSlug, citySlug)
  if (!cityData) return null

  const payload = await getPayloadInstance()
  const hoodRes = await payload.find({
    collection: 'locations',
    where: { slug: { equals: neighborhoodSlug } },
    limit: 1, depth: 0,
  })
  const hood = hoodRes.docs[0]
  if (!hood) return null

  const hoodProviders = cityData.providers.filter(
    (p) => p.clinic.neighborhood?.toLowerCase() === hood.name.toLowerCase(),
  )
  const providers = hoodProviders.length > 0 ? hoodProviders : cityData.providers

  return {
    treatment: cityData.treatment,
    city: cityData.city,
    neighborhood: mapLocation(hood, hood.state ?? ''),
    providers,
    faqs: cityData.faqs,
  }
}

// ─── State hub (1.6) ─────────────────────────────────────────────────────────

export type StateHubData = {
  state: LocationInfo
  cities: LocationInfo[]
  treatments: TreatmentInfo[]
  faqs: FaqRow[]
}

export const getStateHub = cache(async function getStateHub(stateSlug: string): Promise<StateHubData | null> {
  const payload = await getPayloadInstance()

  const stateRes = await payload.find({
    collection: 'locations',
    where: { and: [{ slug: { equals: stateSlug } }, { kind: { equals: 'state' } }] },
    limit: 1, depth: 0,
  })
  const stateLoc = stateRes.docs[0]
  if (!stateLoc) return null

  const stateCode: string = stateLoc.state ?? ''

  const [citiesRes, treatmentsRes, faqs] = await Promise.all([
    payload.find({
      collection: 'locations',
      where: { and: [{ kind: { in: ['metro', 'city'] } }, { state: { equals: stateCode } }] },
      limit: 20, sort: 'sortRank', depth: 0,
    }),
    payload.find({ collection: 'treatments', limit: 12, depth: 0, sort: 'name' }),
    getFaqsByScope(payload, 'city', undefined, stateLoc.name),
  ])

  return {
    state: mapLocation(stateLoc, stateCode),
    cities: citiesRes.docs.map((c: any) => mapLocation(c)),
    treatments: treatmentsRes.docs.map((t: any) => mapTreatment(t)),
    faqs,
  }
})

// ─── City hub (1.7) ──────────────────────────────────────────────────────────

export type CityHubData = {
  city: LocationInfo
  stateLocation: LocationInfo | null
  treatments: TreatmentInfo[]
  neighborhoods: NeighborhoodInfo[]
  faqs: FaqRow[]
}

export const getCityHub = cache(async function getCityHub(citySlug: string): Promise<CityHubData | null> {
  const payload = await getPayloadInstance()

  const cityRes = await payload.find({
    collection: 'locations',
    where: { slug: { equals: citySlug } },
    limit: 1, depth: 1,
  })
  const cityLoc = cityRes.docs[0]
  if (!cityLoc || (cityLoc.kind !== 'metro' && cityLoc.kind !== 'city')) return null

  const stateCode: string = cityLoc.state ?? ''
  const cityName: string = clinicCityName(cityLoc.name)

  const [treatmentsRes, hoodsRes, stateRes, faqs] = await Promise.all([
    payload.find({ collection: 'treatments', limit: 12, depth: 0, sort: 'name' }),
    payload.find({
      collection: 'locations',
      where: { and: [{ kind: { equals: 'neighborhood' } }, { parent: { equals: cityLoc.id } }] },
      limit: 20, sort: 'sortRank', depth: 0,
    }),
    payload.find({
      collection: 'locations',
      where: { and: [{ kind: { equals: 'state' } }, { state: { equals: stateCode } }] },
      limit: 1, depth: 0,
    }),
    getFaqsByScope(payload, 'city', undefined, cityName),
  ])

  const stateLoc = stateRes.docs[0] ?? null

  return {
    city: mapLocation(cityLoc, stateCode),
    stateLocation: stateLoc ? mapLocation(stateLoc, stateCode) : null,
    treatments: treatmentsRes.docs.map((t: any) => mapTreatment(t)),
    neighborhoods: hoodsRes.docs.map((h: any) => ({
      id: String(h.id), name: h.name, slug: h.slug, providerCount: h.providerCount ?? 0,
    })),
    faqs,
  }
})

// ─── generateStaticParams helpers ────────────────────────────────────────────

export async function getAllTreatmentSlugs(): Promise<string[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({ collection: 'treatments', limit: 500, depth: 0 })
  return res.docs.map((t: any) => t.slug)
}

// Sitemap helpers — INDEXABLE markets only (Phase 3): live AND not noindex.
// Coming-soon and noindexed markets must never appear in sitemap.xml.
export async function getAllStateSlugs(): Promise<string[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'locations',
    where: { and: [{ kind: { equals: 'state' } }, { isLive: { equals: true } }, { noindex: { not_equals: true } }] },
    limit: 500, depth: 0,
  })
  return res.docs.map((l: any) => l.slug)
}

export async function getAllCitySlugs(): Promise<string[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'locations',
    where: { and: [{ kind: { in: ['metro', 'city'] } }, { isLive: { equals: true } }, { noindex: { not_equals: true } }] },
    limit: 500, depth: 0,
  })
  return res.docs.map((l: any) => l.slug)
}

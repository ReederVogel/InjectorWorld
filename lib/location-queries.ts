import { cache } from 'react'
import { getPayloadInstance } from './payload-server'
import { byMeritDesc } from './merit'
import { getWorthItScore, type WorthItResult } from './worth-it'
import { getAnsweredQAs, type QAItem } from './qa-queries'
import { getLocationSlugMap, lookupSlugs, type LocationSlugEntry } from './location-slug-lookup'

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
  licenseStatus?: string
  acceptsNewPatients: boolean
  offersVirtualConsult: boolean
  languages: string[]
  loyaltyPrograms: string[]
  bio?: string
  updatedAt?: string
  additionalLocationCount: number
  clinic: {
    id: string
    name: string
    slug: string
    citySlug: string
    stateSlug: string
    city: string
    state: string
    neighborhood?: string
    latitude: number
    longitude: number
  }
}

export type DirectoryClinic = {
  id: string
  slug: string
  citySlug: string
  stateSlug: string
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
  providerCount: number
  clinicType?: string
  treatmentsOffered?: string[]
  startingPrice?: number
}

export type LocationInfo = {
  id: string
  name: string
  slug: string
  kind: string
  stateCode: string
  /** Slug of the parent state, when known (used for cross-linking to money pages) */
  stateSlug?: string
  latitude?: number
  longitude?: number
  providerCount: number
  isLive: boolean
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

function mapProvider(p: any, slugMap: Map<string, LocationSlugEntry>): DirectoryProvider {
  const slugs =
    p.clinic && typeof p.clinic === 'object'
      ? lookupSlugs(p.clinic.city ?? '', p.clinic.state ?? '', slugMap)
      : { citySlug: '', stateSlug: '' }

  const clinic =
    p.clinic && typeof p.clinic === 'object'
      ? {
          id: String(p.clinic.id),
          name: p.clinic.clinicName,
          slug: p.clinic.slug,
          citySlug: slugs.citySlug,
          stateSlug: slugs.stateSlug,
          city: p.clinic.city,
          state: p.clinic.state,
          neighborhood: p.clinic.neighborhood ?? undefined,
          latitude: Number(p.clinic.latitude) || 0,
          longitude: Number(p.clinic.longitude) || 0,
        }
      : { id: '', name: '', slug: '', citySlug: '', stateSlug: '', city: '', state: '', latitude: 0, longitude: 0 }

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
    licenseStatus: p.licenseStatus ?? undefined,
    acceptsNewPatients: !!p.acceptsNewPatients,
    offersVirtualConsult: !!p.offersVirtualConsult,
    languages: Array.isArray(p.languages) ? p.languages : [],
    loyaltyPrograms: Array.isArray(p.loyaltyPrograms) ? p.loyaltyPrograms : [],
    bio: p.bio ?? undefined,
    updatedAt: p.updatedAt ?? undefined,
    additionalLocationCount: Array.isArray(p.additionalClinics) ? p.additionalClinics.length : 0,
    clinic,
  }
}

function mapClinic(c: any, slugMap: Map<string, LocationSlugEntry>, providerCount?: number): DirectoryClinic {
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
    providerCount: providerCount ?? 0,
    clinicType: c.clinicType ?? undefined,
    treatmentsOffered: Array.isArray(c.treatmentsOffered)
      ? c.treatmentsOffered.map((t: any) => (typeof t === 'object' ? t.name : '')).filter(Boolean)
      : undefined,
    startingPrice: c.startingPrice ?? undefined,
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

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bNyc\b/g, 'NYC')
    .replace(/\bDc\b/g, 'DC')
    .replace(/\bNj\b/g, 'NJ')
}

function mapLocation(c: any, stateCodeOverride?: string): LocationInfo {
  return {
    id: String(c.id),
    name: toTitleCase(c.name ?? ''),
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

function clinicCityName(locationName: string): string {
  return locationName.replace(/\s+city$/i, '').trim()
}

// ─── City directory — /[treatment]/[state]/[city] ────────────────────────────

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
  clinics: DirectoryClinic[]
  neighborhoods: NeighborhoodInfo[]
  faqs: FaqRow[]
  cityPricing: CityPricing
}

export const getCityDirectory = cache(async function getCityDirectory(
  treatmentSlug: string,
  stateSlug: string,
  citySlug: string,
): Promise<CityDirectoryData | null> {
  const payload = await getPayloadInstance()

  const [treatmentRes, cityRes, stateRes] = await Promise.all([
    payload.find({ collection: 'treatments', where: { slug: { equals: treatmentSlug } }, limit: 1, depth: 0 }),
    payload.find({ collection: 'locations', where: { and: [{ slug: { equals: citySlug } }, { kind: { in: ['city', 'metro'] } }] }, limit: 1, depth: 1 }),
    payload.find({ collection: 'locations', where: { and: [{ slug: { equals: stateSlug } }, { kind: { equals: 'state' } }] }, limit: 1, depth: 0 }),
  ])

  const treatment = treatmentRes.docs[0]
  const cityLoc = cityRes.docs[0]
  if (!treatment || !cityLoc) return null

  const stateCode: string = cityLoc.state ?? ''
  const cityName: string = clinicCityName(cityLoc.name)
  const stateLoc = stateRes.docs[0] ?? null

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
      limit: 200,
      depth: 1,
    }),
  ])

  const clinicIds = clinicsRes.docs.map((c: any) => c.id)

  const providersRes =
    clinicIds.length > 0
      ? await payload.find({
          collection: 'providers',
          where: {
            and: [
              { clinic: { in: clinicIds } },
              { treatmentsOffered: { in: [treatment.id] } },
              { status: { equals: 'published' } },
            ],
          },
          limit: 100,
          depth: 2,
        })
      : { docs: [] }

  const allProviders: DirectoryProvider[] = (providersRes.docs as any[])
    .filter((p: any) => p.clinic && typeof p.clinic === 'object')
    .map((p: any) => mapProvider(p, slugMap))

  const providerCountByClinic = new Map<string, number>()
  for (const p of allProviders) {
    if (!p.clinic.id) continue
    providerCountByClinic.set(p.clinic.id, (providerCountByClinic.get(p.clinic.id) ?? 0) + 1)
  }

  const clinics: DirectoryClinic[] = (clinicsRes.docs as any[])
    .map((c: any) => mapClinic(c, slugMap, providerCountByClinic.get(String(c.id)) ?? 0))
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

  const faqs = await getFaqsByScope(payload, 'city', treatment.name, cityName)

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

// ─── Treatment pillar ─────────────────────────────────────────────────────────

export type StateEntry = { code: string; name: string; slug: string }
export type CityEntry = { name: string; slug: string; providerCount: number; stateCode: string; stateSlug: string }

export type TreatmentPillarData = {
  treatment: TreatmentInfo & {
    shortDescription?: string
    bodyAreas: string[]
  }
  guide: { title: string; slug: string; lede: string } | null
  topCities: LocationInfo[]
  treatmentProviders: DirectoryProvider[]
  treatmentClinics: DirectoryClinic[]
  faqs: FaqRow[]
  worthIt: WorthItResult
  relatedQAs: QAItem[]
  states: StateEntry[]
  allCities: CityEntry[]
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

  const [slugMap, topCitiesRes, treatmentProvidersRes, treatmentClinicsRes, faqs, worthIt, relatedQAs, statesRes, allCitiesRes] = await Promise.all([
    getLocationSlugMap(),
    payload.find({ collection: 'locations', where: { kind: { equals: 'metro' } }, limit: 12, sort: 'sortRank', depth: 0 }),
    payload.find({
      collection: 'providers',
      where: { and: [{ treatmentsOffered: { in: [t.id] } }, { status: { equals: 'published' } }] },
      limit: 200,
      depth: 2,
      sort: '-aggregateRating',
    }),
    payload.find({
      collection: 'clinics',
      where: { and: [{ treatmentsOffered: { in: [t.id] } }, { status: { equals: 'published' } }] },
      limit: 200,
      depth: 0,
      sort: '-aggregateRating',
    }),
    getFaqsByScope(payload, 'treatment', t.name),
    getWorthItScore(t.name),
    getAnsweredQAs({ treatmentTag: t.name, limit: 3 }),
    payload.find({ collection: 'locations', where: { kind: { equals: 'state' } }, limit: 60, sort: 'name', depth: 0 }),
    payload.find({ collection: 'locations', where: { kind: { in: ['metro', 'city'] } }, limit: 500, sort: 'name', depth: 0 }),
  ])

  const treatmentProviders: DirectoryProvider[] = (treatmentProvidersRes.docs as any[])
    .filter((p: any) => p.clinic && typeof p.clinic === 'object')
    .map((p: any) => mapProvider(p, slugMap))

  const pillarCountMap = new Map<string, number>()
  for (const p of treatmentProviders) {
    if (!p.clinic.id) continue
    pillarCountMap.set(p.clinic.id, (pillarCountMap.get(p.clinic.id) ?? 0) + 1)
  }

  const treatmentClinics: DirectoryClinic[] = (treatmentClinicsRes.docs as any[])
    .map((c: any) => mapClinic(c, slugMap, pillarCountMap.get(String(c.id)) ?? 0))

  const guide =
    t.guide && typeof t.guide === 'object'
      ? { title: t.guide.title, slug: t.guide.slug, lede: t.guide.lede }
      : null

  const stateSlugByCode = new Map<string, string>(
    (statesRes.docs as any[]).map((s: any) => [s.state ?? '', s.slug as string]),
  )

  const allCities: CityEntry[] = (allCitiesRes.docs as any[])
    .map((c: any) => {
      const stateCode: string = c.state ?? ''
      return {
        name: c.name,
        slug: c.slug,
        providerCount: c.providerCount ?? 0,
        stateCode,
        stateSlug: stateSlugByCode.get(stateCode) ?? '',
      }
    })
    .filter((c: any) => c.stateCode)

  const stateCodes = new Set(allCities.map((c: any) => c.stateCode))
  const states: StateEntry[] = (statesRes.docs as any[])
    .map((s: any) => ({ code: s.state ?? '', name: s.name, slug: s.slug }))
    .filter((s: any) => s.code && stateCodes.has(s.code))

  return {
    treatment: {
      ...mapTreatment(t),
      shortDescription: t.shortDescription ?? undefined,
      bodyAreas: Array.isArray(t.bodyAreas) ? t.bodyAreas : [],
    },
    guide,
    topCities: topCitiesRes.docs.map((c: any) => ({
      ...mapLocation(c),
      stateSlug: stateSlugByCode.get(c.state ?? '') ?? '',
    })),
    treatmentProviders,
    treatmentClinics,
    faqs,
    worthIt,
    relatedQAs,
    states,
    allCities,
  }
})

// ─── Treatment + state ────────────────────────────────────────────────────────

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

  const [slugMap, citiesRes, providersRes, faqs] = await Promise.all([
    getLocationSlugMap(),
    payload.find({
      collection: 'locations',
      where: { and: [{ kind: { in: ['metro', 'city'] } }, { state: { equals: stateCode } }] },
      limit: 20, sort: 'sortRank', depth: 0,
    }),
    payload.find({
      collection: 'providers',
      where: { and: [{ licenseState: { equals: stateCode } }, { status: { equals: 'published' } }] },
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
      .map((p: any) => mapProvider(p, slugMap))
      .sort(byMeritDesc)
      .slice(0, 6),
    faqs,
  }
})

// ─── State hub — /[state] ─────────────────────────────────────────────────────

export type StateHubData = {
  state: LocationInfo
  cities: LocationInfo[]
  treatments: TreatmentInfo[]
  providers: DirectoryProvider[]
  clinics: DirectoryClinic[]
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

  const [slugMap, citiesRes, treatmentsRes, providersRes, clinicsRes, faqs] = await Promise.all([
    getLocationSlugMap(),
    payload.find({
      collection: 'locations',
      where: { and: [{ kind: { in: ['metro', 'city'] } }, { state: { equals: stateCode } }] },
      limit: 20, sort: 'sortRank', depth: 0,
    }),
    payload.find({ collection: 'treatments', limit: 12, depth: 0, sort: 'name' }),
    payload.find({
      collection: 'providers',
      where: { and: [{ licenseState: { equals: stateCode } }, { status: { equals: 'published' } }] },
      limit: 500, depth: 2,
    }),
    payload.find({
      collection: 'clinics',
      where: { and: [{ state: { equals: stateCode } }, { status: { equals: 'published' } }] },
      limit: 500, depth: 0,
    }),
    getFaqsByScope(payload, 'city', undefined, stateLoc.name),
  ])

  const providers: DirectoryProvider[] = (providersRes.docs as any[])
    .filter((p: any) => p.clinic && typeof p.clinic === 'object')
    .map((p: any) => mapProvider(p, slugMap))

  const providerCountByClinic = new Map<string, number>()
  for (const p of providers) {
    if (!p.clinic.id) continue
    providerCountByClinic.set(p.clinic.id, (providerCountByClinic.get(p.clinic.id) ?? 0) + 1)
  }

  const clinics: DirectoryClinic[] = (clinicsRes.docs as any[])
    .map((c: any) => mapClinic(c, slugMap, providerCountByClinic.get(String(c.id)) ?? 0))
    .sort((a, b) => (b.aggregateRatingCount ?? 0) - (a.aggregateRatingCount ?? 0))

  return {
    state: mapLocation(stateLoc, stateCode),
    cities: citiesRes.docs.map((c: any) => mapLocation(c)),
    treatments: treatmentsRes.docs.map((t: any) => mapTreatment(t)),
    providers,
    clinics,
    faqs,
  }
})

// ─── City hub — /[state]/[city] ───────────────────────────────────────────────

export type CityHubData = {
  city: LocationInfo
  stateLocation: LocationInfo | null
  treatments: TreatmentInfo[]
  providers: DirectoryProvider[]
  clinics: DirectoryClinic[]
  neighborhoods: NeighborhoodInfo[]
  faqs: FaqRow[]
}

export const getCityHub = cache(async function getCityHub(
  stateSlug: string,
  citySlug: string,
): Promise<CityHubData | null> {
  const payload = await getPayloadInstance()

  const [stateRes, cityRes] = await Promise.all([
    payload.find({
      collection: 'locations',
      where: { and: [{ slug: { equals: stateSlug } }, { kind: { equals: 'state' } }] },
      limit: 1, depth: 0,
    }),
    payload.find({
      collection: 'locations',
      where: { and: [{ slug: { equals: citySlug } }, { kind: { in: ['city', 'metro'] } }] },
      limit: 1, depth: 1,
    }),
  ])

  const stateLoc = stateRes.docs[0] ?? null
  const cityLoc = cityRes.docs[0]
  if (!cityLoc) return null

  const stateCode: string = cityLoc.state ?? ''
  const cityName: string = clinicCityName(cityLoc.name)

  const [slugMap, treatmentsRes, hoodsRes, clinicsRes, faqs] = await Promise.all([
    getLocationSlugMap(),
    payload.find({ collection: 'treatments', limit: 12, depth: 0, sort: 'name' }),
    payload.find({
      collection: 'locations',
      where: { and: [{ kind: { equals: 'neighborhood' } }, { parent: { equals: cityLoc.id } }] },
      limit: 20, sort: 'sortRank', depth: 0,
    }),
    payload.find({
      collection: 'clinics',
      where: { and: [{ city: { like: cityName } }, { state: { equals: stateCode } }, { status: { equals: 'published' } }] },
      limit: 200, depth: 0,
    }),
    getFaqsByScope(payload, 'city', undefined, cityName),
  ])

  const clinicIds = clinicsRes.docs.map((c: any) => c.id)

  const providersRes =
    clinicIds.length > 0
      ? await payload.find({
          collection: 'providers',
          where: { and: [{ clinic: { in: clinicIds } }, { status: { equals: 'published' } }] },
          limit: 200,
          depth: 2,
        })
      : { docs: [] }

  const providers: DirectoryProvider[] = (providersRes.docs as any[])
    .filter((p: any) => p.clinic && typeof p.clinic === 'object')
    .map((p: any) => mapProvider(p, slugMap))

  const providerCountByClinic = new Map<string, number>()
  for (const p of providers) {
    if (!p.clinic.id) continue
    providerCountByClinic.set(p.clinic.id, (providerCountByClinic.get(p.clinic.id) ?? 0) + 1)
  }

  const clinics: DirectoryClinic[] = (clinicsRes.docs as any[])
    .map((c: any) => mapClinic(c, slugMap, providerCountByClinic.get(String(c.id)) ?? 0))
    .sort((a, b) => (b.aggregateRatingCount ?? 0) - (a.aggregateRatingCount ?? 0))

  return {
    city: mapLocation(cityLoc, stateCode),
    stateLocation: stateLoc ? mapLocation(stateLoc, stateCode) : null,
    treatments: treatmentsRes.docs.map((t: any) => mapTreatment(t)),
    providers,
    clinics,
    neighborhoods: hoodsRes.docs.map((h: any) => ({
      id: String(h.id), name: h.name, slug: h.slug, providerCount: h.providerCount ?? 0,
    })),
    faqs,
  }
})

// ─── Legacy neighborhood query (kept for backward compat in code that may reference it) ──
// ─── generateStaticParams helpers ────────────────────────────────────────────

export async function getAllTreatmentSlugs(): Promise<string[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({ collection: 'treatments', limit: 500, depth: 0 })
  return res.docs.map((t: any) => t.slug)
}

// ─── Services index — /services ──────────────────────────────────────────────

export type ServiceIndexEntry = {
  id: string
  name: string
  slug: string
  tagline?: string
  category: string
}

export const getServicesIndex = cache(async function getServicesIndex(): Promise<ServiceIndexEntry[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({ collection: 'treatments', limit: 500, depth: 0, sort: 'name' })
  return (res.docs as any[]).map((t) => ({
    id: String(t.id),
    name: t.name,
    slug: t.slug,
    tagline: t.tagline ?? undefined,
    category: t.category ?? '',
  }))
})


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

// Returns { stateSlug, citySlug } pairs for all live indexable cities
export async function getAllStateCityPairs(): Promise<Array<{ stateSlug: string; citySlug: string }>> {
  const payload = await getPayloadInstance()
  const [slugMap, citiesRes] = await Promise.all([
    getLocationSlugMap(),
    payload.find({
      collection: 'locations',
      where: { and: [{ kind: { in: ['metro', 'city'] } }, { isLive: { equals: true } }, { noindex: { not_equals: true } }] },
      limit: 500, depth: 0,
    }),
  ])
  return (citiesRes.docs as any[])
    .map((c: any) => {
      const entry = slugMap.get(
        `${(c.name as string).replace(/\s+city$/i, '').trim().toLowerCase()},${(c.state ?? '').toLowerCase()}`,
      )
      return entry ? { citySlug: c.slug, stateSlug: entry.stateSlug } : null
    })
    .filter(Boolean) as Array<{ stateSlug: string; citySlug: string }>
}

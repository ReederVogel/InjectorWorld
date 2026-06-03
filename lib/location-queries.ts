import { getPayloadInstance } from './payload-server'

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
  acceptsNewPatients: boolean
  offersVirtualConsult: boolean
  languages: string[]
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

export type LocationInfo = {
  id: string
  name: string
  slug: string
  kind: string
  stateCode: string
  latitude?: number
  longitude?: number
  providerCount: number
}

export type FaqRow = { id: string; question: string; answer: string }
export type TreatmentInfo = { id: string; name: string; slug: string; tagline?: string; iconSlug?: string; category: string }
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
          neighborhood: p.clinic.neighborhood,
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
    acceptsNewPatients: !!p.acceptsNewPatients,
    offersVirtualConsult: !!p.offersVirtualConsult,
    languages: Array.isArray(p.languages) ? p.languages : [],
    clinic,
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

export type CityDirectoryData = {
  treatment: TreatmentInfo
  city: LocationInfo
  stateLocation: LocationInfo | null
  providers: DirectoryProvider[]
  neighborhoods: NeighborhoodInfo[]
  faqs: FaqRow[]
}

export async function getCityDirectory(
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

  // Step 1: clinics in this city
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

  // Step 2: providers in those clinics offering this treatment
  const providersRes =
    clinicIds.length > 0
      ? await payload.find({
          collection: 'providers',
          where: { clinic: { in: clinicIds } },
          limit: 100,
          depth: 2,
          sort: '-aggregateRatingCount',
        })
      : { docs: [] }

  // Filter in JS to providers that offer this treatment
  const allProviders: DirectoryProvider[] = (providersRes.docs as any[])
    .filter((p: any) => p.clinic && typeof p.clinic === 'object')
    .map(mapProvider)
    .filter((p) => p.treatments.some((t) => t.toLowerCase() === treatment.name.toLowerCase()))

  // Neighborhoods in this city (parent = city location)
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

  // State location (for breadcrumb + internal links)
  const stateRes = await payload.find({
    collection: 'locations',
    where: { and: [{ kind: { equals: 'state' } }, { state: { equals: stateCode } }] },
    limit: 1,
    depth: 0,
  })
  const stateLoc = stateRes.docs[0] ?? null

  const faqs = await getFaqsByScope(payload, 'city', treatment.name, cityName)

  return {
    treatment: {
      id: String(treatment.id),
      name: treatment.name,
      slug: treatment.slug,
      tagline: treatment.tagline ?? undefined,
      iconSlug: treatment.iconSlug ?? undefined,
      category: treatment.category ?? undefined,
    },
    city: {
      id: String(cityLoc.id),
      name: cityLoc.name,
      slug: cityLoc.slug,
      kind: cityLoc.kind,
      stateCode,
      latitude: cityLoc.latitude,
      longitude: cityLoc.longitude,
      providerCount: allProviders.length || cityLoc.providerCount || 0,
    },
    stateLocation: stateLoc
      ? {
          id: String(stateLoc.id),
          name: stateLoc.name,
          slug: stateLoc.slug,
          kind: 'state',
          stateCode: stateLoc.state ?? '',
          providerCount: stateLoc.providerCount ?? 0,
        }
      : null,
    providers: allProviders,
    neighborhoods,
    faqs,
  }
}

// ─── Treatment pillar (1.2) ──────────────────────────────────────────────────

export type TreatmentPillarData = {
  treatment: TreatmentInfo & {
    shortDescription?: string
    avgPriceFromUsd?: number
    avgPriceToUsd?: number
    priceUnit?: string
    bodyAreas: string[]
  }
  guide: { title: string; slug: string; lede: string } | null
  topCities: LocationInfo[]
  topProviders: DirectoryProvider[]
  faqs: FaqRow[]
}

export async function getTreatmentPillar(treatmentSlug: string): Promise<TreatmentPillarData | null> {
  const payload = await getPayloadInstance()
  const treatRes = await payload.find({
    collection: 'treatments',
    where: { slug: { equals: treatmentSlug } },
    limit: 1,
    depth: 2,
  })
  const t = treatRes.docs[0]
  if (!t) return null

  const [topCitiesRes, topProvidersRes, faqs] = await Promise.all([
    payload.find({ collection: 'locations', where: { kind: { equals: 'metro' } }, limit: 12, sort: 'sortRank', depth: 0 }),
    payload.find({ collection: 'providers', where: { editorsPick: { equals: true } }, limit: 6, depth: 2, sort: 'featuredRank' }),
    getFaqsByScope(payload, 'treatment', t.name),
  ])

  const guide =
    t.guide && typeof t.guide === 'object'
      ? { title: t.guide.title, slug: t.guide.slug, lede: t.guide.lede }
      : null

  return {
    treatment: {
      id: String(t.id),
      name: t.name,
      slug: t.slug,
      tagline: t.tagline,
      iconSlug: t.iconSlug,
      category: t.category,
      shortDescription: t.shortDescription,
      avgPriceFromUsd: t.avgPriceFromUsd,
      avgPriceToUsd: t.avgPriceToUsd,
      priceUnit: t.priceUnit,
      bodyAreas: Array.isArray(t.bodyAreas) ? t.bodyAreas : [],
    },
    guide,
    topCities: topCitiesRes.docs.map((c: any) => ({
      id: String(c.id), name: c.name, slug: c.slug, kind: c.kind,
      stateCode: c.state ?? '', latitude: c.latitude, longitude: c.longitude,
      providerCount: c.providerCount ?? 0,
    })),
    topProviders: (topProvidersRes.docs as any[])
      .filter((p: any) => p.clinic && typeof p.clinic === 'object')
      .map(mapProvider),
    faqs,
  }
}

// ─── Treatment + state (1.3) ─────────────────────────────────────────────────

export type TreatmentStateData = {
  treatment: TreatmentInfo
  state: LocationInfo
  cities: LocationInfo[]
  topProviders: DirectoryProvider[]
  faqs: FaqRow[]
}

export async function getTreatmentState(
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
      limit: 6, sort: '-aggregateRatingCount', depth: 2,
    }),
    getFaqsByScope(payload, 'treatment', treatment.name),
  ])

  return {
    treatment: { id: String(treatment.id), name: treatment.name, slug: treatment.slug, tagline: treatment.tagline ?? undefined, iconSlug: treatment.iconSlug ?? undefined, category: treatment.category ?? undefined },
    state: { id: String(stateLoc.id), name: stateLoc.name, slug: stateLoc.slug, kind: 'state', stateCode, providerCount: stateLoc.providerCount ?? 0 },
    cities: citiesRes.docs.map((c: any) => ({
      id: String(c.id), name: c.name, slug: c.slug, kind: c.kind,
      stateCode: c.state ?? '', latitude: c.latitude, longitude: c.longitude,
      providerCount: c.providerCount ?? 0,
    })),
    topProviders: (providersRes.docs as any[])
      .filter((p: any) => p.clinic && typeof p.clinic === 'object')
      .map(mapProvider),
    faqs,
  }
}

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
  // Reuse city directory and filter to neighborhood
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

  // Filter providers to those in this neighborhood
  const hoodProviders = cityData.providers.filter(
    (p) => p.clinic.neighborhood?.toLowerCase() === hood.name.toLowerCase(),
  )
  // Fallback: if no exact match, show all city providers (neighborhood may not be on clinic)
  const providers = hoodProviders.length > 0 ? hoodProviders : cityData.providers

  return {
    treatment: cityData.treatment,
    city: cityData.city,
    neighborhood: { id: String(hood.id), name: hood.name, slug: hood.slug, kind: 'neighborhood', stateCode: hood.state ?? '', providerCount: hood.providerCount ?? 0 },
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

export async function getStateHub(stateSlug: string): Promise<StateHubData | null> {
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
    state: {
      id: String(stateLoc.id), name: stateLoc.name, slug: stateLoc.slug, kind: 'state',
      stateCode, providerCount: stateLoc.providerCount ?? 0,
    },
    cities: citiesRes.docs.map((c: any) => ({
      id: String(c.id), name: c.name, slug: c.slug, kind: c.kind,
      stateCode: c.state ?? '', latitude: c.latitude, longitude: c.longitude,
      providerCount: c.providerCount ?? 0,
    })),
    treatments: treatmentsRes.docs.map((t: any) => ({
      id: String(t.id), name: t.name, slug: t.slug, tagline: t.tagline, iconSlug: t.iconSlug, category: t.category,
    })),
    faqs,
  }
}

// ─── City hub (1.7) ──────────────────────────────────────────────────────────

export type CityHubData = {
  city: LocationInfo
  stateLocation: LocationInfo | null
  treatments: TreatmentInfo[]
  neighborhoods: NeighborhoodInfo[]
  faqs: FaqRow[]
}

export async function getCityHub(citySlug: string): Promise<CityHubData | null> {
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
    city: {
      id: String(cityLoc.id), name: cityLoc.name, slug: cityLoc.slug, kind: cityLoc.kind,
      stateCode, latitude: cityLoc.latitude, longitude: cityLoc.longitude,
      providerCount: cityLoc.providerCount ?? 0,
    },
    stateLocation: stateLoc
      ? { id: String(stateLoc.id), name: stateLoc.name, slug: stateLoc.slug, kind: 'state', stateCode: stateLoc.state ?? '', providerCount: stateLoc.providerCount ?? 0 }
      : null,
    treatments: treatmentsRes.docs.map((t: any) => ({
      id: String(t.id), name: t.name, slug: t.slug, tagline: t.tagline, iconSlug: t.iconSlug, category: t.category,
    })),
    neighborhoods: hoodsRes.docs.map((h: any) => ({
      id: String(h.id), name: h.name, slug: h.slug, providerCount: h.providerCount ?? 0,
    })),
    faqs,
  }
}

// ─── generateStaticParams helpers ────────────────────────────────────────────

export async function getAllTreatmentSlugs(): Promise<string[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({ collection: 'treatments', limit: 500, depth: 0 })
  return res.docs.map((t: any) => t.slug)
}

export async function getAllStateSlugs(): Promise<string[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({ collection: 'locations', where: { kind: { equals: 'state' } }, limit: 500, depth: 0 })
  return res.docs.map((l: any) => l.slug)
}

export async function getAllCitySlugs(): Promise<string[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({ collection: 'locations', where: { kind: { in: ['metro', 'city'] } }, limit: 500, depth: 0 })
  return res.docs.map((l: any) => l.slug)
}

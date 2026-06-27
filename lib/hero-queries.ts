import { getPayloadInstance } from './payload-server'
import { getLocationSlugMap, lookupSlugs } from './location-slug-lookup'

export type HeroClinic = {
  id: string
  clinicName: string
  slug: string
  citySlug: string
  stateSlug: string
  city: string
  state: string
  neighborhood?: string
  aggregateRating?: number
  aggregateRatingCount?: number
  latitude?: number
  longitude?: number
  clinicPhotoUrls?: string[]
}

export type HeroTreatment = {
  id: string
  name: string
  slug: string
  category: string
}

export type HeroLocation = {
  id: string
  name: string
  slug: string
  kind: string
  state?: string
  latitude?: number
  longitude?: number
}

export type HeroProviderCard = {
  id: string
  providerId: string
  fullName: string
  slug: string
  credentials: string
  title: string
  profilePhotoUrl?: string
  aggregateRating?: number
  aggregateRatingCount?: number
  startingPrice?: number
  treatments: string[]
  editorsPick?: boolean
  licenseStateCode: string
  licenseNumber: string
  licenseVerificationUrl?: string
  licenseStatus?: string
  clinic: {
    id: string
    name: string
    slug: string
    citySlug: string
    stateSlug: string
    neighborhood?: string
    city: string
    state: string
    latitude: number
    longitude: number
    aggregateRating?: number
    aggregateRatingCount?: number
  }
}

export async function getHeroData() {
  const payload = await getPayloadInstance()
  const slugMap = await getLocationSlugMap()

  const [treatmentsRes, locationsRes, providersRes, clinicsRes] = await Promise.all([
    payload.find({
      collection: 'services',
      limit: 100,
      depth: 0,
      sort: 'name',
    }),
    payload.find({
      collection: 'locations',
      limit: 200,
      depth: 0,
      where: { kind: { in: ['metro', 'neighborhood', 'state'] } },
      sort: '-featured',
    }),
    payload.find({
      collection: 'providers',
      where: { status: { equals: 'published' } },
      limit: 60,
      depth: 2,
      sort: 'featuredRank',
    }),
    // Direct clinic query so the hero clinics tab is not derived from provider results.
    // Previously, clinic cards in Hero search were built from the provider.clinic objects,
    // meaning a clinic with no providers in the top 60 would never surface.
    payload.find({
      collection: 'clinics',
      where: { status: { equals: 'published' } },
      limit: 30,
      depth: 0,
      sort: '-aggregateRating',
    }),
  ])

  const treatments: HeroTreatment[] = treatmentsRes.docs.map((t: any) => ({
    id: String(t.id),
    name: t.name,
    slug: t.slug,
    category: t.category,
  }))

  const locations: HeroLocation[] = locationsRes.docs.map((l: any) => ({
    id: String(l.id),
    name: l.name,
    slug: l.slug,
    kind: l.kind,
    state: l.state,
    latitude: l.latitude,
    longitude: l.longitude,
  }))

  const providers: HeroProviderCard[] = providersRes.docs
    .filter((p: any) => p.clinic && typeof p.clinic === 'object')
    .map((p: any) => ({
      id: String(p.id),
      providerId: p.providerId,
      fullName: p.fullName,
      slug: p.slug,
      credentials: p.credentials,
      title: p.title,
      profilePhotoUrl: p.profilePhotoUrl,
      aggregateRating: p.aggregateRating,
      aggregateRatingCount: p.aggregateRatingCount,
      startingPrice: p.startingPrice,
      treatments: Array.isArray(p.treatmentsOffered)
        ? p.treatmentsOffered.map((t: any) => (typeof t === 'object' ? t.name : ''))
        : [],
      editorsPick: !!p.editorsPick,
      licenseStateCode: p.licenseState,
      licenseNumber: p.licenseNumber,
      licenseVerificationUrl: p.licenseVerificationUrl ?? undefined,
      licenseStatus: p.licenseStatus ?? undefined,
      clinic: {
        id: String(p.clinic.id),
        name: p.clinic.clinicName,
        slug: p.clinic.slug,
        ...lookupSlugs(p.clinic.city ?? '', p.clinic.state ?? '', slugMap),
        neighborhood: p.clinic.neighborhood,
        city: p.clinic.city,
        state: p.clinic.state,
        latitude: Number(p.clinic.latitude),
        longitude: Number(p.clinic.longitude),
        aggregateRating: p.clinic.aggregateRating ?? undefined,
        aggregateRatingCount: p.clinic.aggregateRatingCount ?? undefined,
      },
    }))

  const clinics: HeroClinic[] = clinicsRes.docs.map((c: any) => ({
    id: String(c.id),
    clinicName: c.clinicName,
    slug: c.slug,
    ...lookupSlugs(c.city ?? '', c.state ?? '', slugMap),
    city: c.city,
    state: c.state,
    neighborhood: c.neighborhood ?? undefined,
    aggregateRating: c.aggregateRating ?? undefined,
    aggregateRatingCount: c.aggregateRatingCount ?? undefined,
    latitude: c.latitude ? Number(c.latitude) : undefined,
    longitude: c.longitude ? Number(c.longitude) : undefined,
    clinicPhotoUrls: Array.isArray(c.clinicPhotoUrls) ? c.clinicPhotoUrls : undefined,
  }))

  return { treatments, locations, providers, clinics }
}


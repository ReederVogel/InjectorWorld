import { getPayloadInstance } from './payload-server'

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
  clinic: {
    id: string
    name: string
    neighborhood?: string
    city: string
    state: string
    latitude: number
    longitude: number
  }
}

export async function getHeroData() {
  const payload = await getPayloadInstance()

  const [treatmentsRes, locationsRes, providersRes] = await Promise.all([
    payload.find({
      collection: 'treatments',
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
      limit: 60,
      depth: 2,
      sort: 'featuredRank',
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
      clinic: {
        id: String(p.clinic.id),
        name: p.clinic.clinicName,
        neighborhood: p.clinic.neighborhood,
        city: p.clinic.city,
        state: p.clinic.state,
        latitude: Number(p.clinic.latitude),
        longitude: Number(p.clinic.longitude),
      },
    }))

  return { treatments, locations, providers }
}

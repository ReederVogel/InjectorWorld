import { getPayloadInstance } from './payload-server'
import { getLocationSlugMap, lookupSlugs } from './location-slug-lookup'
import { isMarketNoindex } from './markets'

export type ClinicHours = Partial<Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', string>>

export type ClinicTreatment = {
  id: number
  name: string
  slug: string
}

export type ClinicFaq = {
  id: string
  question: string
  answer: string
}

export type ClinicListItem = {
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
  startingPrice?: number
  languages: string[]
  photoUrl?: string
  serviceType: string
  yearEstablished?: number
  phone?: string
  latitude: number
  longitude: number
  clinicType?: string
}

export type ClinicDetail = ClinicListItem & {
  clinicId: string
  description?: string
  addressLine1: string
  addressLine2?: string
  county?: string
  zip: string
  latitude: number
  longitude: number
  googleMapsUrl?: string
  directionsUrl?: string
  email?: string
  websiteUrl: string
  bookingUrl?: string
  logoUrl?: string
  photoUrls: string[]
  hoursJson?: ClinicHours
  acceptsInsurance: boolean
  paymentMethods?: string
  amenities?: string
  treatmentsOffered: ClinicTreatment[]
  brandsOffered: ClinicTreatment[]
  providers: ClinicProvider[]
  claimed: boolean
  faqs: ClinicFaq[]
  relatedClinics: ClinicRelated[]
  status?: string
  cityMarketNoindex: boolean
  instagramUrl?: string
  tiktokUrl?: string
  facebookUrl?: string
}

export type ClinicProvider = {
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
  yearsExperience?: number
  acceptsNewPatients: boolean
}

export type ClinicRelated = {
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

export type ClinicReviewRow = {
  id: string
  reviewerFirstName?: string
  reviewerInitial?: string
  rating: number
  reviewTitle?: string
  reviewText: string
  treatmentTag?: string
  reviewDate: string
  sourcePlatform: string
  verified: boolean
}

function photoFromMedia(media: any): string | undefined {
  if (!media || typeof media !== 'object') return undefined
  return (
    media.sizes?.hero?.url ||
    media.sizes?.card?.url ||
    media.url ||
    undefined
  )
}

function clinicPhotoUrls(c: any): string[] {
  const uploaded = Array.isArray(c.photos)
    ? c.photos.map(photoFromMedia).filter(Boolean)
    : []
  const legacy = Array.isArray(c.clinicPhotoUrls)
    ? c.clinicPhotoUrls.map((p: any) => p?.url).filter(Boolean)
    : []
  return Array.from(new Set([...uploaded, ...legacy]))
}

function normalizeHours(hours: unknown): ClinicHours | undefined {
  if (!hours) return undefined
  const parsed =
    typeof hours === 'string'
      ? (() => {
          try {
            return JSON.parse(hours)
          } catch {
            return null
          }
        })()
      : hours

  if (!parsed || typeof parsed !== 'object') return undefined

  const aliases: Record<string, keyof ClinicHours> = {
    mon: 'mon',
    monday: 'mon',
    tue: 'tue',
    tues: 'tue',
    tuesday: 'tue',
    wed: 'wed',
    wednesday: 'wed',
    thu: 'thu',
    thur: 'thu',
    thurs: 'thu',
    thursday: 'thu',
    fri: 'fri',
    friday: 'fri',
    sat: 'sat',
    saturday: 'sat',
    sun: 'sun',
    sunday: 'sun',
  }

  const out: ClinicHours = {}
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    const day = aliases[key.toLowerCase()]
    if (!day) continue
    if (typeof value === 'string' && value.trim()) out[day] = value.trim()
    if (value && typeof value === 'object') {
      const objectValue = value as Record<string, unknown>
      const open = typeof objectValue.open === 'string' ? objectValue.open : ''
      const close = typeof objectValue.close === 'string' ? objectValue.close : ''
      const closed = objectValue.closed === true
      if (closed) out[day] = 'Closed'
      else if (open && close) out[day] = `${open}-${close}`
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function mapTreatments(treatments: unknown): ClinicTreatment[] {
  if (!Array.isArray(treatments)) return []
  return treatments
    .filter((t: any) => t && typeof t === 'object' && t.name && t.slug)
    .map((t: any) => ({ id: Number(t.id), name: t.name, slug: t.slug }))
    .filter((t) => Number.isFinite(t.id))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function mapProvider(p: any): ClinicProvider {
  return {
    id: String(p.id),
    slug: p.slug,
    fullName: p.fullName,
    credentials: p.credentials,
    title: p.title,
    profilePhotoUrl: p.profilePhotoUrl ?? photoFromMedia(p.profilePhoto),
    aggregateRating: p.aggregateRating ?? undefined,
    aggregateRatingCount: p.aggregateRatingCount ?? undefined,
    startingPrice: p.startingPrice ?? undefined,
    treatments: Array.isArray(p.treatmentsOffered)
      ? p.treatmentsOffered.map((t: any) => (typeof t === 'object' ? t.name : '')).filter(Boolean)
      : [],
    yearsExperience: p.yearsExperience ?? undefined,
    acceptsNewPatients: !!p.acceptsNewPatients,
  }
}

function mapRelatedClinic(c: any, slugMap: Awaited<ReturnType<typeof getLocationSlugMap>>, providerCount = 0): ClinicRelated {
  const slugs = lookupSlugs(c.city ?? '', c.state ?? '', slugMap)
  const photos = clinicPhotoUrls(c)
  const linkedProviderCount = Array.isArray(c.providers) ? c.providers.length : providerCount
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
    photoUrl: photos[0],
    serviceType: c.serviceType || 'In-Person',
    yearEstablished: c.yearEstablished ?? undefined,
    latitude: Number(c.latitude) || 0,
    longitude: Number(c.longitude) || 0,
    providerCount: linkedProviderCount,
    clinicType: c.clinicType ?? undefined,
    treatmentsOffered: Array.isArray(c.servicesOffered)
      ? c.servicesOffered.map((t: any) => (typeof t === 'object' ? t.name : '')).filter(Boolean)
      : undefined,
    startingPrice: c.startingPrice ?? undefined,
  }
}

async function getClinicTypeFaqs(payload: any, clinicType?: string): Promise<ClinicFaq[]> {
  try {
    const typed = clinicType
      ? await payload.find({
          collection: 'faqs',
          where: {
            and: [
              { scope: { equals: 'clinic' } },
              { cityTag: { like: clinicType } },
            ],
          } as any,
          limit: 6,
          sort: 'sortRank',
          depth: 0,
        })
      : { docs: [] }

    const docs = typed.docs.length > 0
      ? typed.docs
      : (
          await payload.find({
            collection: 'faqs',
            where: { scope: { equals: 'clinic' } },
            limit: 6,
            sort: 'sortRank',
            depth: 0,
          })
        ).docs

    return docs.map((f: any) => ({
      id: String(f.id),
      question: f.question,
      answer: f.answer,
    }))
  } catch {
    return []
  }
}

export type ClinicsStats = {
  total: number
  stateCount: number
  avgRating: string
}

export async function getClinicsStats(): Promise<ClinicsStats> {
  try {
    const payload = await getPayloadInstance()
    const pool = (payload.db as any).pool
    const res = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(DISTINCT state)::int AS state_count,
        ROUND(AVG(aggregate_rating)::numeric, 1) AS avg_rating
      FROM clinics
      WHERE status = 'published'
    `)
    const row = res.rows[0]
    return {
      total: Number(row.total) || 0,
      stateCount: Number(row.state_count) || 0,
      avgRating: row.avg_rating ? String(row.avg_rating) : '0.0',
    }
  } catch {
    return { total: 0, stateCount: 0, avgRating: '0.0' }
  }
}

export async function getClinicsListing(limit = 500): Promise<ClinicListItem[]> {
  const payload = await getPayloadInstance()
  const [slugMap, res] = await Promise.all([
    getLocationSlugMap(),
    payload.find({
      collection: 'clinics',
      where: { status: { equals: 'published' } },
      limit,
      depth: 1,
      sort: '-aggregateRating',
    }),
  ])
  return res.docs.map((c: any) => {
    const s = lookupSlugs(c.city ?? '', c.state ?? '', slugMap)
    const photos = clinicPhotoUrls(c)
    return {
      id: String(c.id),
      slug: c.slug,
      citySlug: s.citySlug,
      stateSlug: s.stateSlug,
      clinicName: c.clinicName,
      tagline: c.tagline,
      city: c.city,
      state: c.state,
      neighborhood: c.neighborhood,
      aggregateRating: c.aggregateRating,
      aggregateRatingCount: c.aggregateRatingCount,
      startingPrice: c.startingPrice ?? undefined,
      languages: Array.isArray(c.languages) ? c.languages : [],
      photoUrl: photos[0],
      serviceType: c.serviceType || 'In-Person',
      yearEstablished: c.yearEstablished,
      phone: c.phone,
      latitude: Number(c.latitude) || 0,
      longitude: Number(c.longitude) || 0,
      clinicType: c.clinicType ?? undefined,
    }
  })
}

export async function getClinicBySlug(slug: string): Promise<ClinicDetail | null> {
  const payload = await getPayloadInstance()
  const [slugMap, res] = await Promise.all([
    getLocationSlugMap(),
    payload.find({
      collection: 'clinics',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 2,
    }),
  ])
  const c = res.docs[0]
  if (!c) return null

  const clinicSlugs = lookupSlugs(c.city ?? '', c.state ?? '', slugMap)
  const providerWhere = {
    and: [
      { status: { equals: 'published' } },
      {
        or: [
          { clinic: { equals: c.id } },
          { additionalClinics: { in: [c.id] } },
        ],
      },
    ],
  } as any

  const [providersRes, relatedRes, faqs, cityMarketRes] = await Promise.all([
    payload.find({
      collection: 'providers',
      where: providerWhere,
      limit: 100,
      depth: 2,
      sort: '-aggregateRatingCount',
    }),
    payload.find({
      collection: 'clinics',
      where: {
        and: [
          { city: { like: c.city ?? '' } },
          { state: { equals: c.state ?? '' } },
          { status: { equals: 'published' } },
          { id: { not_equals: c.id } },
        ],
      } as any,
      limit: 3,
      depth: 1,
      sort: '-aggregateRatingCount',
    }),
    getClinicTypeFaqs(payload, c.clinicType ?? undefined),
    payload.find({
      collection: 'locations',
      where: {
        and: [
          { slug: { equals: clinicSlugs.citySlug } },
          { kind: { in: ['city', 'metro'] } },
        ],
      } as any,
      limit: 1,
      depth: 0,
    }),
  ])

  const providers = providersRes.docs.map(mapProvider)
  const providerCountByClinic = new Map<string, number>()
  for (const p of providersRes.docs as any[]) {
    const primaryId = p.clinic && typeof p.clinic === 'object' ? String(p.clinic.id) : String(p.clinic)
    if (primaryId) providerCountByClinic.set(primaryId, (providerCountByClinic.get(primaryId) ?? 0) + 1)
    if (Array.isArray(p.additionalClinics)) {
      for (const clinic of p.additionalClinics) {
        const id = clinic && typeof clinic === 'object' ? String(clinic.id) : String(clinic)
        if (id) providerCountByClinic.set(id, (providerCountByClinic.get(id) ?? 0) + 1)
      }
    }
  }

  const photos = clinicPhotoUrls(c)
  const cityMarket = cityMarketRes.docs[0]

  return {
    id: String(c.id),
    clinicId: c.clinicId,
    slug: c.slug,
    citySlug: clinicSlugs.citySlug,
    stateSlug: clinicSlugs.stateSlug,
    clinicName: c.clinicName,
    tagline: c.tagline ?? undefined,
    description: c.description ?? undefined,
    addressLine1: c.addressLine1,
    addressLine2: c.addressLine2 ?? undefined,
    county: c.county ?? undefined,
    city: c.city,
    state: c.state,
    zip: c.zip,
    neighborhood: c.neighborhood ?? undefined,
    latitude: Number(c.latitude) || 0,
    longitude: Number(c.longitude) || 0,
    googleMapsUrl: c.googleMapsUrl ?? undefined,
    directionsUrl: c.directionsUrl ?? c.googleMapsUrl ?? undefined,
    phone: c.phone ?? undefined,
    email: c.email ?? undefined,
    websiteUrl: c.websiteUrl ?? '',
    bookingUrl: c.bookingUrl ?? undefined,
    logoUrl: c.logoUrl ?? undefined,
    photoUrls: photos,
    hoursJson: normalizeHours(c.hoursJson),
    serviceType: c.serviceType || 'In-Person',
    acceptsInsurance: !!c.acceptsInsurance,
    paymentMethods: c.paymentMethods ?? undefined,
    amenities: c.amenities ?? undefined,
    treatmentsOffered: mapTreatments(c.servicesOffered),
    brandsOffered: mapTreatments(c.brandsOffered),
    yearEstablished: c.yearEstablished ?? undefined,
    aggregateRating: c.aggregateRating ?? undefined,
    aggregateRatingCount: c.aggregateRatingCount ?? undefined,
    startingPrice: c.startingPrice ?? undefined,
    languages: Array.isArray(c.languages) ? c.languages : [],
    photoUrl: photos[0],
    providers,
    claimed: !!c.claimed,
    faqs,
    relatedClinics: relatedRes.docs.map((clinic: any) =>
      mapRelatedClinic(clinic, slugMap, providerCountByClinic.get(String(clinic.id)) ?? 0),
    ),
    status: c.status ?? undefined,
    clinicType: c.clinicType ?? undefined,
    cityMarketNoindex: isMarketNoindex(cityMarket),
    instagramUrl: c.instagramUrl ?? undefined,
    tiktokUrl: c.tiktokUrl ?? undefined,
    facebookUrl: c.facebookUrl ?? undefined,
  }
}

export async function getClinicReviews(clinicId: string): Promise<ClinicReviewRow[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'reviews',
    where: {
      and: [
        { clinic: { equals: clinicId } },
        { moderationStatus: { equals: 'approved' } },
      ],
    } as any,
    limit: 50,
    sort: '-reviewDate',
    depth: 0,
  })
  return res.docs.map((r: any) => ({
    id: String(r.id),
    reviewerFirstName: r.reviewerFirstName,
    reviewerInitial: r.reviewerInitial,
    rating: Number(r.rating) || 0,
    reviewTitle: r.reviewTitle,
    reviewText: r.reviewText,
    treatmentTag: r.treatmentTag,
    reviewDate: r.reviewDate,
    sourcePlatform: r.sourcePlatform,
    verified: !!r.verified,
  }))
}

export async function getAllClinicParams(): Promise<{ state: string; city: string; slug: string }[]> {
  const payload = await getPayloadInstance()
  const [slugMap, res] = await Promise.all([
    getLocationSlugMap(),
    payload.find({ collection: 'clinics', where: { status: { equals: 'published' } }, limit: 10000, depth: 0 }),
  ])
  const isValidPathSegment = (s: string) =>
    s.length > 0 && s.length <= 200 && /^[a-z0-9][a-z0-9-]*$/.test(s)
  return res.docs
    .map((c: any) => {
      const s = lookupSlugs(c.city ?? '', c.state ?? '', slugMap)
      return { state: s.stateSlug, city: s.citySlug, slug: c.slug }
    })
    .filter((p) => isValidPathSegment(p.state) && isValidPathSegment(p.city) && isValidPathSegment(p.slug))
}

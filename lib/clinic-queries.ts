import { getPayloadInstance } from './payload-server'

export type ClinicListItem = {
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
  phone?: string
}

export type ClinicDetail = ClinicListItem & {
  clinicId: string
  description?: string
  addressLine1: string
  addressLine2?: string
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
  hoursJson?: Record<string, string>
  acceptsInsurance: boolean
  paymentMethods?: string
  amenities?: string
  providers: ClinicProvider[]
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
}

export async function getClinicsListing(): Promise<ClinicListItem[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'clinics',
    limit: 100,
    depth: 0,
    sort: '-aggregateRatingCount',
  })
  return res.docs.map((c: any) => ({
    id: String(c.id),
    slug: c.slug,
    clinicName: c.clinicName,
    tagline: c.tagline,
    city: c.city,
    state: c.state,
    neighborhood: c.neighborhood,
    aggregateRating: c.aggregateRating,
    aggregateRatingCount: c.aggregateRatingCount,
    photoUrl: c.clinicPhotoUrls?.[0]?.url,
    serviceType: c.serviceType || 'In-Person',
    yearEstablished: c.yearEstablished,
    phone: c.phone,
  }))
}

export async function getClinicBySlug(slug: string): Promise<ClinicDetail | null> {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'clinics',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
  })
  const c = res.docs[0]
  if (!c) return null

  // Fetch providers that belong to this clinic
  const provRes = await payload.find({
    collection: 'providers',
    where: { clinic: { equals: c.id } },
    limit: 20,
    depth: 1,
    sort: '-aggregateRatingCount',
  })

  const providers: ClinicProvider[] = provRes.docs.map((p: any) => ({
    id: String(p.id),
    slug: p.slug,
    fullName: p.fullName,
    credentials: p.credentials,
    title: p.title,
    profilePhotoUrl: p.profilePhotoUrl,
    aggregateRating: p.aggregateRating,
    aggregateRatingCount: p.aggregateRatingCount,
    startingPrice: p.startingPrice,
    treatments: Array.isArray(p.treatmentsOffered)
      ? p.treatmentsOffered.map((t: any) => (typeof t === 'object' ? t.name : '')).filter(Boolean)
      : [],
    yearsExperience: p.yearsExperience,
    acceptsNewPatients: !!p.acceptsNewPatients,
  }))

  return {
    id: String(c.id),
    clinicId: c.clinicId,
    slug: c.slug,
    clinicName: c.clinicName,
    tagline: c.tagline ?? undefined,
    description: c.description ?? undefined,
    addressLine1: c.addressLine1,
    addressLine2: c.addressLine2 ?? undefined,
    city: c.city,
    state: c.state,
    zip: c.zip,
    neighborhood: c.neighborhood ?? undefined,
    latitude: c.latitude,
    longitude: c.longitude,
    googleMapsUrl: c.googleMapsUrl ?? undefined,
    directionsUrl: c.directionsUrl ?? undefined,
    phone: c.phone,
    email: c.email ?? undefined,
    websiteUrl: c.websiteUrl,
    bookingUrl: c.bookingUrl ?? undefined,
    logoUrl: c.logoUrl ?? undefined,
    photoUrls: Array.isArray(c.clinicPhotoUrls) ? c.clinicPhotoUrls.map((p: any) => p.url) : [],
    hoursJson: (c.hoursJson ?? undefined) as Record<string, string> | undefined,
    serviceType: c.serviceType || 'In-Person',
    acceptsInsurance: !!c.acceptsInsurance,
    paymentMethods: c.paymentMethods ?? undefined,
    amenities: c.amenities ?? undefined,
    yearEstablished: c.yearEstablished ?? undefined,
    aggregateRating: c.aggregateRating ?? undefined,
    aggregateRatingCount: c.aggregateRatingCount ?? undefined,
    photoUrl: c.clinicPhotoUrls?.[0]?.url ?? undefined,
    providers,
  }
}

export async function getClinicReviews(clinicId: string): Promise<ClinicReviewRow[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'reviews',
    where: { clinic: { equals: clinicId } },
    limit: 10,
    sort: '-reviewDate',
    depth: 0,
  })
  return res.docs.map((r: any) => ({
    id: String(r.id),
    reviewerFirstName: r.reviewerFirstName,
    reviewerInitial: r.reviewerInitial,
    rating: r.rating,
    reviewTitle: r.reviewTitle,
    reviewText: r.reviewText,
    treatmentTag: r.treatmentTag,
    reviewDate: r.reviewDate,
    sourcePlatform: r.sourcePlatform,
  }))
}

export async function getAllClinicSlugs(): Promise<string[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({ collection: 'clinics', limit: 10000, depth: 0 })
  return res.docs.map((c: any) => c.slug)
}

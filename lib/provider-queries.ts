import { getPayloadInstance } from './payload-server'

export type ProviderListItem = {
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
  yearsExperience?: number
  acceptsNewPatients: boolean
  clinic: {
    id: string
    name: string
    slug: string
    city: string
    state: string
    neighborhood?: string
    photoUrl?: string
    latitude: number
    longitude: number
  }
  /** Other locations (branches) where this provider also practices. */
  additionalClinics: Array<{
    id: string
    name: string
    slug: string
    city: string
    state: string
    neighborhood?: string
  }>
}

export type ProviderDetail = ProviderListItem & {
  providerId: string
  bio?: string
  tagline?: string
  boardCertifications: string[]
  languages: string[]
  gender?: string
  specialties: string[]
  pricingBotoxPerUnit?: number
  pricingFillerPerSyringe?: number
  pricingConsultation?: number
  offersVirtualConsult: boolean
  offersInPerson: boolean
  loyaltyPrograms: string[]
  websiteUrl?: string
  instagramUrl?: string
  tiktokUrl?: string
  linkedinUrl?: string
  phoneDirect?: string
  email?: string
  npiNumber?: string
  licenseVerificationUrl?: string
  licenseStatus: string
  claimed: boolean
  subscriptionTier: 'free' | 'starter' | 'pro' | 'elite'
  profileViewCount: number
}

export type ReviewRow = {
  id: string
  reviewerFirstName?: string
  reviewerInitial?: string
  rating: number
  reviewTitle?: string
  reviewText: string
  treatmentTag?: string
  reviewDate: string
  sourcePlatform: string
  responseFromProvider?: string
}

function mapProvider(p: any, depth2 = false): ProviderListItem {
  return {
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
    editorsPick: !!p.editorsPick,
    licenseStateCode: p.licenseState,
    licenseNumber: p.licenseNumber,
    licenseVerificationUrl: p.licenseVerificationUrl ?? undefined,
    licenseStatus: p.licenseStatus ?? undefined,
    yearsExperience: p.yearsExperience,
    acceptsNewPatients: !!p.acceptsNewPatients,
    clinic:
      depth2 && p.clinic && typeof p.clinic === 'object'
        ? {
            id: String(p.clinic.id),
            name: p.clinic.clinicName,
            slug: p.clinic.slug,
            city: p.clinic.city,
            state: p.clinic.state,
            neighborhood: p.clinic.neighborhood,
            photoUrl: p.clinic.clinicPhotoUrls?.[0]?.url,
            latitude: Number(p.clinic.latitude) || 0,
            longitude: Number(p.clinic.longitude) || 0,
          }
        : { id: '', name: '', slug: '', city: '', state: '', latitude: 0, longitude: 0 },
    additionalClinics: Array.isArray(p.additionalClinics)
      ? p.additionalClinics
          .filter((c: any) => c && typeof c === 'object')
          .map((c: any) => ({
            id: String(c.id),
            name: c.clinicName,
            slug: c.slug,
            city: c.city,
            state: c.state,
            neighborhood: c.neighborhood ?? undefined,
          }))
      : [],
  }
}

export async function getProvidersListing(): Promise<ProviderListItem[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'providers',
    where: { status: { equals: 'published' } },
    limit: 1000,
    depth: 2,
    sort: '-aggregateRatingCount',
  })
  return res.docs
    .filter((p: any) => p.clinic && typeof p.clinic === 'object')
    .map((p: any) => mapProvider(p, true))
}

export async function getProviderBySlug(slug: string): Promise<ProviderDetail | null> {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'providers',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 2,
  })
  const p = res.docs[0]
  if (!p) return null

  return {
    ...mapProvider(p, true),
    providerId: p.providerId,
    bio: p.bio ?? undefined,
    tagline: p.tagline ?? undefined,
    boardCertifications: Array.isArray(p.boardCertifications)
      ? p.boardCertifications.map((b: any) => b.name)
      : [],
    languages: Array.isArray(p.languages) ? p.languages : [],
    gender: p.gender ?? undefined,
    specialties: Array.isArray(p.specialties) ? p.specialties.map((s: any) => s.name) : [],
    pricingBotoxPerUnit: p.pricingBotoxPerUnit ?? undefined,
    pricingFillerPerSyringe: p.pricingFillerPerSyringe ?? undefined,
    pricingConsultation: p.pricingConsultation ?? undefined,
    offersVirtualConsult: !!p.offersVirtualConsult,
    offersInPerson: !!p.offersInPerson,
    loyaltyPrograms: Array.isArray(p.loyaltyPrograms) ? p.loyaltyPrograms : [],
    websiteUrl: p.websiteUrl ?? undefined,
    instagramUrl: p.instagramUrl ?? undefined,
    tiktokUrl: p.tiktokUrl ?? undefined,
    linkedinUrl: p.linkedinUrl ?? undefined,
    phoneDirect: p.phoneDirect ?? undefined,
    email: p.email ?? undefined,
    npiNumber: p.npiNumber ?? undefined,
    licenseVerificationUrl: p.licenseVerificationUrl ?? undefined,
    licenseStatus: p.licenseStatus || 'Active',
    claimed: !!p.claimed,
    subscriptionTier: (p.subscriptionTier as 'free' | 'starter' | 'pro' | 'elite') || 'free',
    profileViewCount: p.profileViewCount || 0,
  }
}

export async function getProviderReviews(providerId: string): Promise<ReviewRow[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'reviews',
    where: {
      and: [
        { provider: { equals: providerId } },
        { moderationStatus: { equals: 'approved' } },
      ],
    } as any,
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
    responseFromProvider: r.responseFromProvider,
  }))
}

export type ProviderBeforeAfterCase = {
  id: string
  caseTitle: string
  beforePhotoUrl: string
  afterPhotoUrl: string
  treatmentTag: string
  weeksPost: number
  consentGranted: boolean
}

export async function getProviderBeforeAfterCases(providerId: string): Promise<ProviderBeforeAfterCase[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'before-after-cases',
    where: { provider: { equals: providerId }, consentGranted: { equals: true } },
    limit: 6,
    sort: 'sortRank',
    depth: 0,
  })
  return res.docs.map((b: any) => ({
    id: String(b.id),
    caseTitle: b.caseTitle,
    beforePhotoUrl: b.beforePhotoUrl,
    afterPhotoUrl: b.afterPhotoUrl,
    treatmentTag: b.treatmentTag,
    weeksPost: b.weeksPost,
    consentGranted: !!b.consentGranted,
  }))
}

export async function getAllProviderSlugs(): Promise<string[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({ collection: 'providers', where: { status: { equals: 'published' } }, limit: 10000, depth: 0 })
  return res.docs.map((p: any) => p.slug)
}

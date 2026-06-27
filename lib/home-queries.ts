import { getPayloadInstance } from './payload-server'
import type { NewsCard } from './news-queries'
import { getLocationSlugMap, lookupSlugs } from './location-slug-lookup'

export type TopClinicRow = {
  id: string; slug: string; clinicName: string; tagline?: string
  city: string; state: string; neighborhood?: string
  citySlug: string; stateSlug: string
  treatmentsOffered?: string[]; aggregateRating?: number; aggregateRatingCount?: number
  photoUrl?: string; serviceType: string; yearEstablished?: number
  latitude: number; longitude: number; providerCount: number
  clinicType?: string; startingPrice?: number
}

export type StateRow = { id: string; name: string; slug: string; state: string; providerCount: number; featured: boolean; sortRank: number; isLive: boolean }
export type TreatmentRow = { id: string; name: string; slug: string; category: string; tagline?: string; iconSlug?: string }
export type FeaturedProvider = {
  id: string; providerId: string; fullName: string; slug: string; credentials: string; title: string
  profilePhotoUrl?: string; aggregateRating?: number; aggregateRatingCount?: number
  startingPrice?: number; treatments: string[]; editorsPick?: boolean
  licenseStateCode: string; licenseNumber: string; licenseVerificationUrl?: string; licenseStatus?: string
  clinic: { id: string; name: string; citySlug: string; stateSlug: string; neighborhood?: string; city: string; state: string; photoUrl?: string }
  yearsExperience?: number
  loyaltyPrograms: string[]
}
export type GuideRow = {
  id: string; title: string; slug: string; lede: string; coverImageUrl?: string
  category: string; readTimeMin?: number; lastMedicallyReviewed?: string
  author?: { fullName: string; photoUrl?: string }
  reviewer?: { fullName: string; photoUrl?: string; credentials?: string }
}
export type BeforeAfterRow = {
  id: string; caseTitle: string; beforePhotoUrl: string; afterPhotoUrl: string
  treatmentTag: string; weeksPost: number; city: string; state: string
  citySlug: string; stateSlug: string
  provider?: { fullName?: string; slug?: string }
  consentGranted: boolean
}

export async function getHomePageData() {
  const payload = await getPayloadInstance()
  const slugMap = await getLocationSlugMap()
  const [statesRes, treatmentsRes, providersRes, guidesRes, baCasesRes, newsRes, clinicsRes] = await Promise.all([
    payload.find({ collection: 'locations', limit: 50, depth: 0, where: { kind: { equals: 'state' } }, sort: 'sortRank' }),
    payload.find({ collection: 'services', limit: 12, depth: 0, sort: 'name' }),
    payload.find({ collection: 'providers', limit: 6, depth: 2, where: { and: [{ editorsPick: { equals: true } }, { status: { equals: 'published' } }] }, sort: 'featuredRank' }),
    payload.find({ collection: 'guides', limit: 12, depth: 2, sort: '-publishedAt' }),
    payload.find({ collection: 'before-after-cases', limit: 12, depth: 1, sort: 'sortRank', where: { consentGranted: { equals: true } } }),
    payload.find({ collection: 'news', limit: 3, depth: 1, sort: '-publishedAt', where: { status: { equals: 'published' } } }),
    payload.find({ collection: 'clinics', limit: 6, depth: 0, where: { status: { equals: 'published' } }, sort: '-aggregateRatingCount' }),
  ])

  const states: StateRow[] = statesRes.docs.map((s: any) => ({
    id: String(s.id), name: s.name, slug: s.slug, state: s.state,
    providerCount: s.providerCount ?? 0, featured: !!s.featured, sortRank: s.sortRank ?? 999,
    isLive: s.isLive === true,
  }))

  const treatments: TreatmentRow[] = treatmentsRes.docs.map((t: any) => ({
    id: String(t.id), name: t.name, slug: t.slug, category: t.category, tagline: t.tagline, iconSlug: t.iconSlug,
  }))

  const featuredProviders: FeaturedProvider[] = providersRes.docs
    .filter((p: any) => p.clinic && typeof p.clinic === 'object')
    .map((p: any) => ({
      id: String(p.id), providerId: p.providerId, fullName: p.fullName, slug: p.slug,
      credentials: p.credentials, title: p.title, profilePhotoUrl: p.profilePhotoUrl,
      aggregateRating: p.aggregateRating, aggregateRatingCount: p.aggregateRatingCount,
      startingPrice: p.startingPrice,
      treatments: Array.isArray(p.treatmentsOffered) ? p.treatmentsOffered.map((t: any) => typeof t === 'object' ? t.name : '') : [],
      editorsPick: !!p.editorsPick, licenseStateCode: p.licenseState, licenseNumber: p.licenseNumber,
      licenseVerificationUrl: p.licenseVerificationUrl ?? undefined,
      licenseStatus: p.licenseStatus ?? undefined,
      yearsExperience: p.yearsExperience,
      loyaltyPrograms: Array.isArray(p.loyaltyPrograms) ? p.loyaltyPrograms : [],
      clinic: {
        id: String(p.clinic.id), name: p.clinic.clinicName,
        ...lookupSlugs(p.clinic.city ?? '', p.clinic.state ?? '', slugMap),
        neighborhood: p.clinic.neighborhood, city: p.clinic.city, state: p.clinic.state,
        photoUrl: p.clinic.clinicPhotoUrls?.[0]?.url,
      },
    }))

  const guides: GuideRow[] = guidesRes.docs.map((g: any) => ({
    id: String(g.id), title: g.title, slug: g.slug, lede: g.lede, coverImageUrl: g.coverImageUrl,
    category: g.category, readTimeMin: g.readTimeMin,
    lastMedicallyReviewed: g.lastMedicallyReviewed,
    author: g.author && typeof g.author === 'object' ? { fullName: g.author.fullName, photoUrl: g.author.photoUrl } : undefined,
    reviewer: g.medicalReviewer && typeof g.medicalReviewer === 'object' ? { fullName: g.medicalReviewer.fullName, photoUrl: g.medicalReviewer.photoUrl, credentials: g.medicalReviewer.credentials } : undefined,
  }))

  const beforeAfter: BeforeAfterRow[] = baCasesRes.docs.map((b: any) => {
    const baSlug = lookupSlugs(b.city ?? '', b.state ?? '', slugMap)
    return {
      id: String(b.id), caseTitle: b.caseTitle, beforePhotoUrl: b.beforePhotoUrl, afterPhotoUrl: b.afterPhotoUrl,
      treatmentTag: b.treatmentTag, weeksPost: b.weeksPost, city: b.city, state: b.state,
      citySlug: baSlug.citySlug, stateSlug: baSlug.stateSlug,
      provider: b.provider && typeof b.provider === 'object' ? { fullName: b.provider.fullName, slug: b.provider.slug } : undefined,
      consentGranted: !!b.consentGranted,
    }
  })

  const latestNews: NewsCard[] = newsRes.docs.map((n: any) => {
    const coverImageUrl =
      n.coverImage && typeof n.coverImage === 'object' ? (n.coverImage as any).url : n.coverImageUrl || undefined
    return {
      id: String(n.id),
      title: n.title,
      slug: n.slug,
      excerpt: n.excerpt,
      coverImageUrl,
      category: n.category,
      publishedAt: n.publishedAt ?? undefined,
      featured: !!n.featured,
      author:
        n.author && typeof n.author === 'object'
          ? { fullName: (n.author as any).fullName, photoUrl: (n.author as any).photoUrl ?? undefined }
          : { fullName: 'injector.world Editorial' },
      medicalReviewer: undefined,
      relatedTreatment: undefined,
    }
  })

  const topClinics: TopClinicRow[] = clinicsRes.docs
    .filter((c: any) => c.city && c.state)
    .map((c: any) => {
      const slugs = lookupSlugs(c.city ?? '', c.state ?? '', slugMap)
      return {
        id: String(c.id), slug: c.slug, clinicName: c.clinicName,
        tagline: c.tagline, city: c.city, state: c.state, neighborhood: c.neighborhood,
        citySlug: slugs.citySlug, stateSlug: slugs.stateSlug,
        treatmentsOffered: Array.isArray(c.treatmentsOffered) ? c.treatmentsOffered.map((t: any) => typeof t === 'object' ? t.name : String(t)) : [],
        aggregateRating: c.aggregateRating, aggregateRatingCount: c.aggregateRatingCount,
        photoUrl: c.clinicPhotoUrls?.[0]?.url,
        serviceType: c.clinicType ?? 'Aesthetic Clinic',
        yearEstablished: c.yearEstablished,
        latitude: c.latitude ?? 0, longitude: c.longitude ?? 0,
        providerCount: c.providerCount ?? 0,
        clinicType: c.clinicType, startingPrice: c.startingPrice,
      }
    })

  return { states, treatments, featuredProviders, guides, beforeAfter, latestNews, topClinics }
}


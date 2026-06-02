import { getPayloadInstance } from './payload-server'

export type StateRow = { id: string; name: string; slug: string; state: string; providerCount: number; featured: boolean; sortRank: number }
export type TreatmentRow = { id: string; name: string; slug: string; category: string; tagline?: string; iconSlug?: string }
export type FeaturedProvider = {
  id: string; providerId: string; fullName: string; slug: string; credentials: string; title: string
  profilePhotoUrl?: string; aggregateRating?: number; aggregateRatingCount?: number
  startingPrice?: number; treatments: string[]; editorsPick?: boolean
  licenseStateCode: string; licenseNumber: string
  clinic: { id: string; name: string; neighborhood?: string; city: string; state: string; photoUrl?: string }
  yearsExperience?: number
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
  provider?: { fullName?: string; slug?: string }
  consentGranted: boolean
}

export async function getHomePageData() {
  const payload = await getPayloadInstance()
  const [statesRes, treatmentsRes, providersRes, guidesRes, baCasesRes] = await Promise.all([
    payload.find({ collection: 'locations', limit: 50, depth: 0, where: { kind: { equals: 'state' } }, sort: 'sortRank' }),
    payload.find({ collection: 'treatments', limit: 12, depth: 0, sort: 'name' }),
    payload.find({ collection: 'providers', limit: 6, depth: 2, where: { editorsPick: { equals: true } }, sort: 'featuredRank' }),
    payload.find({ collection: 'guides', limit: 12, depth: 2, sort: '-publishedAt' }),
    payload.find({ collection: 'before-after-cases', limit: 12, depth: 1, sort: 'sortRank' }),
  ])

  const states: StateRow[] = statesRes.docs.map((s: any) => ({
    id: String(s.id), name: s.name, slug: s.slug, state: s.state,
    providerCount: s.providerCount ?? 0, featured: !!s.featured, sortRank: s.sortRank ?? 999,
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
      yearsExperience: p.yearsExperience,
      clinic: {
        id: String(p.clinic.id), name: p.clinic.clinicName,
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

  const beforeAfter: BeforeAfterRow[] = baCasesRes.docs.map((b: any) => ({
    id: String(b.id), caseTitle: b.caseTitle, beforePhotoUrl: b.beforePhotoUrl, afterPhotoUrl: b.afterPhotoUrl,
    treatmentTag: b.treatmentTag, weeksPost: b.weeksPost, city: b.city, state: b.state,
    provider: b.provider && typeof b.provider === 'object' ? { fullName: b.provider.fullName, slug: b.provider.slug } : undefined,
    consentGranted: !!b.consentGranted,
  }))

  return { states, treatments, featuredProviders, guides, beforeAfter }
}

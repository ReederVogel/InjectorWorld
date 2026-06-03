import { getPayloadInstance } from './payload-server'

export type FaqItem = {
  id: string
  question: string
  answer: string
}

export type GuideDetail = {
  id: string
  title: string
  slug: string
  lede: string
  excerpt?: string
  coverImageUrl?: string
  category: string
  readTimeMin?: number
  sourcesCount?: number
  body?: any
  faqs: FaqItem[]
  publishedAt?: string
  lastMedicallyReviewed?: string
  featured: boolean
  author: {
    fullName: string
    role?: string
    photoUrl?: string
    linkedinUrl?: string
    bio?: string
  }
  medicalReviewer?: {
    fullName: string
    credentials: string
    title?: string
    photoUrl?: string
    boardCertifications?: string[]
    city?: string
    state?: string
  }
  relatedTreatment?: {
    id: string
    name: string
    slug: string
    tagline?: string
  }
  meta?: {
    title?: string
    description?: string
    image?: { url?: string }
  }
}

export async function getGuideBySlug(slug: string): Promise<GuideDetail | null> {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'guides',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 2,
  })
  const g = res.docs[0]
  if (!g) return null

  const coverImageUploadUrl =
    g.coverImage && typeof g.coverImage === 'object' ? (g.coverImage as any).url : undefined
  const coverImageUrl = coverImageUploadUrl || g.coverImageUrl || undefined

  const faqs: FaqItem[] = Array.isArray(g.faqs)
    ? g.faqs
        .filter((f: any) => typeof f === 'object' && f.question)
        .map((f: any) => ({
          id: String(f.id),
          question: f.question,
          answer: f.answer,
        }))
    : []

  return {
    id: String(g.id),
    title: g.title,
    slug: g.slug,
    lede: g.lede,
    excerpt: g.excerpt ?? undefined,
    coverImageUrl,
    category: g.category,
    readTimeMin: g.readTimeMin ?? undefined,
    sourcesCount: g.sourcesCount ?? undefined,
    body: g.body ?? null,
    faqs,
    publishedAt: g.publishedAt ?? undefined,
    lastMedicallyReviewed: g.lastMedicallyReviewed ?? undefined,
    featured: !!g.featured,
    author:
      g.author && typeof g.author === 'object'
        ? {
            fullName: (g.author as any).fullName,
            role: (g.author as any).role ?? undefined,
            photoUrl: (g.author as any).photoUrl ?? undefined,
            linkedinUrl: (g.author as any).linkedinUrl ?? undefined,
            bio: (g.author as any).bio ?? undefined,
          }
        : { fullName: 'injector.world Editorial' },
    medicalReviewer:
      g.medicalReviewer && typeof g.medicalReviewer === 'object'
        ? {
            fullName: (g.medicalReviewer as any).fullName,
            credentials: (g.medicalReviewer as any).credentials,
            title: (g.medicalReviewer as any).title ?? undefined,
            photoUrl: (g.medicalReviewer as any).photoUrl ?? undefined,
            boardCertifications: Array.isArray((g.medicalReviewer as any).boardCertifications)
              ? (g.medicalReviewer as any).boardCertifications.map((b: any) => b.name as string)
              : [],
            city: (g.medicalReviewer as any).city ?? undefined,
            state: (g.medicalReviewer as any).state ?? undefined,
          }
        : undefined,
    relatedTreatment:
      g.relatedTreatment && typeof g.relatedTreatment === 'object'
        ? {
            id: String((g.relatedTreatment as any).id),
            name: (g.relatedTreatment as any).name,
            slug: (g.relatedTreatment as any).slug,
            tagline: (g.relatedTreatment as any).tagline ?? undefined,
          }
        : undefined,
    meta: g.meta
      ? {
          title: (g.meta as any).title ?? undefined,
          description: (g.meta as any).description ?? undefined,
          image:
            (g.meta as any).image && typeof (g.meta as any).image === 'object'
              ? { url: (g.meta as any).image.url }
              : undefined,
        }
      : undefined,
  }
}

export async function getGuideFaqs(treatmentName: string): Promise<FaqItem[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'faqs',
    where: {
      scope: { equals: 'treatment' },
      treatmentTag: { like: treatmentName },
    },
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

export async function getAllGuideSlugs(): Promise<string[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({ collection: 'guides', limit: 10000, depth: 0 })
  return res.docs.map((g: any) => g.slug)
}

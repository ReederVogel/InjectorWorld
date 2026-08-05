import { getPayloadInstance } from './payload-server'
import type { AtAGlanceFact } from '@/components/shared/AtAGlanceList'

export type FaqItem = {
  id: string
  question: string
  answer: string
  detail?: string
  offLabel?: boolean
  safetyFlag?: string
  relatedGuideSlug?: string
  relatedGuideTitle?: string
}

export type GuideDetail = {
  id: string
  title: string
  slug: string
  lede: string
  excerpt?: string
  coverImageUrl?: string
  coverImageAlt?: string
  coverImageWidth?: number
  coverImageHeight?: number
  category: string
  readTimeMin?: number
  sourcesCount?: number
  indexState: 'noindex' | 'indexed'
  nofollow: boolean
  body?: any
  answerSnippet?: string
  atAGlance?: AtAGlanceFact[]
  faq?: Array<{
    question: string
    answer: string
    detail?: string
    offLabel?: boolean
    safetyFlag?: string
  }>
  sources?: Array<{
    title: string
    publisher: string
    url: string
    publishedDate?: string
    sourceType: string
    claimsSupported?: string[]
  }>
  faqs: FaqItem[]
  publishedAt?: string
  /** Real last-modified timestamp (Payload-maintained). Feeds schema.org dateModified -- bumps whenever the doc is saved, including when an internal link is inserted. */
  updatedAt?: string
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
  relatedService?: {
    id: string
    name: string
    slug: string
    tagline?: string
    painIndex?: number
    longevityLabel?: string
    downtimeLabel?: string
  }
  meta?: {
    title?: string
    description?: string
    image?: { url?: string }
  }
}

// Public gate: must be approved. Guide moderation is driven by reviewStatus
// (imported → in-review → approved), NOT the legacy `status` field. A
// status='published' check was tried but excluded all existing guides, whose
// `status` was never backfilled off its 'draft' default — so it is not required.
const APPROVED: any[] = [
  { reviewStatus: { equals: 'approved' } },
]

export async function getGuideBySlug(slug: string): Promise<GuideDetail | null> {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'guides',
    where: { and: [...APPROVED, { slug: { equals: slug } }] },
    limit: 1,
    depth: 2,
  })
  const g = res.docs[0]
  if (!g) return null

  const coverImageObj = g.coverImage && typeof g.coverImage === 'object' ? (g.coverImage as any) : undefined
  const coverImageUrl = coverImageObj?.url || g.coverImageUrl || undefined
  const coverImageAlt = coverImageObj?.alt || undefined
  const coverImageWidth = coverImageObj?.width || undefined
  const coverImageHeight = coverImageObj?.height || undefined

  const faqs: FaqItem[] = Array.isArray(g.faqs)
    ? g.faqs
        .filter((f: any) => typeof f === 'object' && f.question)
        .map((f: any) => ({
          id: String(f.id),
          question: f.question,
          answer: f.answer,
          detail: f.answerDetail || undefined,
          offLabel: !!f.offLabel,
          safetyFlag: f.safetyFlag || undefined,
          relatedGuideSlug: f.relatedGuide && typeof f.relatedGuide === 'object' ? f.relatedGuide.slug : undefined,
          relatedGuideTitle: f.relatedGuide && typeof f.relatedGuide === 'object' ? f.relatedGuide.title : undefined,
        }))
    : []

  return {
    id: String(g.id),
    title: g.title,
    slug: g.slug,
    lede: g.lede,
    excerpt: g.excerpt ?? undefined,
    coverImageUrl,
    coverImageAlt,
    coverImageWidth,
    coverImageHeight,
    category: g.category,
    readTimeMin: g.readTimeMin ?? undefined,
    sourcesCount: g.sourcesCount ?? undefined,
    indexState: (g.indexState as any) ?? 'indexed',
    nofollow: (g.nofollow as any) ?? false,
    body: g.body ?? null,
    answerSnippet: (g.answerSnippet as any) || undefined,
    atAGlance: Array.isArray((g as any).atAGlance) ? (g as any).atAGlance : undefined,
    faq: Array.isArray((g as any).faq) ? (g as any).faq : undefined,
    sources: Array.isArray((g as any).sources) ? (g as any).sources : undefined,
    faqs,
    publishedAt: g.publishedAt ?? undefined,
    updatedAt: (g as any).updatedAt ?? undefined,
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
    relatedService:
      g.relatedService && typeof g.relatedService === 'object'
        ? {
            id: String((g.relatedService as any).id),
            name: (g.relatedService as any).name,
            slug: (g.relatedService as any).slug,
            tagline: (g.relatedService as any).tagline ?? undefined,
            painIndex: (g.relatedService as any).painIndex ?? undefined,
            longevityLabel: (g.relatedService as any).longevityLabel ?? undefined,
            downtimeLabel: (g.relatedService as any).downtimeLabel ?? undefined,
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

/**
 * FAQs authored directly for this guide (scope: 'guide'), for topics with no
 * matching Service or Brand page to borrow FAQs from via getGuideFaqs below
 * (e.g. Jowls, Hyaluronidase, What Are Dermal Fillers).
 */
export async function getGuideOwnFaqs(guideId: number): Promise<FaqItem[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'faqs',
    where: {
      and: [
        { scope: { equals: 'guide' } },
        { guide: { equals: guideId } },
        { reviewStatus: { equals: 'approved' } },
      ],
    },
    limit: 40,
    sort: 'sortRank',
    depth: 1,
  })
  return res.docs.map((f: any) => ({
    id: String(f.id),
    question: f.question,
    answer: f.answer,
    detail: f.answerDetail || undefined,
    offLabel: !!f.offLabel,
    safetyFlag: f.safetyFlag || undefined,
    relatedGuideSlug: f.relatedGuide && typeof f.relatedGuide === 'object' ? f.relatedGuide.slug : undefined,
    relatedGuideTitle: f.relatedGuide && typeof f.relatedGuide === 'object' ? f.relatedGuide.title : undefined,
  }))
}

export async function getGuideFaqs(serviceId: number): Promise<FaqItem[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'faqs',
    where: {
      and: [
        { scope: { equals: 'service' } },
        { service: { equals: serviceId } },
        { reviewStatus: { equals: 'approved' } },
      ],
    },
    limit: 8,
    sort: 'sortRank',
    depth: 1,
  })
  return res.docs.map((f: any) => ({
    id: String(f.id),
    question: f.question,
    answer: f.answer,
    detail: f.answerDetail || undefined,
    offLabel: !!f.offLabel,
    safetyFlag: f.safetyFlag || undefined,
    relatedGuideSlug: f.relatedGuide && typeof f.relatedGuide === 'object' ? f.relatedGuide.slug : undefined,
    relatedGuideTitle: f.relatedGuide && typeof f.relatedGuide === 'object' ? f.relatedGuide.title : undefined,
  }))
}

/** For generateStaticParams: all approved slugs (any indexState). */
export async function getAllApprovedGuideSlugs(): Promise<string[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'guides',
    where: { and: APPROVED },
    limit: 10000,
    depth: 0,
  })
  return res.docs.map((g: any) => g.slug)
}

/** For sitemap: approved AND indexed only. */
export async function getAllGuideSlugs(): Promise<string[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'guides',
    where: {
      and: [
        ...APPROVED,
        { indexState: { equals: 'indexed' } },
      ],
    },
    limit: 10000,
    depth: 0,
  })
  return res.docs.map((g: any) => g.slug)
}

export type GuideCard = {
  id: string
  title: string
  slug: string
  lede: string
  coverImageUrl?: string
  category: string
  readTimeMin?: number
  publishedAt?: string
  lastMedicallyReviewed?: string
  featured: boolean
  author: { fullName: string; role?: string; photoUrl?: string }
  medicalReviewer?: { fullName: string; credentials: string }
}

export async function getAllGuides(): Promise<GuideCard[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'guides',
    where: { and: APPROVED },
    limit: 500,
    // All guides share one publishedAt today, so -createdAt is what actually
    // orders this list. Without it the order is non-deterministic. See the note
    // in lib/home-queries.ts.
    sort: ['-publishedAt', '-createdAt'],
    depth: 2,
  })
  return res.docs.map((g: any) => {
    const coverImageUploadUrl =
      g.coverImage && typeof g.coverImage === 'object' ? (g.coverImage as any).url : undefined
    return {
      id: String(g.id),
      title: g.title,
      slug: g.slug,
      lede: g.lede,
      coverImageUrl: coverImageUploadUrl || g.coverImageUrl || undefined,
      category: g.category,
      readTimeMin: g.readTimeMin ?? undefined,
      publishedAt: g.publishedAt ?? undefined,
      lastMedicallyReviewed: g.lastMedicallyReviewed ?? undefined,
      featured: !!g.featured,
      author:
        g.author && typeof g.author === 'object'
          ? {
              fullName: (g.author as any).fullName,
              role: (g.author as any).role ?? undefined,
              photoUrl: (g.author as any).photoUrl ?? undefined,
            }
          : { fullName: 'injector.world Editorial' },
      medicalReviewer:
        g.medicalReviewer && typeof g.medicalReviewer === 'object'
          ? {
              fullName: (g.medicalReviewer as any).fullName,
              credentials: (g.medicalReviewer as any).credentials,
            }
          : undefined,
    }
  })
}


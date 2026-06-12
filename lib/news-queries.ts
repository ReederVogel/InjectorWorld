import { getPayloadInstance } from './payload-server'

export type NewsCard = {
  id: string
  title: string
  slug: string
  excerpt: string
  coverImageUrl?: string
  category: string
  publishedAt?: string
  featured: boolean
  author: { fullName: string; role?: string; photoUrl?: string }
  medicalReviewer?: { fullName: string; credentials: string }
  relatedTreatment?: { name: string; slug: string }
}

export type NewsDetail = {
  id: string
  title: string
  slug: string
  excerpt: string
  coverImageUrl?: string
  category: string
  publishedAt?: string
  featured: boolean
  body?: any
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
  }
  relatedTreatment?: { id: string; name: string; slug: string; tagline?: string }
}

export type NewsRssItem = {
  title: string
  slug: string
  excerpt: string
  publishedAt?: string
  category: string
}

const PUBLISHED = { status: { equals: 'published' } }

export async function getLatestNews(limit = 50): Promise<NewsCard[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'news',
    where: PUBLISHED,
    limit,
    sort: '-publishedAt',
    depth: 2,
  })
  return res.docs.map(mapCard)
}

export async function getNewsBySlug(slug: string): Promise<NewsDetail | null> {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'news',
    where: { and: [PUBLISHED, { slug: { equals: slug } }] },
    limit: 1,
    depth: 2,
  })
  const n = res.docs[0]
  if (!n) return null

  const coverImageUrl = resolveCoverUrl(n)

  return {
    id: String(n.id),
    title: n.title,
    slug: n.slug,
    excerpt: n.excerpt,
    coverImageUrl,
    category: n.category,
    publishedAt: n.publishedAt ?? undefined,
    featured: !!n.featured,
    body: n.body ?? null,
    author:
      n.author && typeof n.author === 'object'
        ? {
            fullName: (n.author as any).fullName,
            role: (n.author as any).role ?? undefined,
            photoUrl: (n.author as any).photoUrl ?? undefined,
            linkedinUrl: (n.author as any).linkedinUrl ?? undefined,
            bio: (n.author as any).bio ?? undefined,
          }
        : { fullName: 'injector.world Editorial' },
    medicalReviewer:
      n.medicalReviewer && typeof n.medicalReviewer === 'object'
        ? {
            fullName: (n.medicalReviewer as any).fullName,
            credentials: (n.medicalReviewer as any).credentials,
            title: (n.medicalReviewer as any).title ?? undefined,
            photoUrl: (n.medicalReviewer as any).photoUrl ?? undefined,
          }
        : undefined,
    relatedTreatment:
      n.relatedTreatment && typeof n.relatedTreatment === 'object'
        ? {
            id: String((n.relatedTreatment as any).id),
            name: (n.relatedTreatment as any).name,
            slug: (n.relatedTreatment as any).slug,
            tagline: (n.relatedTreatment as any).tagline ?? undefined,
          }
        : undefined,
  }
}

export async function getAllNewsSlugs(): Promise<string[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'news',
    where: PUBLISHED,
    limit: 10000,
    depth: 0,
  })
  return res.docs.map((n: any) => n.slug)
}

export async function getLatestNewsForRss(limit = 20): Promise<NewsRssItem[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'news',
    where: PUBLISHED,
    limit,
    sort: '-publishedAt',
    depth: 0,
  })
  return res.docs.map((n: any) => ({
    title: n.title,
    slug: n.slug,
    excerpt: n.excerpt,
    publishedAt: n.publishedAt ?? undefined,
    category: n.category,
  }))
}

function resolveCoverUrl(n: any): string | undefined {
  const uploadUrl =
    n.coverImage && typeof n.coverImage === 'object' ? (n.coverImage as any).url : undefined
  return uploadUrl || n.coverImageUrl || undefined
}

function mapCard(n: any): NewsCard {
  return {
    id: String(n.id),
    title: n.title,
    slug: n.slug,
    excerpt: n.excerpt,
    coverImageUrl: resolveCoverUrl(n),
    category: n.category,
    publishedAt: n.publishedAt ?? undefined,
    featured: !!n.featured,
    author:
      n.author && typeof n.author === 'object'
        ? {
            fullName: (n.author as any).fullName,
            role: (n.author as any).role ?? undefined,
            photoUrl: (n.author as any).photoUrl ?? undefined,
          }
        : { fullName: 'injector.world Editorial' },
    medicalReviewer:
      n.medicalReviewer && typeof n.medicalReviewer === 'object'
        ? {
            fullName: (n.medicalReviewer as any).fullName,
            credentials: (n.medicalReviewer as any).credentials,
          }
        : undefined,
    relatedTreatment:
      n.relatedTreatment && typeof n.relatedTreatment === 'object'
        ? {
            name: (n.relatedTreatment as any).name,
            slug: (n.relatedTreatment as any).slug,
          }
        : undefined,
  }
}

import { getPayloadInstance } from './payload-server'

/**
 * Site-content search for the "Top results" block on /search (Phase 13).
 *
 * Surfaces matching guides, news, treatment pillars, and brand hubs above the
 * provider/clinic directory results so /search reads like true site search. Read
 * only. Matches any meaningful token against each collection's title/name (these
 * are small, curated collections, so token OR is cheap and high-recall).
 */
export type TopResult = {
  type: 'guide' | 'news' | 'treatment' | 'brand'
  title: string
  href: string
  excerpt?: string
}

const TYPE_ORDER: TopResult['type'][] = ['treatment', 'guide', 'news', 'brand']

export async function getTopResults(q: string, max = 6): Promise<TopResult[]> {
  const term = (q ?? '').trim()
  if (term.length < 2) return []

  const tokens = term.toLowerCase().split(/[\s,]+/).filter((t) => t.length >= 3)
  // OR of token "like" clauses; fall back to the whole term when there are no
  // long-enough tokens (e.g. a short query).
  const orFor = (field: string) =>
    tokens.length ? { or: tokens.map((t) => ({ [field]: { like: t } })) } : { [field]: { like: term } }

  const payload = await getPayloadInstance()

  const [guides, news, treatments, brands] = await Promise.all([
    payload
      .find({ collection: 'guides', where: orFor('title'), limit: 3, depth: 0 })
      .catch(() => ({ docs: [] as any[] })),
    payload
      .find({
        collection: 'news',
        where: { and: [{ status: { equals: 'published' } }, orFor('title')] },
        limit: 3,
        depth: 0,
      })
      .catch(() => ({ docs: [] as any[] })),
    payload
      .find({ collection: 'treatments', where: orFor('name'), limit: 3, depth: 0 })
      .catch(() => ({ docs: [] as any[] })),
    payload
      .find({ collection: 'brands', where: orFor('name'), limit: 3, depth: 0 })
      .catch(() => ({ docs: [] as any[] })),
  ])

  const results: TopResult[] = []
  for (const t of treatments.docs as any[]) {
    results.push({ type: 'treatment', title: t.name, href: `/services/${t.slug}`, excerpt: t.tagline ?? undefined })
  }
  for (const g of guides.docs as any[]) {
    results.push({ type: 'guide', title: g.title, href: `/guides/${g.slug}`, excerpt: g.excerpt ?? undefined })
  }
  for (const n of news.docs as any[]) {
    results.push({ type: 'news', title: n.title, href: `/news/${n.slug}`, excerpt: n.excerpt ?? undefined })
  }
  for (const b of brands.docs as any[]) {
    results.push({ type: 'brand', title: b.name, href: `/brands/${b.slug}` })
  }

  return results
    .sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type))
    .slice(0, max)
}

import { getPayloadInstance } from './payload-server'
import { ttlMemo } from './ttl-memo'

/**
 * Site-content search for the "Top results" block on /search (Phase 13).
 *
 * Surfaces matching guides, news, treatment pillars, and brand hubs above the
 * provider/clinic directory results so /search reads like true site search. Read
 * only. Matches any meaningful token against each collection's title/name (these
 * are small, curated collections, so token OR is cheap and high-recall).
 */
export type TopResult = {
  type: 'guide' | 'news' | 'service' | 'brand'
  title: string
  href: string
  excerpt?: string
}

const TYPE_ORDER: TopResult['type'][] = ['service', 'guide', 'news', 'brand']

/**
 * Memoised per query term. Four payload.find calls per search before
 * 2026-09-05, on a connection pool of 4, for four small curated collections
 * whose contents change on an editor's timescale rather than a request's.
 * Keyed on the normalised term + max, capped at 200 terms because the key comes
 * from user input. See lib/ttl-memo.ts. Bypass with SEARCH_OPTION_CACHE=0.
 */
export const getTopResults = ttlMemo(_getTopResults, {
  maxEntries: 200,
  key: (q: string, max = 6) => `${(q ?? '').trim().toLowerCase()}::${max}`,
})

async function _getTopResults(q: string, max = 6): Promise<TopResult[]> {
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
      .find({
        collection: 'guides',
        where: { and: [{ reviewStatus: { equals: 'approved' } }, orFor('title')] },
        limit: 3,
        depth: 0,
      })
      .catch(() => ({ docs: [] as any[] })),
    payload
      .find({
        collection: 'news',
        where: { and: [{ reviewStatus: { equals: 'approved' } }, orFor('title')] },
        limit: 3,
        depth: 0,
      })
      .catch(() => ({ docs: [] as any[] })),
    payload
      .find({ collection: 'services', where: orFor('name'), limit: 3, depth: 0 })
      .catch(() => ({ docs: [] as any[] })),
    payload
      .find({ collection: 'brands', where: orFor('name'), limit: 3, depth: 0 })
      .catch(() => ({ docs: [] as any[] })),
  ])

  const results: TopResult[] = []
  for (const t of treatments.docs as any[]) {
    results.push({ type: 'service', title: t.name, href: `/services/${t.slug}`, excerpt: t.tagline ?? undefined })
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


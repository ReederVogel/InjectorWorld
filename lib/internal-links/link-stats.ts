import type { Payload } from 'payload'

/** Walks a Lexical body (our simplified shape) and counts internal vs external links. */
export function countLinks(body: any): { internal: number; external: number } {
  let internal = 0
  let external = 0

  function walk(node: any) {
    if (!node || typeof node !== 'object') return
    if (node.type === 'link') {
      const url: string = node.fields?.url || node.url || ''
      const isExternal = /^https?:\/\//i.test(url) && !/injector\.world/i.test(url)
      if (isExternal) external++
      else internal++
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) walk(child)
    }
  }

  walk(body?.root)
  return { internal, external }
}

/** Collects every internal link URL found in a Lexical body. */
export function listInternalLinkUrls(body: any): string[] {
  const urls: string[] = []

  function walk(node: any) {
    if (!node || typeof node !== 'object') return
    if (node.type === 'link') {
      const url: string = node.fields?.url || node.url || ''
      const isExternal = /^https?:\/\//i.test(url) && !/injector\.world/i.test(url)
      if (url && !isExternal) urls.push(url)
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) walk(child)
    }
  }

  walk(body?.root)
  return urls
}

/** "/guides/botox-cost" or "https://www.injector.world/guides/botox-cost" -> "guide:botox-cost". */
export function urlToTargetKey(url: string): string | null {
  const m = url.match(/\/(guides|news|brands|services)\/([a-z0-9-]+)/i)
  if (!m) return null
  const typeMap: Record<string, string> = { guides: 'guide', news: 'news', brands: 'brand', services: 'service' }
  return `${typeMap[m[1].toLowerCase()]}:${m[2].toLowerCase()}`
}

/**
 * Counts INCOMING internal links for every guide/news page, keyed
 * "guide:<slug>" / "news:<slug>" -- i.e. how many other pages link TO it.
 *
 * This is the orphan-page signal: a page with 0 incoming internal links is
 * effectively invisible to search engines no matter how good its content is,
 * which makes this the number worth prioritising work against (outgoing link
 * counts say nothing about whether a page can be discovered).
 */
export async function countIncomingLinks(payload: Payload): Promise<Map<string, number>> {
  const [guides, news] = await Promise.all([
    payload.find({ collection: 'guides', where: { reviewStatus: { equals: 'approved' } }, limit: 1000, depth: 0 }),
    payload.find({ collection: 'news', where: { reviewStatus: { equals: 'approved' } }, limit: 1000, depth: 0 }),
  ])

  const counts = new Map<string, number>()
  // Seed every page at 0 so pages that are never linked to still appear (they
  // are precisely the orphans we care about, and would otherwise be missing).
  for (const g of guides.docs as any[]) counts.set(`guide:${String(g.slug).toLowerCase()}`, 0)
  for (const n of news.docs as any[]) counts.set(`news:${String(n.slug).toLowerCase()}`, 0)

  const bump = (body: any) => {
    // Count each distinct target once per source page: two links from the same
    // article to the same target is one referring page, not two.
    const seen = new Set<string>()
    for (const url of listInternalLinkUrls(body)) {
      const key = urlToTargetKey(url)
      if (!key || seen.has(key)) continue
      seen.add(key)
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  for (const g of guides.docs as any[]) bump(g.body)
  for (const n of news.docs as any[]) bump(n.body)

  return counts
}

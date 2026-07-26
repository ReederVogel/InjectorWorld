/**
 * Shared discovery-agent logic, used by both the admin-facing scan API route
 * (app/api/admin/internal-links/scan/route.ts) and the standalone CLI script
 * (scripts/discover-internal-links.ts). Finds NEW internal-link opportunities
 * beyond the editorial-seeded ones: candidate shortlist via keyword/mention
 * overlap (no embeddings needed), Kimi K3 picks anchor text verbatim from the
 * article's own paragraphs, strictly choosing targets from the shortlist.
 */
import type { Payload } from 'payload'
import { callOpenRouter, extractJson } from './openrouter'
import { listParagraphTexts } from './insert-link'

const SITE_URL = 'https://www.injector.world'
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'what', 'does', 'how', 'you', 'your', 'are', 'was', 'when',
  'this', 'that', 'from', 'have', 'not', 'but', 'all', 'can', 'get', 'who',
])

export type Candidate = { type: 'guide' | 'news' | 'brand' | 'service'; slug: string; title: string; excerpt?: string }
type SourceDoc = { id: number; type: 'guides' | 'news'; slug: string; title: string; body: any }

function significantWords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
}

export async function loadCandidates(payload: Payload): Promise<Candidate[]> {
  const [guides, news, brands, services] = await Promise.all([
    payload.find({ collection: 'guides', where: { reviewStatus: { equals: 'approved' } }, limit: 500, depth: 0 }),
    payload.find({ collection: 'news', where: { reviewStatus: { equals: 'approved' } }, limit: 500, depth: 0 }),
    payload.find({ collection: 'brands', limit: 200, depth: 0 }),
    payload.find({ collection: 'services', limit: 200, depth: 0 }),
  ])
  const list: Candidate[] = []
  for (const g of guides.docs as any[]) list.push({ type: 'guide', slug: g.slug, title: g.title, excerpt: g.excerpt })
  for (const n of news.docs as any[]) list.push({ type: 'news', slug: n.slug, title: n.title, excerpt: n.excerpt })
  for (const b of brands.docs as any[]) list.push({ type: 'brand', slug: b.slug, title: b.name, excerpt: b.tagline || b.shortDescription })
  for (const s of services.docs as any[]) list.push({ type: 'service', slug: s.slug, title: s.name, excerpt: s.tagline || s.shortDescription })
  return list
}

function shortlistFor(doc: SourceDoc, paragraphs: string[], candidates: Candidate[], exclude: Set<string>): Candidate[] {
  const bodyText = paragraphs.join(' ').toLowerCase()
  const docWords = significantWords(doc.title)
  const scored: { c: Candidate; score: number }[] = []

  for (const c of candidates) {
    if (c.slug === doc.slug) continue
    if (exclude.has(`${c.type}:${c.slug}`)) continue

    let score = 0
    const coreTitle = c.title.toLowerCase().replace(/\s*\(.*?\)\s*$/, '').trim()
    if (coreTitle.length > 3 && bodyText.includes(coreTitle)) score += 5
    score += significantWords(c.title).filter((w) => docWords.includes(w)).length

    if (score > 0) scored.push({ c, score })
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, 10).map((s) => s.c)
}

/** Every target already suggested (any status, any origin) for each source doc. */
export async function loadAlreadySuggested(payload: Payload): Promise<Map<string, Set<string>>> {
  const res = await payload.find({ collection: 'internal-link-suggestions', limit: 2000, depth: 0 })
  const map = new Map<string, Set<string>>()
  for (const doc of res.docs as any[]) {
    const src = doc.source
    if (!src || typeof src !== 'object') continue
    const srcId = typeof src.value === 'object' ? src.value.id : src.value
    const key = `${src.relationTo}:${srcId}`
    if (!map.has(key)) map.set(key, new Set())
    map.get(key)!.add(`${doc.targetType}:${doc.targetSlug}`)
  }
  return map
}

function targetPath(type: Candidate['type'], slug: string): string {
  const dirMap: Record<Candidate['type'], string> = { guide: 'guides', news: 'news', brand: 'brands', service: 'services' }
  return `/${dirMap[type]}/${slug}`
}

async function processDoc(
  payload: Payload,
  collectionSlug: 'guides' | 'news',
  doc: any,
  candidates: Candidate[],
  alreadySuggested: Map<string, Set<string>>,
): Promise<{ created: number }> {
  const paragraphs = listParagraphTexts(doc.body)
  if (paragraphs.length === 0) return { created: 0 }

  const exclude = alreadySuggested.get(`${collectionSlug}:${doc.id}`) ?? new Set<string>()
  const source: SourceDoc = { id: doc.id, type: collectionSlug, slug: doc.slug, title: doc.title, body: doc.body }
  const shortlist = shortlistFor(source, paragraphs, candidates, exclude)
  if (shortlist.length === 0) return { created: 0 }

  const messages = [
    {
      role: 'system' as const,
      content:
        'You find good internal-linking opportunities in an article. You are given numbered paragraphs and a shortlist of candidate pages (title, type). Propose 2 to 4 links, STRICTLY choosing targets only from the given shortlist -- never invent a page. For each, pick a SHORT EXACT substring (3-8 words) that appears VERBATIM in one of the paragraphs to serve as the anchor text, copied exactly including punctuation and case. Only propose a link if it is genuinely useful to a reader (relevant, not forced). Reply with strict JSON only, no prose, no markdown fences: {"links": [{"candidateTitle": "must exactly match one shortlist title", "anchorText": "exact substring", "reasoning": "one short sentence"}]}',
    },
    {
      role: 'user' as const,
      content: JSON.stringify({
        articleTitle: doc.title,
        paragraphs: paragraphs.map((p, i) => `[${i}] ${p}`),
        candidateShortlist: shortlist.map((c) => ({ title: c.title, type: c.type })),
      }),
    },
  ]

  let links: { candidateTitle: string; anchorText: string; reasoning: string }[]
  try {
    const raw = await callOpenRouter(messages, { jsonMode: true, temperature: 0.2 })
    const parsed = extractJson<{ links: typeof links }>(raw)
    links = parsed.links ?? []
  } catch {
    return { created: 0 }
  }

  let created = 0
  for (const link of links) {
    const candidate = shortlist.find((c) => c.title === link.candidateTitle)
    if (!candidate) continue
    const existsVerbatim = paragraphs.some((p) => p.includes(link.anchorText))
    if (!existsVerbatim) continue

    await payload.create({
      collection: 'internal-link-suggestions',
      data: {
        source: { relationTo: collectionSlug, value: doc.id },
        anchorText: link.anchorText,
        targetType: candidate.type,
        targetSlug: candidate.slug,
        targetUrl: `${SITE_URL}${targetPath(candidate.type, candidate.slug)}`,
        targetTitle: candidate.title,
        targetExcerpt: candidate.excerpt,
        reasoning: link.reasoning,
        origin: 'ai-discovery',
        status: 'pending',
      } as any,
      overrideAccess: true,
    })
    created++
  }
  return { created }
}

export type DiscoveryBatchResult = { scanned: number; created: number; remaining: number }

/**
 * Scans up to `limit` not-yet-scanned guides/news (linkDiscoveryScannedAt is
 * null), marking each as scanned when done regardless of outcome so repeat
 * calls make forward progress and never reprocess the same page for free.
 * Designed to be called repeatedly (e.g. from an admin "Scan" button) until
 * `remaining` hits 0.
 */
export async function runDiscoveryBatch(payload: Payload, limit = 10): Promise<DiscoveryBatchResult> {
  const candidates = await loadCandidates(payload)
  const alreadySuggested = await loadAlreadySuggested(payload)

  const [guidesRes, newsRes] = await Promise.all([
    payload.find({
      collection: 'guides',
      where: { and: [{ reviewStatus: { equals: 'approved' } }, { linkDiscoveryScannedAt: { exists: false } }] },
      limit,
      depth: 0,
    }),
    payload.find({
      collection: 'news',
      where: { and: [{ reviewStatus: { equals: 'approved' } }, { linkDiscoveryScannedAt: { exists: false } }] },
      limit,
      depth: 0,
    }),
  ])

  const batch: { collectionSlug: 'guides' | 'news'; doc: any }[] = [
    ...(guidesRes.docs as any[]).map((doc) => ({ collectionSlug: 'guides' as const, doc })),
    ...(newsRes.docs as any[]).map((doc) => ({ collectionSlug: 'news' as const, doc })),
  ].slice(0, limit)

  let created = 0
  for (const { collectionSlug, doc } of batch) {
    const result = await processDoc(payload, collectionSlug, doc, candidates, alreadySuggested)
    created += result.created
    await payload.update({
      collection: collectionSlug,
      id: doc.id,
      data: { linkDiscoveryScannedAt: new Date().toISOString() } as any,
      overrideAccess: true,
    })
  }

  const [remainingGuides, remainingNews] = await Promise.all([
    payload.count({
      collection: 'guides',
      where: { and: [{ reviewStatus: { equals: 'approved' } }, { linkDiscoveryScannedAt: { exists: false } }] },
    }),
    payload.count({
      collection: 'news',
      where: { and: [{ reviewStatus: { equals: 'approved' } }, { linkDiscoveryScannedAt: { exists: false } }] },
    }),
  ])

  return { scanned: batch.length, created, remaining: remainingGuides.totalDocs + remainingNews.totalDocs }
}

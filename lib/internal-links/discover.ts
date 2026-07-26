/**
 * Shared discovery-agent logic, used by both the admin-facing scan API route
 * (app/api/admin/internal-links/scan/route.ts) and the standalone CLI script
 * (scripts/discover-internal-links.ts). Finds NEW internal-link opportunities
 * beyond the editorial-seeded ones, across every direction (guide->guide,
 * guide->news, news->guide, and ->brand/->service): candidate shortlist via
 * keyword/mention overlap (no embeddings needed), then the model picks anchor
 * text verbatim from the article's own paragraphs, strictly choosing targets
 * from the shortlist.
 */
import type { Payload } from 'payload'
import { callOpenRouter, extractJson, estimateCostUsd, type TokenUsage } from './openrouter'
import { listParagraphTexts } from './insert-link'
import { countIncomingLinks } from './link-stats'

const SITE_URL = 'https://www.injector.world'
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'what', 'does', 'how', 'you', 'your', 'are', 'was', 'when',
  'this', 'that', 'from', 'have', 'not', 'but', 'all', 'can', 'get', 'who',
])

// SEO guidance is 2-5 contextual links per 1000 words. Cap what we'll even
// consider suggesting for one page so editorial-seeded + AI-discovered links
// can't stack into an over-linked page.
const MAX_LINKS_PER_PAGE = 8

export type Candidate = { type: 'guide' | 'news' | 'brand' | 'service'; slug: string; title: string; excerpt?: string }
type SourceDoc = { id: number; slug: string; title: string }

function significantWords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
}

export async function loadCandidates(payload: Payload): Promise<Candidate[]> {
  const [guides, news, brands, services] = await Promise.all([
    payload.find({ collection: 'guides', where: { reviewStatus: { equals: 'approved' } }, limit: 1000, depth: 0 }),
    payload.find({ collection: 'news', where: { reviewStatus: { equals: 'approved' } }, limit: 1000, depth: 0 }),
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

/**
 * Scores candidates against this article and returns both the shortlist AND
 * only the paragraphs that plausibly relate to one of them. Sending just those
 * paragraphs instead of the whole article is the single biggest token saving
 * here -- long guides run 2500+ words, and most of that text can't host any of
 * these links anyway.
 */
function buildPromptInputs(
  doc: SourceDoc,
  paragraphs: string[],
  candidates: Candidate[],
  exclude: Set<string>,
): { shortlist: Candidate[]; relevantParagraphs: string[] } {
  const docWords = significantWords(doc.title)
  const lowered = paragraphs.map((p) => p.toLowerCase())
  const scored: { c: Candidate; score: number; hitParagraphs: Set<number> }[] = []

  for (const c of candidates) {
    if (c.slug === doc.slug) continue
    if (exclude.has(`${c.type}:${c.slug}`)) continue

    const coreTitle = c.title.toLowerCase().replace(/\s*\(.*?\)\s*$/, '').trim()
    const candWords = significantWords(c.title)
    const hitParagraphs = new Set<number>()
    let score = significantWords(c.title).filter((w) => docWords.includes(w)).length

    lowered.forEach((p, i) => {
      if (coreTitle.length > 3 && p.includes(coreTitle)) {
        score += 5
        hitParagraphs.add(i)
      } else if (candWords.some((w) => p.includes(w))) {
        hitParagraphs.add(i)
      }
    })

    if (score > 0) scored.push({ c, score, hitParagraphs })
  }

  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, 10)

  const keep = new Set<number>()
  for (const s of top) for (const i of s.hitParagraphs) keep.add(i)
  // Fall back to the whole article only if nothing matched, so we never send
  // an empty paragraph list and get a useless response.
  const relevantParagraphs =
    keep.size > 0 ? [...keep].sort((a, b) => a - b).map((i) => paragraphs[i]) : paragraphs

  return { shortlist: top.map((s) => s.c), relevantParagraphs }
}

/** Targets already suggested for THIS doc (any status, any origin) -- per-doc query, so it never hits a global row cap. */
async function loadAlreadySuggestedFor(
  payload: Payload,
  collectionSlug: 'guides' | 'news',
  docId: number,
): Promise<{ exclude: Set<string>; count: number }> {
  const res = await payload.find({
    collection: 'internal-link-suggestions',
    where: { 'source.value': { equals: docId }, 'source.relationTo': { equals: collectionSlug } } as any,
    limit: 200,
    depth: 0,
  })
  const exclude = new Set<string>()
  for (const doc of res.docs as any[]) exclude.add(`${doc.targetType}:${doc.targetSlug}`)
  return { exclude, count: res.totalDocs }
}

function targetPath(type: Candidate['type'], slug: string): string {
  const dirMap: Record<Candidate['type'], string> = { guide: 'guides', news: 'news', brand: 'brands', service: 'services' }
  return `/${dirMap[type]}/${slug}`
}

type DocResult = { created: number; usage: TokenUsage; failed: boolean }

async function processDoc(
  payload: Payload,
  collectionSlug: 'guides' | 'news',
  doc: any,
  candidates: Candidate[],
): Promise<DocResult> {
  const empty: TokenUsage = { promptTokens: 0, completionTokens: 0 }
  const paragraphs = listParagraphTexts(doc.body)
  if (paragraphs.length === 0) return { created: 0, usage: empty, failed: false }

  const { exclude, count: existingCount } = await loadAlreadySuggestedFor(payload, collectionSlug, doc.id)
  const alreadyLinked = Array.isArray(doc.internalLinks) ? doc.internalLinks.length : 0
  const budget = MAX_LINKS_PER_PAGE - Math.max(existingCount, alreadyLinked)
  if (budget <= 0) return { created: 0, usage: empty, failed: false }

  const source: SourceDoc = { id: doc.id, slug: doc.slug, title: doc.title }
  const { shortlist, relevantParagraphs } = buildPromptInputs(source, paragraphs, candidates, exclude)
  if (shortlist.length === 0) return { created: 0, usage: empty, failed: false }

  const maxAsk = Math.min(4, budget)
  const messages = [
    {
      role: 'system' as const,
      content:
        `You find good internal-linking opportunities in an article. You are given paragraphs from the article and a shortlist of candidate pages (title, type). Propose up to ${maxAsk} links, STRICTLY choosing targets only from the given shortlist -- never invent a page. For each, pick a SHORT EXACT substring (3-8 words) that appears VERBATIM in one of the paragraphs to serve as the anchor text, copied exactly including punctuation and case. Prefer descriptive anchor text that reflects the target topic; avoid vague text like "click here". Only propose a link if it is genuinely useful to a reader (relevant, not forced) -- returning fewer links, or none, is correct when nothing fits. Reply with strict JSON only, no prose, no markdown fences: {"links": [{"candidateTitle": "must exactly match one shortlist title", "anchorText": "exact substring", "reasoning": "one short sentence"}]}`,
    },
    {
      role: 'user' as const,
      content: JSON.stringify({
        articleTitle: doc.title,
        paragraphs: relevantParagraphs,
        candidateShortlist: shortlist.map((c) => ({ title: c.title, type: c.type })),
      }),
    },
  ]

  let links: { candidateTitle: string; anchorText: string; reasoning: string }[]
  let usage: TokenUsage
  try {
    const res = await callOpenRouter(messages, { jsonMode: true, temperature: 0.2 })
    usage = res.usage
    const parsed = extractJson<{ links: typeof links }>(res.content)
    links = parsed.links ?? []
  } catch (err: any) {
    // Genuine failure (network, rate limit, malformed JSON). Reported as failed
    // so the caller leaves this doc unscanned and it gets retried, instead of
    // being silently marked done and never looked at again.
    payload.logger.warn(`[internal-links] ${collectionSlug}/${doc.slug} failed: ${err?.message ?? err}`)
    return { created: 0, usage: empty, failed: true }
  }

  let created = 0
  for (const link of links.slice(0, budget)) {
    const candidate = shortlist.find((c) => c.title === link.candidateTitle)
    if (!candidate) continue
    if (!relevantParagraphs.some((p) => p.includes(link.anchorText))) continue

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
  return { created, usage, failed: false }
}

export type DiscoveryBatchResult = {
  scanned: number
  created: number
  failed: number
  remaining: number
  total: number
  promptTokens: number
  completionTokens: number
  costUsd: number
}

/**
 * Scans up to `limit` not-yet-scanned guides/news, ORPHANS FIRST (fewest
 * incoming internal links), so the money goes to the pages that most need
 * links rather than whatever the database returned first. Each doc is marked
 * scanned only when its call actually succeeded, so failures are retried on
 * the next run. Bounded and resumable by design -- call repeatedly until
 * `remaining` hits 0.
 */
export async function runDiscoveryBatch(
  payload: Payload,
  limit = 2,
  cachedCandidates?: Candidate[],
): Promise<DiscoveryBatchResult> {
  const candidates = cachedCandidates ?? (await loadCandidates(payload))

  const unscannedWhere = {
    and: [{ reviewStatus: { equals: 'approved' } }, { linkDiscoveryScannedAt: { exists: false } }],
  }

  // Pull a window of unscanned candidates, then order that window by how few
  // incoming links each has. A full-corpus sort would mean reading every body
  // on every call, which is far more expensive than it's worth.
  const WINDOW = Math.max(limit * 10, 40)
  const [guidesRes, newsRes, incoming] = await Promise.all([
    payload.find({ collection: 'guides', where: unscannedWhere as any, limit: WINDOW, depth: 0 }),
    payload.find({ collection: 'news', where: unscannedWhere as any, limit: WINDOW, depth: 0 }),
    countIncomingLinks(payload),
  ])

  const window: { collectionSlug: 'guides' | 'news'; doc: any }[] = [
    ...(guidesRes.docs as any[]).map((doc) => ({ collectionSlug: 'guides' as const, doc })),
    ...(newsRes.docs as any[]).map((doc) => ({ collectionSlug: 'news' as const, doc })),
  ]
  window.sort((a, b) => {
    const ai = incoming.get(`${a.collectionSlug === 'guides' ? 'guide' : 'news'}:${a.doc.slug}`) ?? 0
    const bi = incoming.get(`${b.collectionSlug === 'guides' ? 'guide' : 'news'}:${b.doc.slug}`) ?? 0
    return ai - bi
  })
  const batch = window.slice(0, limit)

  let created = 0
  let failed = 0
  let promptTokens = 0
  let completionTokens = 0

  for (const { collectionSlug, doc } of batch) {
    const result = await processDoc(payload, collectionSlug, doc, candidates)
    created += result.created
    promptTokens += result.usage.promptTokens
    completionTokens += result.usage.completionTokens

    if (result.failed) {
      failed++
      continue
    }
    await payload.update({
      collection: collectionSlug,
      id: doc.id,
      data: { linkDiscoveryScannedAt: new Date().toISOString() } as any,
      overrideAccess: true,
    })
  }

  const [remainingGuides, remainingNews, totalGuides, totalNews] = await Promise.all([
    payload.count({ collection: 'guides', where: unscannedWhere as any }),
    payload.count({ collection: 'news', where: unscannedWhere as any }),
    payload.count({ collection: 'guides', where: { reviewStatus: { equals: 'approved' } } }),
    payload.count({ collection: 'news', where: { reviewStatus: { equals: 'approved' } } }),
  ])

  return {
    scanned: batch.length - failed,
    created,
    failed,
    remaining: remainingGuides.totalDocs + remainingNews.totalDocs,
    total: totalGuides.totalDocs + totalNews.totalDocs,
    promptTokens,
    completionTokens,
    costUsd: estimateCostUsd({ promptTokens, completionTokens }),
  }
}

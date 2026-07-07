/**
 * Knowledge retrieval for the assistant (the RAG half).
 *
 * Pulls matching Guides and News and returns their curated, plain-text
 * structured fields (answerSnippet, atAGlance, faq) so the model can answer
 * treatment questions grounded in our own reviewed content — not from its
 * training data. Read-only. Small, curated collections, so token-OR matching on
 * the title is cheap and high-recall (mirrors lib/search-content.ts).
 */
import { getPayloadInstance } from '../payload-server'

export type KnowledgeDoc = {
  kind: 'guide' | 'news'
  title: string
  href: string
  answerSnippet?: string
  atAGlance?: string[]
  faq?: { question: string; answer: string }[]
  excerpt?: string
}

function asStringArray(v: any): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out = v.map((x) => (typeof x === 'string' ? x : x?.text ?? x?.point ?? '')).filter(Boolean)
  return out.length ? out : undefined
}

function asFaq(v: any): { question: string; answer: string }[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out = v
    .map((x) => ({ question: String(x?.question ?? ''), answer: String(x?.answer ?? '') }))
    .filter((x) => x.question && x.answer)
  return out.length ? out : undefined
}

export async function searchKnowledge(query: string, max = 3): Promise<KnowledgeDoc[]> {
  const term = (query ?? '').trim()
  if (term.length < 2) return []

  const tokens = term.toLowerCase().split(/[\s,]+/).filter((t) => t.length >= 3)
  const orFor = (field: string) =>
    tokens.length ? { or: tokens.map((t) => ({ [field]: { like: t } })) } : { [field]: { like: term } }

  const payload = await getPayloadInstance()

  const [guides, news] = await Promise.all([
    payload
      .find({
        collection: 'guides',
        where: { and: [{ reviewStatus: { equals: 'approved' } }, orFor('title')] },
        limit: max,
        depth: 0,
      })
      .catch(() => ({ docs: [] as any[] })),
    payload
      .find({
        collection: 'news',
        where: { and: [{ reviewStatus: { equals: 'approved' } }, orFor('title')] },
        limit: 2,
        depth: 0,
      })
      .catch(() => ({ docs: [] as any[] })),
  ])

  const docs: KnowledgeDoc[] = []
  for (const g of guides.docs as any[]) {
    docs.push({
      kind: 'guide',
      title: g.title,
      href: `/guides/${g.slug}`,
      answerSnippet: g.answerSnippet ?? undefined,
      atAGlance: asStringArray(g.atAGlance),
      faq: asFaq(g.faq),
      excerpt: g.excerpt ?? g.lede ?? undefined,
    })
  }
  for (const n of news.docs as any[]) {
    docs.push({
      kind: 'news',
      title: n.title,
      href: `/news/${n.slug}`,
      answerSnippet: n.answerSnippet ?? undefined,
      excerpt: n.excerpt ?? undefined,
    })
  }
  return docs
}

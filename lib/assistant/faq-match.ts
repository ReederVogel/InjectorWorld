import { getPayloadInstance } from '../payload-server'

/**
 * Deliberately strict, cheap FAQ matching for the first turn of a fresh
 * conversation only -- lets the route skip the paid Anthropic call entirely
 * for a handful of common homepage questions. Stricter than the loose
 * any-token `like` matching in lib/assistant/knowledge.ts on purpose: a
 * confident-but-wrong canned answer is worse than just falling through to
 * Claude, so this rarely fires by design.
 */

export type FaqMatch = {
  answer: string
  relatedGuide: { title: string; slug: string } | null
}

// Containment (recall relative to the FAQ's own question), not symmetric
// Jaccard -- a short question like "Is Botox safe?" (2 significant words)
// should still confidently match a longer, differently-worded message that
// contains both words, even though a longer message dilutes a symmetric
// score. The message-length cap below is what keeps this strict: a rambling
// message that only incidentally contains the question's words won't match.
const MIN_CONTAINMENT = 0.9
const MIN_QUESTION_TOKENS = 2
const MAX_MESSAGE_LENGTH_MULTIPLE = 4

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3),
  )
}

function containment(message: Set<string>, question: Set<string>): number {
  if (question.size === 0) return 0
  let overlap = 0
  for (const t of question) if (message.has(t)) overlap++
  return overlap / question.size
}

export async function matchHomepageFaq(message: string): Promise<FaqMatch | null> {
  const msgTokens = tokenize(message)
  if (msgTokens.size === 0) return null

  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'faqs',
    where: { scope: { equals: 'homepage' } },
    limit: 100,
    depth: 1,
  })

  let best: { faq: any; score: number } | null = null
  for (const faq of res.docs as any[]) {
    if (typeof faq.question !== 'string' || typeof faq.answer !== 'string') continue
    const qTokens = tokenize(faq.question)
    if (qTokens.size < MIN_QUESTION_TOKENS) continue
    if (msgTokens.size > qTokens.size * MAX_MESSAGE_LENGTH_MULTIPLE) continue
    const score = containment(msgTokens, qTokens)
    if (score >= MIN_CONTAINMENT && (!best || score > best.score)) {
      best = { faq, score }
    }
  }

  if (!best) return null

  const rg = best.faq.relatedGuide
  return {
    answer: best.faq.answer,
    relatedGuide: rg && typeof rg === 'object' && rg.slug ? { title: rg.title, slug: rg.slug } : null,
  }
}

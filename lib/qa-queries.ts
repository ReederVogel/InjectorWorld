import { getPayloadInstance } from './payload-server'

export type QAItem = {
  id: string
  slug: string
  questionTitle: string
  questionText?: string
  answerText: string
  answeredByName?: string
  serviceTag?: string
  cityTag?: string
  date?: string
}

export async function getAnsweredQAs(opts: {
  serviceTag?: string
  cityTag?: string
  limit?: number
}): Promise<QAItem[]> {
  const payload = await getPayloadInstance()
  const where: any = { status: { equals: 'answered' } }
  if (opts.serviceTag) where.serviceTag = { like: opts.serviceTag }
  if (opts.cityTag) where.cityTag = { like: opts.cityTag }

  const res = await payload.find({
    collection: 'qa',
    where,
    limit: opts.limit ?? 20,
    sort: '-date',
    depth: 1,
  })

  return res.docs.map(mapQA)
}

export async function getQABySlug(slug: string): Promise<QAItem | null> {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'qa',
    where: {
      and: [
        { slug: { equals: slug } },
        { status: { equals: 'answered' } },
      ],
    },
    limit: 1,
    depth: 1,
  })
  const doc = res.docs[0]
  return doc ? mapQA(doc) : null
}

export async function getAllAnsweredQASlugs(): Promise<string[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'qa',
    where: { status: { equals: 'answered' } },
    limit: 1000,
    depth: 0,
  })
  return res.docs.map((d: any) => d.slug as string).filter(Boolean)
}

/**
 * Questions relevant to a piece of editorial, matched on the article's own title.
 *
 * Guides and news carry no relationship to a service: all 100 guides have
 * `relatedService` NULL, so the obvious join does not exist. What does work is
 * the title, because a question's `serviceTag` is always a service or brand NAME
 * ("Lip Filler", "Sculptra", "Masseter Botox") and editorial titles name their
 * subject. Verified on 2026-09-03: 80 of 100 guide titles contain at least one
 * live tag.
 *
 * `position(... in ...)` rather than LIKE on purpose: the tag is DATA being used
 * as the needle, and under LIKE a tag containing % or _ would silently behave as
 * a wildcard and match every article.
 *
 * Longest tag first, so the most specific match wins: a "Masseter Botox" guide
 * leads with masseter questions rather than generic Botox ones, and "Botox for
 * Migraines" does not open with cosmetic answers.
 *
 * Returns [] on any failure. This is a supplementary block at the foot of an
 * article, never a reason to fail the page.
 */
export async function getRelatedQAsForTitle(title: string, limit = 3): Promise<QAItem[]> {
  const t = (title ?? '').trim()
  if (!t) return []

  try {
    const payload = await getPayloadInstance()
    const pool = (payload.db as any).pool
    const { rows } = await pool.query(
      `SELECT id, slug, question_title, question_text, answer_text,
              answered_by_name, service_tag, city_tag, date
         FROM qa
        WHERE status = 'answered'
          AND slug IS NOT NULL AND slug <> ''
          AND service_tag IS NOT NULL AND service_tag <> ''
          AND position(lower(service_tag) in lower($1)) > 0
        ORDER BY length(service_tag) DESC, date DESC NULLS LAST, id DESC
        LIMIT $2`,
      [t, limit],
    )

    return (rows as any[]).map((r) => ({
      id: String(r.id),
      slug: r.slug ?? '',
      questionTitle: r.question_title,
      questionText: r.question_text ?? undefined,
      answerText: r.answer_text ?? '',
      answeredByName: r.answered_by_name ?? undefined,
      serviceTag: r.service_tag ?? undefined,
      cityTag: r.city_tag ?? undefined,
      date: r.date ?? undefined,
    }))
  } catch {
    return []
  }
}

function mapQA(doc: any): QAItem {
  return {
    id: String(doc.id),
    slug: doc.slug ?? '',
    questionTitle: doc.questionTitle,
    questionText: doc.questionText ?? undefined,
    answerText: doc.answerText ?? '',
    answeredByName: doc.answeredByName ?? undefined,
    serviceTag: doc.serviceTag ?? undefined,
    cityTag: doc.cityTag ?? undefined,
    date: doc.date ?? undefined,
  }
}

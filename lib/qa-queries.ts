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

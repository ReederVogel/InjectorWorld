import { getPayloadInstance } from './payload-server'

export type WorthItResult = {
  score: number
  sampleSize: number
  hasData: boolean
}

const MIN_SAMPLE = 5

export async function getWorthItScore(treatmentName: string): Promise<WorthItResult> {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'reviews',
    where: {
      and: [
        { treatmentTag: { like: treatmentName } },
        { moderationStatus: { equals: 'approved' } },
      ],
    } as any,
    limit: 500,
    depth: 0,
  })
  const docs = res.docs as Array<{ rating: number }>
  const sampleSize = docs.length
  if (sampleSize < MIN_SAMPLE) {
    return { score: 0, sampleSize, hasData: false }
  }
  const positive = docs.filter((r) => r.rating >= 4).length
  const score = Math.round((positive / sampleSize) * 100)
  return { score, sampleSize, hasData: true }
}

export async function getWorthItScores(
  treatmentNames: string[],
): Promise<Map<string, WorthItResult>> {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'reviews',
    where: {
      and: [
        { or: treatmentNames.map((name) => ({ treatmentTag: { like: name } })) },
        { moderationStatus: { equals: 'approved' } },
      ],
    } as any,
    limit: 2000,
    depth: 0,
  })
  const docs = res.docs as Array<{ rating: number; treatmentTag?: string }>

  const byTreatment = new Map<string, Array<{ rating: number }>>()
  for (const name of treatmentNames) {
    byTreatment.set(name.toLowerCase(), [])
  }
  for (const doc of docs) {
    const tag = (doc.treatmentTag ?? '').toLowerCase()
    for (const name of treatmentNames) {
      if (tag.includes(name.toLowerCase()) || name.toLowerCase().includes(tag)) {
        byTreatment.get(name.toLowerCase())!.push(doc)
        break
      }
    }
  }

  const results = new Map<string, WorthItResult>()
  for (const name of treatmentNames) {
    const reviews = byTreatment.get(name.toLowerCase()) ?? []
    const sampleSize = reviews.length
    if (sampleSize < MIN_SAMPLE) {
      results.set(name, { score: 0, sampleSize, hasData: false })
    } else {
      const positive = reviews.filter((r) => r.rating >= 4).length
      const score = Math.round((positive / sampleSize) * 100)
      results.set(name, { score, sampleSize, hasData: true })
    }
  }
  return results
}

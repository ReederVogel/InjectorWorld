import type { Payload } from 'payload'

// Self-contained FAQ bulk-upload logic. Deliberately does not share code with
// lib/import/admin-bulk-upload.ts (the CSV pipeline for clinics/reviews/news/guides) --
// FAQs are simple flat objects, small batches, and JSON-sourced (not CSV), so this
// uses the Payload local API directly instead of a raw-SQL pool.

export type FaqUploadItem = {
  id: number
  stableId: string
  question: string
  status: 'created' | 'updated'
}

export type FaqUploadError = { index: number; stableId?: string; reason: string }

export type FaqUploadReport = {
  batch: string
  total: number
  created: number
  updated: number
  failed: number
  errors: FaqUploadError[]
  items: FaqUploadItem[]
}

const ALLOWED_SCOPES = new Set(['homepage', 'service', 'city', 'clinic', 'guide'])

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function makeFaqBatch(): string {
  return `faqs-upload-${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}`
}

export async function stageFaqUpload(
  payload: Payload,
  input: unknown,
  opts: { batch?: string } = {},
): Promise<FaqUploadReport> {
  const batch = opts.batch?.trim() || makeFaqBatch()
  const list = Array.isArray(input) ? input : (input as any)?.faqs
  if (!Array.isArray(list)) {
    throw new Error('Expected a JSON array of FAQs (or an object with a "faqs" array).')
  }

  const report: FaqUploadReport = {
    batch,
    total: list.length,
    created: 0,
    updated: 0,
    failed: 0,
    errors: [],
    items: [],
  }

  for (let i = 0; i < list.length; i++) {
    const raw = list[i]
    const rawStableId = raw && typeof raw === 'object' ? (raw as any).stableId : undefined
    try {
      if (!raw || typeof raw !== 'object') throw new Error('Row is not an object.')

      const question = String((raw as any).question ?? '').trim()
      const answer = String((raw as any).answer ?? '').trim()
      const scope = String((raw as any).scope ?? '').trim()
      if (!question) throw new Error('Missing question.')
      if (!answer) throw new Error('Missing answer.')
      if (!ALLOWED_SCOPES.has(scope)) {
        throw new Error(`scope must be one of: ${[...ALLOWED_SCOPES].join(', ')}.`)
      }

      const serviceTag = (raw as any).serviceTag ? String((raw as any).serviceTag).trim() : ''
      const cityTag = (raw as any).cityTag ? String((raw as any).cityTag).trim() : ''
      const relatedGuideSlug = (raw as any).relatedGuideSlug ? String((raw as any).relatedGuideSlug).trim() : ''
      const sortRankNum = Number((raw as any).sortRank)
      const sortRank = Number.isFinite(sortRankNum) ? sortRankNum : 999
      const stableId = String(rawStableId ?? '').trim() || slugify(question)
      if (!stableId) throw new Error('Could not derive a stableId from the question.')

      let relatedGuide: number | undefined
      if (relatedGuideSlug) {
        const guideRes = await payload.find({
          collection: 'guides',
          where: { slug: { equals: relatedGuideSlug } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        const g = guideRes.docs[0] as any
        if (!g) throw new Error(`relatedGuideSlug "${relatedGuideSlug}" not found.`)
        relatedGuide = Number(g.id)
      }

      const existing = await payload.find({
        collection: 'faqs',
        where: { stableId: { equals: stableId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const match = existing.docs[0] as any

      const data: Record<string, any> = {
        question,
        answer,
        scope,
        serviceTag: serviceTag || undefined,
        cityTag: cityTag || undefined,
        relatedGuide,
        sortRank,
        stableId,
        importBatch: batch,
        reviewStatus: 'imported',
      }

      if (match) {
        const updated: any = await payload.update({ collection: 'faqs', id: match.id, data, overrideAccess: true } as any)
        report.updated++
        report.items.push({ id: Number(updated.id), stableId, question, status: 'updated' })
      } else {
        const created: any = await payload.create({ collection: 'faqs', data, overrideAccess: true } as any)
        report.created++
        report.items.push({ id: Number(created.id), stableId, question, status: 'created' })
      }
    } catch (err: any) {
      report.failed++
      report.errors.push({
        index: i,
        stableId: typeof rawStableId === 'string' ? rawStableId : undefined,
        reason: err?.message ?? 'Unknown error.',
      })
    }
  }

  return report
}

export async function approveFaqUpload(
  payload: Payload,
  opts: { batch?: string; ids?: number[] },
): Promise<{ approved: number }> {
  const { batch, ids } = opts
  if (!batch && (!ids || ids.length === 0)) {
    throw new Error('Provide batch or ids.')
  }

  if (ids && ids.length > 0) {
    let approved = 0
    for (const id of ids) {
      await payload.update({ collection: 'faqs', id, data: { reviewStatus: 'approved' }, overrideAccess: true })
      approved++
    }
    return { approved }
  }

  const res: any = await payload.update({
    collection: 'faqs',
    where: { and: [{ importBatch: { equals: batch } }, { reviewStatus: { equals: 'imported' } }] },
    data: { reviewStatus: 'approved' },
    overrideAccess: true,
  })
  return { approved: Array.isArray(res?.docs) ? res.docs.length : 0 }
}

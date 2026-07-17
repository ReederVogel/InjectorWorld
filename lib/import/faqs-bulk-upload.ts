import type { Payload } from 'payload'

// Self-contained FAQ bulk-upload logic. Deliberately does not share code with
// lib/import/admin-bulk-upload.ts (the CSV pipeline for clinics/reviews/news/guides) --
// FAQs are simple flat objects, small batches, and JSON-sourced (not CSV), so this
// uses the Payload local API directly instead of a raw-SQL pool.
//
// Targeting is by real relationships (service/brand/location/clinicType), not the
// free-text serviceTag/cityTag fields this replaced -- those overloaded one column to
// mean a service name, a brand name, a city, a state, or a clinic type depending on
// which page queried it, which stopped mapping onto the Find/Services/Brand paths.

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

const ALLOWED_SCOPES = new Set(['homepage', 'service', 'brand', 'location', 'clinic-type'])
const ALLOWED_CLINIC_TYPES = new Set(['plastic-surgery', 'dermatology', 'dental-aesthetics', 'medspa', 'other'])
const ALLOWED_SAFETY_FLAGS = new Set(['none', 'serious-risk', 'non-fda-approved'])
const MAX_ROWS = 5000

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

async function resolveBySlug(payload: Payload, collection: 'services' | 'brands' | 'locations' | 'guides', slug: string): Promise<number | null> {
  const res: any = await payload.find({ collection, where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true })
  const doc = res.docs[0]
  return doc ? Number(doc.id) : null
}

export async function stageFaqUpload(
  payload: Payload,
  input: unknown,
  opts: { batch?: string; onProgress?: (done: number, total: number) => void } = {},
): Promise<FaqUploadReport> {
  const batch = opts.batch?.trim() || makeFaqBatch()
  const list = Array.isArray(input) ? input : (input as any)?.faqs
  if (!Array.isArray(list)) {
    throw new Error('Expected a JSON array of FAQs (or an object with a "faqs" array).')
  }
  if (list.length > MAX_ROWS) {
    throw new Error(`Too many rows (${list.length}). The limit is ${MAX_ROWS} FAQs per file.`)
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
      const answerDetail = (raw as any).answerDetail ? String((raw as any).answerDetail).trim() : ''
      const scope = String((raw as any).scope ?? '').trim()
      const offLabel = (raw as any).offLabel === true
      const safetyFlag = (raw as any).safetyFlag ? String((raw as any).safetyFlag).trim() : 'none'
      if (!question) throw new Error('Missing question.')
      if (!answer) throw new Error('Missing answer.')
      if (!ALLOWED_SCOPES.has(scope)) {
        throw new Error(`scope must be one of: ${[...ALLOWED_SCOPES].join(', ')}.`)
      }
      if (!ALLOWED_SAFETY_FLAGS.has(safetyFlag)) {
        throw new Error(`safetyFlag must be one of: ${[...ALLOWED_SAFETY_FLAGS].join(', ')}.`)
      }

      const serviceSlug = (raw as any).serviceSlug ? String((raw as any).serviceSlug).trim() : ''
      const brandSlug = (raw as any).brandSlug ? String((raw as any).brandSlug).trim() : ''
      const locationSlug = (raw as any).locationSlug ? String((raw as any).locationSlug).trim() : ''
      const clinicType = (raw as any).clinicType ? String((raw as any).clinicType).trim() : ''
      const relatedGuideSlug = (raw as any).relatedGuideSlug ? String((raw as any).relatedGuideSlug).trim() : ''
      const sortRankNum = Number((raw as any).sortRank)
      const sortRank = Number.isFinite(sortRankNum) ? sortRankNum : 999
      const stableId = String(rawStableId ?? '').trim() || slugify(question)
      if (!stableId) throw new Error('Could not derive a stableId from the question.')

      if (clinicType && !ALLOWED_CLINIC_TYPES.has(clinicType)) {
        throw new Error(`clinicType must be one of: ${[...ALLOWED_CLINIC_TYPES].join(', ')}.`)
      }

      let service: number | undefined
      if (serviceSlug) {
        const id = await resolveBySlug(payload, 'services', serviceSlug)
        if (!id) throw new Error(`serviceSlug "${serviceSlug}" not found.`)
        service = id
      }

      let brand: number | undefined
      if (brandSlug) {
        const id = await resolveBySlug(payload, 'brands', brandSlug)
        if (!id) throw new Error(`brandSlug "${brandSlug}" not found.`)
        brand = id
      }

      let location: number | undefined
      if (locationSlug) {
        const id = await resolveBySlug(payload, 'locations', locationSlug)
        if (!id) throw new Error(`locationSlug "${locationSlug}" not found.`)
        location = id
      }

      let relatedGuide: number | undefined
      if (relatedGuideSlug) {
        const id = await resolveBySlug(payload, 'guides', relatedGuideSlug)
        if (!id) throw new Error(`relatedGuideSlug "${relatedGuideSlug}" not found.`)
        relatedGuide = id
      }

      const existing: any = await payload.find({
        collection: 'faqs',
        where: { stableId: { equals: stableId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const match = existing.docs[0]

      const data: Record<string, any> = {
        question,
        answer,
        answerDetail: answerDetail || undefined,
        scope,
        service,
        brand,
        location,
        clinicType: clinicType || undefined,
        relatedGuide,
        offLabel,
        safetyFlag,
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

    opts.onProgress?.(i + 1, list.length)
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

export type FaqExportRow = {
  question: string
  answer: string
  answerDetail?: string
  scope: string
  serviceSlug?: string
  brandSlug?: string
  locationSlug?: string
  clinicType?: string
  relatedGuideSlug?: string
  offLabel?: boolean
  safetyFlag?: string
  sortRank: number
  stableId: string
  reviewStatus: string
}

export async function exportAllFaqs(payload: Payload): Promise<FaqExportRow[]> {
  const res: any = await payload.find({
    collection: 'faqs',
    limit: MAX_ROWS,
    sort: 'id',
    depth: 1,
    overrideAccess: true,
  })

  return (res.docs as any[]).map((f) => ({
    question: f.question,
    answer: f.answer,
    answerDetail: f.answerDetail || undefined,
    scope: f.scope,
    serviceSlug: f.service && typeof f.service === 'object' ? f.service.slug : undefined,
    brandSlug: f.brand && typeof f.brand === 'object' ? f.brand.slug : undefined,
    locationSlug: f.location && typeof f.location === 'object' ? f.location.slug : undefined,
    clinicType: f.clinicType || undefined,
    relatedGuideSlug: f.relatedGuide && typeof f.relatedGuide === 'object' ? f.relatedGuide.slug : undefined,
    offLabel: !!f.offLabel,
    safetyFlag: f.safetyFlag || 'none',
    sortRank: f.sortRank ?? 999,
    stableId: f.stableId,
    reviewStatus: f.reviewStatus,
  }))
}

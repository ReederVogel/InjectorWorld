import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdmin } from '@/lib/auth-guards'
import type { Where } from 'payload'

export const runtime = 'nodejs'

function isMissing(val: unknown): boolean {
  if (val === null || val === undefined) return true
  if (typeof val === 'string' && val.trim() === '') return true
  return false
}

function isMissingArray(val: unknown): boolean {
  if (val === null || val === undefined) return true
  if (Array.isArray(val) && val.length === 0) return true
  return false
}

const CLINIC_MISSING_FIELDS = [
  'clinicType', 'description', 'phone', 'email', 'bookingUrl', 'amenities',
  'logoUrl', 'yearEstablished', 'googlePlaceId', 'treatmentsOffered', 'languages',
  'instagramUrl', 'facebookUrl', 'offersVirtualConsult', 'startingPrice', 'hoursJson',
]

const PROVIDER_MISSING_FIELDS = [
  'bio', 'tagline', 'yearsExperience', 'profilePhotoUrl', 'languages', 'gender',
  'treatmentsOffered', 'pricingBotoxPerUnit', 'pricingFillerPerSyringe',
  'npiNumber', 'instagramUrl', 'tiktokUrl', 'offersVirtualConsult',
]

const REVIEW_MISSING_FIELDS = [
  'reviewerFirstName', 'reviewerAgeRange', 'reviewerCity',
  'reviewTitle', 'treatmentTag', 'sourceUrl', 'responseFromProvider',
]

function getMissingFields(doc: Record<string, unknown>, type: string): string[] {
  const fields =
    type === 'clinics' ? CLINIC_MISSING_FIELDS
    : type === 'providers' ? PROVIDER_MISSING_FIELDS
    : REVIEW_MISSING_FIELDS

  return fields.filter((field) => {
    const val = doc[field]
    if (field === 'treatmentsOffered') return isMissingArray(val)
    if (field === 'offersVirtualConsult') return val === undefined
    if (field === 'languages') return isMissingArray(val)
    return isMissing(val)
  })
}

function getStatusField(type: string): string {
  return type === 'reviews' ? 'moderationStatus' : 'status'
}

function buildWhere(base: Where, statusField: string, statusVal: string): Where {
  return { ...base, [statusField]: { equals: statusVal } } as Where
}

export async function GET(req: NextRequest) {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdmin(user)
  if (guard) return guard

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? ''
  if (!['clinics', 'providers', 'reviews'].includes(type)) {
    return NextResponse.json({ error: 'type must be clinics, providers, or reviews' }, { status: 400 })
  }

  const status = searchParams.get('status') || 'all'
  const batch = searchParams.get('batch') || ''
  const missingField = searchParams.get('missing') || ''
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10))
  const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '100', 10)), 200)
  const statusField = getStatusField(type)
  const col = type as 'clinics' | 'providers' | 'reviews'

  // Base where for counts (batch filter only, no status)
  const countWhere: Where = batch ? { importBatch: { equals: batch } } : {}

  // Status values for count queries
  const publishedVal = type === 'reviews' ? 'approved' : 'published'
  const reviewVal = type === 'reviews' ? 'pending' : 'review'
  const draftVal = type === 'reviews' ? 'rejected' : 'draft'

  const docWhere: Where = { ...countWhere }
  if (status !== 'all') (docWhere as any)[statusField] = { equals: status }

  if (missingField) {
    // Fetch all matching records, filter in-process, then paginate the result
    const filtered: unknown[] = []
    let page = 1
    while (true) {
      const res = await payload.find({ collection: col, where: docWhere, limit: 500, page, depth: 0, overrideAccess: true })
      for (const doc of res.docs) {
        const d = doc as unknown as Record<string, unknown>
        const missing = getMissingFields(d, type)
        if (missing.includes(missingField)) {
          filtered.push({ ...d, missingFields: missing })
        }
      }
      if (page >= res.totalPages) break
      page++
      if (page > 20) break
    }

    const sliced = filtered.slice(offset, offset + limit)

    const [pubRes, revRes, dftRes] = await Promise.all([
      payload.count({ collection: col, where: buildWhere(countWhere, statusField, publishedVal), overrideAccess: true }),
      payload.count({ collection: col, where: buildWhere(countWhere, statusField, reviewVal), overrideAccess: true }),
      payload.count({ collection: col, where: buildWhere(countWhere, statusField, draftVal), overrideAccess: true }),
    ])

    return NextResponse.json({
      docs: sliced,
      totalDocs: filtered.length,
      publishedCount: pubRes.totalDocs,
      reviewCount: revRes.totalDocs,
      draftCount: dftRes.totalDocs,
      missingAnyCount: filtered.length,
    })
  }

  // Standard paginated fetch
  const page = Math.floor(offset / limit) + 1

  const [docsRes, pubRes, revRes, dftRes] = await Promise.all([
    payload.find({ collection: col, where: docWhere, limit, page, depth: 0, overrideAccess: true }),
    payload.count({ collection: col, where: buildWhere(countWhere, statusField, publishedVal), overrideAccess: true }),
    payload.count({ collection: col, where: buildWhere(countWhere, statusField, reviewVal), overrideAccess: true }),
    payload.count({ collection: col, where: buildWhere(countWhere, statusField, draftVal), overrideAccess: true }),
  ])

  const docs = docsRes.docs.map((doc) => {
    const d = doc as unknown as Record<string, unknown>
    return { ...d, missingFields: getMissingFields(d, type) }
  })

  // Compute missingAnyCount via full scan when more than one page exists
  let missingAnyCount = 0
  if (docsRes.totalPages <= 1) {
    missingAnyCount = docs.filter((d) => d.missingFields.length > 0).length
  } else {
    let scanPage = 1
    while (true) {
      const scanRes = await payload.find({ collection: col, where: docWhere, limit: 500, page: scanPage, depth: 0, overrideAccess: true })
      for (const doc of scanRes.docs) {
        if (getMissingFields(doc as unknown as Record<string, unknown>, type).length > 0) missingAnyCount++
      }
      if (scanPage >= scanRes.totalPages) break
      scanPage++
      if (scanPage > 10) break
    }
  }

  return NextResponse.json({
    docs,
    totalDocs: docsRes.totalDocs,
    publishedCount: pubRes.totalDocs,
    reviewCount: revRes.totalDocs,
    draftCount: dftRes.totalDocs,
    missingAnyCount,
  })
}

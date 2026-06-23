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

function csvCell(val: unknown): string {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(',')
}

function clinicRow(doc: Record<string, unknown>, missingFields: string[]): string {
  const treatments = Array.isArray(doc.treatmentsOffered)
    ? doc.treatmentsOffered.join(';')
    : ''
  const langs = Array.isArray(doc.languages)
    ? doc.languages.join(';')
    : doc.languages ?? ''
  return csvRow([
    doc.clinicId,
    doc.clinicName,
    doc.city,
    doc.state,
    doc.status ?? '',
    doc.clinicType ?? '',
    doc.phone ?? '',
    doc.email ?? '',
    doc.bookingUrl ?? '',
    treatments,
    langs,
    doc.instagramUrl ?? '',
    doc.facebookUrl ?? '',
    doc.startingPrice ?? '',
    doc.logoUrl ?? '',
    doc.googlePlaceId ?? '',
    missingFields.join(','),
  ])
}

function providerRow(doc: Record<string, unknown>, missingFields: string[]): string {
  const treatments = Array.isArray(doc.treatmentsOffered)
    ? doc.treatmentsOffered.join(';')
    : ''
  const clinicId =
    doc.clinic && typeof doc.clinic === 'object'
      ? (doc.clinic as Record<string, unknown>).id ?? ''
      : doc.clinic ?? ''
  return csvRow([
    doc.providerId,
    doc.fullName,
    doc.credentials,
    clinicId,
    doc.status ?? '',
    doc.bio ?? '',
    doc.yearsExperience ?? '',
    treatments,
    doc.pricingBotoxPerUnit ?? '',
    doc.pricingFillerPerSyringe ?? '',
    doc.npiNumber ?? '',
    doc.instagramUrl ?? '',
    missingFields.join(','),
  ])
}

function reviewRow(doc: Record<string, unknown>, missingFields: string[]): string {
  const clinicId =
    doc.clinic && typeof doc.clinic === 'object'
      ? (doc.clinic as Record<string, unknown>).id ?? ''
      : doc.clinic ?? ''
  const providerId =
    doc.provider && typeof doc.provider === 'object'
      ? (doc.provider as Record<string, unknown>).id ?? ''
      : doc.provider ?? ''
  return csvRow([
    doc.id,
    clinicId,
    providerId,
    doc.reviewerFirstName ?? '',
    doc.reviewerAgeRange ?? '',
    doc.reviewerCity ?? '',
    doc.rating ?? '',
    doc.reviewTitle ?? '',
    doc.treatmentTag ?? '',
    doc.sourceUrl ?? '',
    doc.responseFromProvider ?? '',
    missingFields.join(','),
  ])
}

const CLINIC_HEADER = csvRow([
  'clinic_id', 'clinic_name', 'city', 'state', 'status', 'clinic_type',
  'phone', 'email', 'booking_url', 'treatments_offered', 'languages',
  'instagram_url', 'facebook_url', 'starting_price', 'logo_url',
  'google_place_id', 'missing_fields',
])

const PROVIDER_HEADER = csvRow([
  'provider_id', 'full_name', 'credentials', 'clinic_id', 'status',
  'bio', 'years_experience', 'treatments_offered', 'pricing_botox_per_unit',
  'pricing_filler_per_syringe', 'npi_number', 'instagram_url', 'missing_fields',
])

const REVIEW_HEADER = csvRow([
  'review_id', 'clinic_id', 'provider_id', 'reviewer_first_name',
  'reviewer_age_range', 'reviewer_city', 'rating', 'review_title',
  'treatment_tag', 'source_url', 'response_from_provider', 'missing_fields',
])

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
  const batch = searchParams.get('batch') || ''

  const where: Where = batch ? { importBatch: { equals: batch } } : {}

  // Fetch all records in pages of 500
  const allDocs: Record<string, unknown>[] = []
  let page = 1
  while (true) {
    const res = await payload.find({
      collection: type as 'clinics' | 'providers' | 'reviews',
      where,
      limit: 500,
      page,
      depth: 0,
      overrideAccess: true,
    })
    allDocs.push(...(res.docs as unknown as Record<string, unknown>[]))
    if (page >= res.totalPages) break
    page++
  }

  // Filter to only records with missing fields
  const gapDocs = allDocs.filter((doc) => getMissingFields(doc, type).length > 0)

  const header =
    type === 'clinics' ? CLINIC_HEADER
    : type === 'providers' ? PROVIDER_HEADER
    : REVIEW_HEADER

  const rows = gapDocs.map((doc) => {
    const missing = getMissingFields(doc, type)
    if (type === 'clinics') return clinicRow(doc, missing)
    if (type === 'providers') return providerRow(doc, missing)
    return reviewRow(doc, missing)
  })

  const csv = [header, ...rows].join('\n')
  const date = new Date().toISOString().slice(0, 10)
  const filename = `gaps-${type}-${date}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

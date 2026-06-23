import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdmin } from '@/lib/auth-guards'
import { checkOrigin } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const CLINIC_ALLOWLIST = new Set([
  'clinicType', 'description', 'phone', 'email', 'bookingUrl', 'amenities',
  'logoUrl', 'yearEstablished', 'googlePlaceId', 'treatmentsOffered',
  'languages', 'instagramUrl', 'facebookUrl', 'tiktokUrl', 'startingPrice',
  'hoursJson', 'status', 'needsManualReview', 'tagline', 'bio',
])

const PROVIDER_ALLOWLIST = new Set([
  'bio', 'tagline', 'yearsExperience', 'profilePhotoUrl', 'languages',
  'gender', 'treatmentsOffered', 'pricingBotoxPerUnit', 'pricingFillerPerSyringe',
  'npiNumber', 'instagramUrl', 'tiktokUrl', 'status', 'offersVirtualConsult',
  'acceptsNewPatients',
])

const REVIEW_ALLOWLIST = new Set([
  'reviewerFirstName', 'reviewerAgeRange', 'reviewerCity', 'reviewTitle',
  'treatmentTag', 'sourceUrl', 'responseFromProvider', 'responseDate',
  'moderationStatus', 'verified', 'featured',
])

function getAllowlist(collection: string): Set<string> | null {
  if (collection === 'clinics') return CLINIC_ALLOWLIST
  if (collection === 'providers') return PROVIDER_ALLOWLIST
  if (collection === 'reviews') return REVIEW_ALLOWLIST
  return null
}

export async function PATCH(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdmin(user)
  if (guard) return guard

  let body: { collection: string; id: number; field: string; value: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { collection, id, field, value } = body

  if (!['clinics', 'providers', 'reviews'].includes(collection)) {
    return NextResponse.json({ error: 'Invalid collection.' }, { status: 400 })
  }
  if (typeof id !== 'number') {
    return NextResponse.json({ error: 'id must be a number.' }, { status: 400 })
  }

  const allowlist = getAllowlist(collection)
  if (!allowlist || !allowlist.has(field)) {
    return NextResponse.json({ error: 'Field not editable.' }, { status: 400 })
  }

  // Resolve treatment slugs to IDs for treatmentsOffered
  let resolvedValue: unknown = value
  if (field === 'treatmentsOffered') {
    const rawStr = typeof value === 'string' ? value : ''
    const slugs = rawStr.split(',').map((s) => s.trim()).filter(Boolean)
    if (slugs.length === 0) {
      resolvedValue = []
    } else {
      const treatmentsRes = await payload.find({
        collection: 'treatments',
        where: { slug: { in: slugs } },
        limit: 100,
        depth: 0,
        overrideAccess: true,
      })
      resolvedValue = treatmentsRes.docs.map((t: any) => t.id)
    }
  }

  // Parse semicolon-separated languages
  if (field === 'languages' && typeof value === 'string') {
    resolvedValue = value.split(';').map((s) => s.trim()).filter(Boolean)
  }

  try {
    await payload.update({
      collection: collection as 'clinics' | 'providers' | 'reviews',
      id,
      data: { [field]: resolvedValue } as any,
      overrideAccess: true,
    })
    return NextResponse.json({ success: true, updatedField: field })
  } catch (err: any) {
    payload.logger.error(`[bulk-review update] ${err?.message ?? err}`)
    return NextResponse.json({ error: `Update failed: ${err?.message ?? 'unknown error'}` }, { status: 500 })
  }
}

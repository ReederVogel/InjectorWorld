import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { checkOrigin } from '@/lib/rate-limit'

// Fields a claimed clinic owner is allowed to update on their own clinic
const ALLOWED_FIELDS = new Set([
  'tagline',
  'description',
  'clinicType',
  'serviceType',
  'yearEstablished',
  'acceptsInsurance',
  'paymentMethods',
  'amenities',
  'phone',
  'email',
  'websiteUrl',
  'bookingUrl',
  'instagramUrl',
  'tiktokUrl',
  'facebookUrl',
  'hoursJson',
  'brandsOffered',
  'servicesOffered',
  'offersVirtualConsult',
  'acceptsNewPatients',
  'startingPrice',
  'languages',
])

// Fields that must never be settable through this route (belt-and-suspenders).
// Name/slug/address stay admin-only: they drive URLs, SEO, and dedupe.
const BLOCKED_FIELDS = new Set([
  'clinicName',
  'slug',
  'claimed',
  'claimedBy',
  'aggregateRating',
  'aggregateRatingCount',
  'status',
  'noindex',
  'publishedAt',
  'subscriptionTier',
  'subscriptionStatus',
  'clinicId',
  'importBatch',
  'providers',
  'photos',
  'clinicPhotoUrls',
  'logoUrl',
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'zip',
  'neighborhood',
  'county',
  'country',
  'latitude',
  'longitude',
  'googlePlaceId',
  'googleMapsUrl',
  'dataConfidence',
  'needsManualReview',
])

// Only allow http/https URLs in owner-editable URL fields (blocks javascript: etc.)
const httpUrl = z
  .string()
  .url()
  .max(500)
  .refine((v) => /^https?:\/\//i.test(v), { message: 'Must be a public https:// URL' })
  .optional()
  .or(z.literal(''))

const LANGUAGE_CODES = ['en', 'es', 'fr', 'zh', 'yue', 'ko', 'pt', 'ar', 'hi', 'ru'] as const

const hoursDay = z.string().max(100).optional()

const SaveSchema = z.object({
  tagline: z.string().max(100).optional(),
  description: z.string().max(5000).optional(),
  clinicType: z.enum(['medspa', 'dermatology', 'plastic-surgery', 'dental-aesthetics', 'other']).optional().or(z.literal('')),
  serviceType: z.enum(['In-Person', 'Telehealth', 'Both']).optional(),
  yearEstablished: z.number().int().min(1900).max(new Date().getFullYear()).optional().nullable(),
  acceptsInsurance: z.boolean().optional(),
  paymentMethods: z.string().max(500).optional(),
  amenities: z.string().max(500).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(200).optional().or(z.literal('')),
  websiteUrl: httpUrl,
  bookingUrl: httpUrl,
  instagramUrl: httpUrl,
  tiktokUrl: httpUrl,
  facebookUrl: httpUrl,
  hoursJson: z
    .object({ mon: hoursDay, tue: hoursDay, wed: hoursDay, thu: hoursDay, fri: hoursDay, sat: hoursDay, sun: hoursDay })
    .strict()
    .optional()
    .nullable(),
  brandsOffered: z.array(z.union([z.string(), z.number()])).max(100).optional(),
  servicesOffered: z.array(z.union([z.string(), z.number()])).max(100).optional(),
  offersVirtualConsult: z.boolean().optional(),
  acceptsNewPatients: z.boolean().optional(),
  startingPrice: z.number().min(0).max(100000).optional().nullable(),
  languages: z.array(z.enum(LANGUAGE_CODES)).max(LANGUAGE_CODES.length).optional(),
})

function relId(rel: unknown): number | null {
  if (rel == null) return null
  if (typeof rel === 'object') return Number((rel as { id?: number | string }).id)
  return Number(rel)
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const payload = await getPayload({ config })

  const user = await getAuthUser(payload)
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }
  // Claim approval assigns role 'clinic' to clinic owners; some legacy owners are
  // 'provider'-role users with a linkedClinic. Both may edit their own clinic.
  const role = (user as any).role
  if (role !== 'clinic' && role !== 'provider') {
    return NextResponse.json({ error: 'Clinic owner account required.' }, { status: 403 })
  }

  const clinicId = relId((user as any).linkedClinic)
  if (!clinicId) {
    return NextResponse.json(
      { error: 'No clinic linked to this account.' },
      { status: 403 },
    )
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  // Reject any blocked fields in the payload (server-enforced, not just hidden)
  if (raw && typeof raw === 'object') {
    for (const key of Object.keys(raw as object)) {
      if (BLOCKED_FIELDS.has(key)) {
        return NextResponse.json(
          { error: `Field "${key}" cannot be modified by a clinic owner.` },
          { status: 403 },
        )
      }
      if (!ALLOWED_FIELDS.has(key)) {
        return NextResponse.json(
          { error: `Unknown field "${key}".` },
          { status: 400 },
        )
      }
    }
  }

  const parsed = SaveSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as string
      if (key) fieldErrors[key] = issue.message
    }
    return NextResponse.json({ error: 'Validation failed.', fieldErrors }, { status: 422 })
  }

  // Build a clean update payload — only allowed fields, strip empty strings
  const updateData: Record<string, unknown> = {}
  const data = parsed.data as Record<string, unknown>
  for (const [key, value] of Object.entries(data)) {
    if (!ALLOWED_FIELDS.has(key)) continue
    if (value === '') {
      updateData[key] = null
    } else {
      updateData[key] = value
    }
  }

  // Relationship IDs must be raw numbers for the Postgres adapter (locked rule)
  for (const relField of ['brandsOffered', 'servicesOffered'] as const) {
    if (Array.isArray(updateData[relField])) {
      updateData[relField] = (updateData[relField] as (string | number)[])
        .map((id) => (typeof id === 'number' ? id : parseInt(id, 10)))
        .filter((id) => !isNaN(id))
    }
  }

  // Drop empty-string day entries from hours so "Closed" days can simply be blank
  if (updateData.hoursJson && typeof updateData.hoursJson === 'object') {
    const cleaned: Record<string, string> = {}
    for (const [day, val] of Object.entries(updateData.hoursJson as Record<string, unknown>)) {
      if (typeof val === 'string' && val.trim() !== '') cleaned[day] = val.trim()
    }
    updateData.hoursJson = Object.keys(cleaned).length ? cleaned : null
  }

  // clinicId is always derived from user.linkedClinic (JWT) above — never from the
  // request body. The update therefore always targets the caller's own clinic.
  try {
    // overrideAccess: true — clinic role lacks update permission on clinics; ID is
    // from JWT and the allowed-field list is validated above. The audit hook on
    // Clinics records this change (changedFields + userEmail) automatically.
    await payload.update({
      collection: 'clinics',
      id: clinicId,
      data: updateData as any,
      overrideAccess: true,
      req: { user } as any,
    })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[dashboard/clinic-save] update failed:', err)
    return NextResponse.json(
      { error: 'Could not save changes. Please try again.' },
      { status: 500 },
    )
  }
}

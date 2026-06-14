import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { checkOrigin } from '@/lib/rate-limit'

// Fields a provider is allowed to update on their own profile
const ALLOWED_FIELDS = new Set([
  'tagline',
  'bio',
  'profilePhotoUrl',
  'languages',
  'treatmentsOffered',
  'pricingBotoxPerUnit',
  'pricingFillerPerSyringe',
  'pricingConsultation',
  'startingPrice',
  'acceptsNewPatients',
  'offersVirtualConsult',
  'offersInPerson',
  'websiteUrl',
  'email',
  'phoneDirect',
  'instagramUrl',
  'tiktokUrl',
  'linkedinUrl',
])

// H4: Only allow http/https URLs in provider-editable URL fields (blocks javascript: etc.)
const httpUrl = z
  .string()
  .url()
  .max(500)
  .refine((v) => /^https?:\/\//i.test(v), { message: 'Must be a public https:// URL' })
  .optional()
  .or(z.literal(''))

// Fields that must never be settable through this route (belt-and-suspenders)
const BLOCKED_FIELDS = new Set([
  'licenseNumber',
  'licenseState',
  'licenseStatus',
  'licenseVerificationUrl',
  'npiNumber',
  'claimed',
  'claimedBy',
  'aggregateRating',
  'aggregateRatingCount',
  'editorsPick',
  'featuredRank',
  'providerId',
  'slug',
  'clinic',
  'boardCertifications',
  'credentials',
  'role',
  'verified',
])

const SaveSchema = z.object({
  tagline: z.string().max(100).optional(),
  bio: z.string().max(3000).optional(),
  profilePhotoUrl: httpUrl,
  languages: z.array(z.string()).optional(),
  treatmentsOffered: z.array(z.string()).optional(),
  pricingBotoxPerUnit: z.number().min(0).max(10000).optional().nullable(),
  pricingFillerPerSyringe: z.number().min(0).max(50000).optional().nullable(),
  pricingConsultation: z.number().min(0).max(10000).optional().nullable(),
  startingPrice: z.number().min(0).max(50000).optional().nullable(),
  acceptsNewPatients: z.boolean().optional(),
  offersVirtualConsult: z.boolean().optional(),
  offersInPerson: z.boolean().optional(),
  websiteUrl: httpUrl,
  email: z.string().email().max(200).optional().or(z.literal('')),
  phoneDirect: z.string().max(30).optional(),
  instagramUrl: httpUrl,
  tiktokUrl: httpUrl,
  linkedinUrl: httpUrl,
})

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const payload = await getPayload({ config })

  // Authenticate via session cookie (read cookie → JWT internally)
  const user = await getAuthUser(payload)
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }
  if ((user as any).role !== 'provider') {
    return NextResponse.json({ error: 'Provider account required.' }, { status: 403 })
  }

  const linkedProvider = (user as any).linkedProvider
  const providerId: number | null =
    linkedProvider == null ? null
    : typeof linkedProvider === 'object' ? linkedProvider.id
    : linkedProvider

  if (!providerId) {
    return NextResponse.json(
      { error: 'No provider profile linked to this account.' },
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
          { error: `Field "${key}" cannot be modified by a provider.` },
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

  // treatmentsOffered is an array of treatment IDs (relationships)
  if (Array.isArray(updateData.treatmentsOffered)) {
    updateData.treatmentsOffered = (updateData.treatmentsOffered as string[]).map(
      (id) => parseInt(id, 10),
    ).filter((id) => !isNaN(id))
  }

  try {
    await payload.update({
      collection: 'providers',
      id: providerId,
      data: updateData as any,
      overrideAccess: true,
    })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[dashboard/save] update failed:', err)
    return NextResponse.json(
      { error: 'Could not save changes. Please try again.' },
      { status: 500 },
    )
  }
}

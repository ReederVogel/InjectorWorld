import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { checkOrigin } from '@/lib/rate-limit'

export const runtime = 'nodejs'

/**
 * Lets a claimed provider manage the OTHER locations (branches) where they also
 * practice. Only the `additionalClinics` relationship is touched here. The
 * primary `clinic`, license, and verification fields are never settable from this
 * route. Locations are picked from clinics that already exist in the directory;
 * a clinic we do not list yet is added by an admin (verified before publishing).
 */

async function resolveProvider(req: NextRequest) {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  if (!user) return { payload, error: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }), providerId: 0, linkedClinicId: 0 }
  if ((user as any).role !== 'provider') return { payload, error: NextResponse.json({ error: 'Provider account required.' }, { status: 403 }), providerId: 0, linkedClinicId: 0 }
  const linked = (user as any).linkedProvider
  const providerId: number = linked == null ? 0 : typeof linked === 'object' ? linked.id : linked
  if (!providerId) return { payload, error: NextResponse.json({ error: 'No provider profile linked to this account.' }, { status: 403 }), providerId: 0, linkedClinicId: 0 }
  const rawClinic = (user as any).linkedClinic
  // Payload relationship fields can be either a number (ID) or a full object depending
  // on depth. We handle both cases explicitly.
  const linkedClinicId: number =
    rawClinic == null ? 0
    : typeof rawClinic === 'object' ? Number((rawClinic as any).id)
    : Number(rawClinic)
  return { payload, error: null as NextResponse | null, providerId, linkedClinicId }
}

/** GET ?q= — typeahead search of clinics to add as an additional location. */
export async function GET(req: NextRequest) {
  const { payload, error, providerId } = await resolveProvider(req)
  if (error) return error

  const q = (new URL(req.url).searchParams.get('q') || '').trim()
  if (q.length < 2) return NextResponse.json({ results: [] })

  // The provider's own primary clinic id, to exclude from the picker.
  let primaryClinicId = 0
  try {
    // overrideAccess: true — reading caller's own provider record to get primary clinic ID for exclusion from picker; providerId is from JWT
    const p = await payload.findByID({ collection: 'providers', id: providerId, depth: 0, overrideAccess: true })
    primaryClinicId = p?.clinic == null ? 0 : typeof p.clinic === 'object' ? p.clinic.id : p.clinic
  } catch { /* ignore */ }

  // overrideAccess: true — listing public-facing directory clinics for the typeahead picker
  const res = await payload.find({
    collection: 'clinics',
    where: { clinicName: { like: q } },
    limit: 15,
    depth: 0,
    overrideAccess: true,
  })
  const results = res.docs
    .filter((c: any) => Number(c.id) !== Number(primaryClinicId))
    .map((c: any) => ({ id: Number(c.id), clinicName: c.clinicName, city: c.city, state: c.state }))
  return NextResponse.json({ results })
}

const SaveSchema = z.object({
  additionalClinicIds: z.array(z.union([z.number(), z.string()])).max(50),
})

/** POST { additionalClinicIds } — replace the provider's additional locations. */
export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const { payload, error, providerId, linkedClinicId } = await resolveProvider(req)
  if (error) return error

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  // Reject any field other than additionalClinicIds (belt-and-suspenders).
  if (raw && typeof raw === 'object') {
    for (const key of Object.keys(raw as object)) {
      if (key !== 'additionalClinicIds') {
        return NextResponse.json({ error: `Field "${key}" cannot be modified here.` }, { status: 403 })
      }
    }
  }

  const parsed = SaveSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed.' }, { status: 422 })
  }

  // The primary clinic must never appear in additionalClinics.
  let primaryClinicId = 0
  try {
    // overrideAccess: true — reading caller's own provider record to get primary clinic ID before saving additionalClinics
    const p = await payload.findByID({ collection: 'providers', id: providerId, depth: 0, overrideAccess: true })
    primaryClinicId = p?.clinic == null ? 0 : typeof p.clinic === 'object' ? p.clinic.id : p.clinic
  } catch { /* ignore */ }

  const ids = Array.from(
    new Set(
      parsed.data.additionalClinicIds
        .map((x) => parseInt(String(x), 10))
        .filter((n) => !Number.isNaN(n) && n !== Number(primaryClinicId)),
    ),
  )

  // Full multi-clinic staff approval flow (where another clinic's owner approves the link)
  // is planned for a later phase. For now, providers may only link their own primary clinic.
  for (const id of ids) {
    if (Number(id) !== linkedClinicId) {
      return NextResponse.json(
        {
          error: `Clinic ID ${id} is not approved for your account. Contact support to link additional locations.`,
        },
        { status: 403 },
      )
    }
  }

  // Validate each id is a real clinic (avoid dangling relationships).
  const valid: number[] = []
  for (const id of ids) {
    try {
      // overrideAccess: true — verifying each submitted clinic ID is a real record before linking it to the provider
      const c = await payload.findByID({ collection: 'clinics', id, depth: 0, overrideAccess: true })
      if (c) valid.push(id)
    } catch { /* skip non-existent */ }
  }

  try {
    // overrideAccess: true — provider role cannot update providers collection; ownership verified via providerId from JWT
    await payload.update({
      collection: 'providers',
      id: providerId,
      data: { additionalClinics: valid },
      overrideAccess: true,
    })
    return NextResponse.json({ success: true, count: valid.length })
  } catch (err: any) {
    payload.logger.error(`[dashboard/locations] update failed: ${(err as Error)?.message}`)
    return NextResponse.json({ error: 'Could not save locations. Please try again.' }, { status: 500 })
  }
}

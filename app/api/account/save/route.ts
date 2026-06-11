import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'

/**
 * Saved providers + clinics for a logged-in user. Persists to
 * Users.savedProviders / Users.savedClinics. Anonymous saves live in
 * localStorage on the client and are merged here on login (action: "merge").
 *
 * Only the two saved-list fields are ever written (allowlist), via overrideAccess
 * scoped to the caller's own user id, so this can never touch role or links.
 */

const ToggleSchema = z.object({
  action: z.enum(['save', 'unsave', 'toggle']),
  type: z.enum(['provider', 'clinic']),
  id: z.union([z.string(), z.number()]),
})

const MergeSchema = z.object({
  action: z.literal('merge'),
  providers: z.array(z.union([z.string(), z.number()])).max(500).optional(),
  clinics: z.array(z.union([z.string(), z.number()])).max(500).optional(),
})

const BodySchema = z.union([ToggleSchema, MergeSchema])

function toNumIds(arr: unknown): number[] {
  if (!Array.isArray(arr)) return []
  const out: number[] = []
  for (const v of arr) {
    // Relationship values can be ids or populated docs.
    const n = typeof v === 'object' && v !== null ? Number((v as { id?: unknown }).id) : Number(v)
    if (Number.isFinite(n)) out.push(n)
  }
  return out
}

export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  if (!user) {
    return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed.' }, { status: 422 })
  }

  // Always work from the freshest stored lists (depth 0 = ids).
  const fresh = await payload.findByID({
    collection: 'users',
    id: user.id,
    depth: 0,
    overrideAccess: true,
  })
  const freshRec = fresh as { savedProviders?: unknown; savedClinics?: unknown }
  const providerSet = new Set<number>(toNumIds(freshRec.savedProviders))
  const clinicSet = new Set<number>(toNumIds(freshRec.savedClinics))

  const data = parsed.data
  if (data.action === 'merge') {
    for (const id of toNumIds(data.providers)) providerSet.add(id)
    for (const id of toNumIds(data.clinics)) clinicSet.add(id)
  } else {
    const idNum = Number(data.id)
    if (!Number.isFinite(idNum)) {
      return NextResponse.json({ error: 'Invalid id.' }, { status: 400 })
    }
    const set = data.type === 'provider' ? providerSet : clinicSet
    const shouldSave =
      data.action === 'save' || (data.action === 'toggle' && !set.has(idNum))
    if (shouldSave) set.add(idNum)
    else set.delete(idNum)
  }

  try {
    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        savedProviders: Array.from(providerSet),
        savedClinics: Array.from(clinicSet),
      } as never,
      overrideAccess: true,
    })
  } catch (err) {
    payload.logger.error(`[account/save] update failed: ${(err as Error)?.message}`)
    return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    savedProviders: Array.from(providerSet).map(String),
    savedClinics: Array.from(clinicSet).map(String),
  })
}

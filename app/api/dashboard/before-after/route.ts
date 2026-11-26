import { NextRequest, NextResponse } from 'next/server'
import { getPayload, type Payload } from 'payload'
import { randomBytes } from 'node:crypto'
import config from '@/payload.config'
import { BeforeAfterFields } from '@/lib/before-after-fields'
import { getAuthUser } from '@/lib/auth-user'
import { resolveOwnedClinic } from '@/lib/owned-clinics'
import { can, effectiveTier } from '@/lib/entitlements'
import { RateLimiter, checkOrigin, getIp } from '@/lib/rate-limit'
import { BEFORE_AFTER_PHOTO, encodeClinicPhoto, validateImageUpload } from '@/lib/image-validation'
import { MAX_BEFORE_AFTER, toOwnerCase } from '@/lib/before-after'

/**
 * Clinic owners' before and after photos (Pro and Elite, billing active).
 *
 * POST   ?clinic=<id>  multipart: before, after (images), serviceTag, weeksPost,
 *                      patientNote (optional), consent=true
 *   - both photos are re-encoded to 1080x1080 WebP with no metadata; the case is
 *     saved as "pending" and shows on the clinic page only after staff approve it.
 * DELETE ?clinic=<id>  json: { id }
 *   - removes one of this clinic's cases (its two photos go with it).
 */

/** Each cropped photo is well under 1 MB; two at this cap still fit the 10 MB request body limit. */
const MAX_BYTES = 4 * 1024 * 1024
const limiter = new RateLimiter(20, 60 * 60 * 1000)

async function ownerAndClinic(req: NextRequest, payload: Payload) {
  const user = await getAuthUser(payload)
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }) }
  if ((user as any).role !== 'clinic') return { error: NextResponse.json({ error: 'Clinic-owner account required.' }, { status: 403 }) }
  const clinicId = await resolveOwnedClinic(payload, user, req.nextUrl.searchParams.get('clinic'))
  if (!clinicId) return { error: NextResponse.json({ error: 'This clinic is not on your account.' }, { status: 403 }) }
  return { clinicId }
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  const payload = await getPayload({ config })
  const owner = await ownerAndClinic(req, payload)
  if ('error' in owner) return owner.error
  const { clinicId } = owner

  if (!(await limiter.check(`dashboard-before-after:${getIp(req)}`))) {
    return NextResponse.json({ error: 'Too many uploads. Try again later.' }, { status: 429 })
  }

  // overrideAccess: true — the caller owns this clinic (ownerAndClinic); plan fields are staff-only on REST
  const clinic: any = await payload.findByID({ collection: 'clinics', id: clinicId, depth: 0, overrideAccess: true }).catch(() => null)
  if (!clinic) return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })
  if (!can(effectiveTier(clinic), 'beforeAfterGallery')) {
    return NextResponse.json({ error: 'Before and after photos are part of the Pro and Elite plans.' }, { status: 403 })
  }
  const { totalDocs } = await payload.count({ collection: 'before-after-cases', where: { clinic: { equals: clinicId } }, overrideAccess: true })
  if (totalDocs >= MAX_BEFORE_AFTER) {
    return NextResponse.json({ error: `You can keep up to ${MAX_BEFORE_AFTER} before and after cases. Remove one to add another.` }, { status: 403 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid upload.' }, { status: 400 })
  }
  const parsed = BeforeAfterFields.safeParse({
    serviceTag: form.get('serviceTag') ?? '',
    weeksPost: form.get('weeksPost') ?? '',
    patientNote: form.get('patientNote') || undefined,
    consent: form.get('consent'),
  })
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const first = Object.values(fieldErrors).flat()[0]
    return NextResponse.json({ error: first || 'Check the form.', fieldErrors }, { status: 422 })
  }

  // Both photos are checked and re-encoded before anything is stored.
  const photos: Buffer[] = []
  for (const key of ['before', 'after'] as const) {
    const file = form.get(key)
    if (!(file instanceof File)) return NextResponse.json({ error: `Add the ${key} photo.` }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: `The ${key} photo is too large.` }, { status: 413 })
    const buffer = Buffer.from(await file.arrayBuffer())
    const check = await validateImageUpload(buffer)
    if (!check.ok) return NextResponse.json({ error: `The ${key} photo: ${check.error}` }, { status: check.status })
    try {
      photos.push(await encodeClinicPhoto(buffer, BEFORE_AFTER_PHOTO))
    } catch {
      return NextResponse.json({ error: `The ${key} photo could not be read.` }, { status: 415 })
    }
  }

  const { serviceTag, weeksPost, patientNote } = parsed.data
  const created: number[] = []
  try {
    const media: any[] = []
    for (const [i, data] of photos.entries()) {
      // overrideAccess: true — Media create is staff-only; ownership and plan checked above
      const m = await payload.create({
        collection: 'media',
        data: { alt: `${i === 0 ? 'Before' : 'After'}: ${serviceTag}` },
        file: { data, mimetype: 'image/webp', name: `before-after-${randomBytes(8).toString('hex')}.webp`, size: data.length },
        overrideAccess: true,
      })
      created.push(Number(m.id))
      media.push(m)
    }
    // overrideAccess: true — before-after-cases create is staff-only; this is the owner's own clinic
    const doc = await payload.create({
      collection: 'before-after-cases',
      data: {
        caseTitle: `${serviceTag}, ${weeksPost} week${weeksPost === 1 ? '' : 's'} after`,
        beforePhotoUrl: media[0].url,
        afterPhotoUrl: media[1].url,
        beforePhoto: Number(media[0].id),
        afterPhoto: Number(media[1].id),
        serviceTag,
        weeksPost,
        patientNote: patientNote || undefined,
        city: clinic.city || undefined,
        state: typeof clinic.state === 'string' && clinic.state.length === 2 ? clinic.state : undefined,
        consentGranted: true,
        clinic: clinicId,
        status: 'pending',
      } as any,
      overrideAccess: true,
    })
    return NextResponse.json({ case: toOwnerCase(doc) })
  } catch (err) {
    console.error('[dashboard/before-after] create failed:', err)
    for (const id of created) await payload.delete({ collection: 'media', id, overrideAccess: true }).catch(() => {})
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  const payload = await getPayload({ config })
  const owner = await ownerAndClinic(req, payload)
  if ('error' in owner) return owner.error

  const id = Number((await req.json().catch(() => ({})))?.id)
  if (!id) return NextResponse.json({ error: 'id required.' }, { status: 400 })
  // Only a case of the caller's own clinic: another owner's id simply matches nothing.
  const res = await payload.delete({
    collection: 'before-after-cases',
    where: { and: [{ id: { equals: id } }, { clinic: { equals: owner.clinicId } }] },
    overrideAccess: true,
  })
  if (!res.docs?.length) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  return NextResponse.json({ success: true })
}

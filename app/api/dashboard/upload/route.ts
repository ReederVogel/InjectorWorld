import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { limits, type Tier } from '@/lib/entitlements'
import { RateLimiter, checkOrigin, getIp } from '@/lib/rate-limit'
import { validateImageUpload } from '@/lib/image-validation'

/**
 * Self-service photo upload for claimed clinic owners.
 *
 * POST   multipart/form-data: file=<image>, target='clinic'
 *   - appends to the caller's linked clinic `photos` gallery.
 * DELETE json: { target, mediaId } or { target, url }
 *   - removes one photo from that gallery: an upload by its Media id, an
 *     imported photo by its URL.
 * PATCH  json: { target, order: string[] }
 *   - the same photos in a new order, first = cover.
 *
 * Auth: a claimed owner is a `clinic`-role user. The Media create runs with
 * overrideAccess (Media create is staff-only), but only AFTER we confirm the
 * caller owns the target record, and the file is only ever attached to that
 * owned record. No other record can be touched.
 *
 * The 'provider' target was removed on 2026-08-24 with the Providers collection.
 */

const MAX_BYTES = 8 * 1024 * 1024 // 8 MB

/**
 * 20 uploads/hour. Now the shared RateLimiter rather than a private Map.
 *
 * The private Map had two faults beyond duplication: it never evicted expired
 * entries (so it grew for the life of the process), and it could not pick up the
 * Redis-backed shared store when REDIS_URL is set, so this one route would have
 * silently kept per-process limits after everything else moved to a shared
 * counter.
 */
const limiter = new RateLimiter(20, 60 * 60 * 1000)
/** Reordering is one write per arrow click, so it gets its own, roomier limit. */
const reorderLimiter = new RateLimiter(300, 60 * 60 * 1000)

function relId(rel: unknown): number | undefined {
  if (rel == null) return undefined
  if (typeof rel === 'object') return Number((rel as { id?: number | string }).id)
  return Number(rel)
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const payload = await getPayload({ config })

  const user = await getAuthUser(payload)
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  const role = (user as any).role
  if (role !== 'clinic') {
    return NextResponse.json({ error: 'Clinic-owner account required.' }, { status: 403 })
  }

  // getIp() reads the trusted proxy hop. This used to take the leftmost
  // X-Forwarded-For entry, which the caller writes, so the upload limit was
  // bypassable by rotating one header.
  if (!(await limiter.check(`dashboard-upload:${getIp(req)}`))) {
    return NextResponse.json({ error: 'Too many uploads. Try again later.' }, { status: 429 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid upload.' }, { status: 400 })
  }

  const target = String(formData.get('target') || '')
  const file = formData.get('file')

  if (target !== 'clinic') {
    return NextResponse.json({ error: 'Invalid target.' }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
  }
  // Byte-size gate runs first, before anything reads the file into memory.
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image is too large (max 8 MB).' }, { status: 413 })
  }

  // Confirm ownership of the target record BEFORE creating any Media.
  const linkedClinic = relId((user as any).linkedClinic)

  if (!linkedClinic) {
    return NextResponse.json({ error: 'No clinic linked to this account.' }, { status: 403 })
  }

  // Only now read the file in. Ownership is already confirmed above, so an
  // unauthorised caller never gets this far and never costs us the buffer.
  const buffer = Buffer.from(await file.arrayBuffer())

  /**
   * Validate against the BYTES, not the declared type. `file.type` is the
   * client-supplied Content-Type of the multipart part, so the previous
   * allowlist check on it could be satisfied by labelling any file at all
   * `image/jpeg`. This also bounds the pixel dimensions, which the byte-size
   * limit above cannot see: a highly compressible 50,000px image passes an 8 MB
   * cap and then costs gigabytes to decode.
   */
  const check = await validateImageUpload(buffer)
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  /**
   * Filename is caller-supplied. Reduce it to a safe basename before it reaches
   * storage: strip any directory component, allow only a conservative character
   * set, and cap the length. Payload and the S3 adapter both handle this
   * sensibly today, so this is defence in depth rather than a live hole.
   */
  const safeName =
    (file.name || '')
      .split(/[\\/]/)
      .pop()
      ?.replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/^[.-]+/, '')
      .slice(0, 120) || `upload-${Date.now()}`

  let media: any
  try {
    // overrideAccess: true — Media create is admin-only in Payload config; ownership verified above via linkedClinic from JWT
    media = await payload.create({
      collection: 'media',
      data: { alt: 'Clinic photo' },
      // check.mime is the type detected from the file's own signature, not the
      // caller's claim, so what gets stored and later served always matches the
      // actual content.
      file: { data: buffer, mimetype: check.mime, name: safeName, size: file.size },
      overrideAccess: true,
    })
  } catch (err) {
    console.error('[dashboard/upload] media create failed:', err)
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })
  }

  try {
    // enforce photo tier limit before attaching Media
    // overrideAccess: true — clinic role cannot read clinics collection directly; needed to check existing photo count before enforcing entitlement cap
    const clinic = await payload.findByID({ collection: 'clinics', id: linkedClinic, depth: 1, overrideAccess: true })
    const existing = Array.isArray((clinic as any).photos) ? (clinic as any).photos : []

    const tier: Tier = ((clinic as any).subscriptionTier as Tier) || 'free'
    const maxPhotos = limits(tier).maxPhotos
    if (isFinite(maxPhotos) && existing.length >= maxPhotos) {
      return NextResponse.json(
        { error: `Your plan allows up to ${maxPhotos} clinic photos. Upgrade to add more.` },
        { status: 403 },
      )
    }

    const existingIds = existing.map(relId).filter((n: number | undefined): n is number => !!n)

    // Only `photos` changes here: denormalizeClinicPhotos appends the new URL to the
    // public gallery and keeps the clinic's imported photos.
    // overrideAccess: true — clinic role cannot update clinics collection; caller owns this clinic (linkedClinic from JWT)
    await payload.update({
      collection: 'clinics',
      id: linkedClinic!,
      data: { photos: [...existingIds, Number(media.id)] },
      overrideAccess: true,
    })
    return NextResponse.json({ id: Number(media.id), url: media.url as string })
  } catch (err) {
    console.error('[dashboard/upload] attach failed:', err)
    return NextResponse.json({ error: 'Saved the image but could not attach it. Please retry.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const payload = await getPayload({ config })

  const user = await getAuthUser(payload)
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  const role = (user as any).role
  if (role !== 'clinic') {
    return NextResponse.json({ error: 'Clinic-owner account required.' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const target = String(body?.target || '')

  const linkedClinic = relId((user as any).linkedClinic)

  try {
    if (target === 'clinic') {
      const mediaId = Number(body?.mediaId)
      const url = typeof body?.url === 'string' ? body.url : ''
      if (!linkedClinic) return NextResponse.json({ error: 'No clinic linked.' }, { status: 403 })
      if (!mediaId && !url) return NextResponse.json({ error: 'mediaId or url required.' }, { status: 400 })

      // overrideAccess: true — fetching caller's owned clinic to validate the photo exists in their gallery before deleting
      const clinic = await payload.findByID({ collection: 'clinics', id: linkedClinic, depth: 1, overrideAccess: true })
      const existing = Array.isArray((clinic as any).photos) ? (clinic as any).photos : []

      // An imported photo (a URL in the public gallery, not an upload): drop that URL only.
      if (!mediaId) {
        const gallery: string[] = ((clinic as any).clinicPhotoUrls ?? []).map((p: any) => p?.url).filter(Boolean)
        if (!gallery.includes(url) || existing.some((p: any) => p?.url === url)) {
          return NextResponse.json({ error: 'Photo not found in your clinic.' }, { status: 404 })
        }
        // overrideAccess: true — clinic role cannot update clinics collection; caller owns this clinic (linkedClinic from JWT)
        await payload.update({
          collection: 'clinics',
          id: linkedClinic,
          data: { clinicPhotoUrls: gallery.filter((u) => u !== url).map((u) => ({ url: u })) },
          overrideAccess: true,
        })
        return NextResponse.json({ success: true })
      }

      // linkedClinic comes from the user's JWT above — the request body contains only
      // target and mediaId (no clinicId). The clinic fetched is always the JWT-bound
      // clinic, so one owner cannot supply another owner's clinicId to delete their photos.
      // The isOwned check below is a belt-and-suspenders guard: verify the mediaId is
      // actually in the JWT-bound clinic's gallery before removing it.
      const isOwned = existing.some((p: any) => relId(p) === mediaId)
      if (!isOwned) {
        return NextResponse.json({ error: 'Photo not found in your clinic.' }, { status: 404 })
      }

      const photoIds = existing
        .filter((p: any) => relId(p) !== mediaId)
        .map(relId)
        .filter((n: any): n is number => !!n)

      // Only `photos` changes: denormalizeClinicPhotos drops this upload's URL from the
      // public gallery and keeps every other photo, imported ones included.
      // overrideAccess: true — clinic role cannot update clinics collection; caller owns this clinic (linkedClinic from JWT)
      await payload.update({
        collection: 'clinics',
        id: linkedClinic,
        data: { photos: photoIds },
        overrideAccess: true,
      })
      // overrideAccess: true — Media delete is admin-only; photo belongs to caller's own clinic gallery
      await payload.delete({ collection: 'media', id: mediaId, overrideAccess: true }).catch(() => {})
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid target.' }, { status: 400 })
  } catch (err) {
    console.error('[dashboard/upload] delete failed:', err)
    return NextResponse.json({ error: 'Could not remove the photo. Please retry.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const payload = await getPayload({ config })

  const user = await getAuthUser(payload)
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  if ((user as any).role !== 'clinic') {
    return NextResponse.json({ error: 'Clinic-owner account required.' }, { status: 403 })
  }
  const linkedClinic = relId((user as any).linkedClinic)
  if (!linkedClinic) return NextResponse.json({ error: 'No clinic linked.' }, { status: 403 })

  if (!(await reorderLimiter.check(`dashboard-reorder:${getIp(req)}`))) {
    return NextResponse.json({ error: 'Too many changes. Try again later.' }, { status: 429 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const order: unknown = body?.order
  if (body?.target !== 'clinic' || !Array.isArray(order) || order.some((u) => typeof u !== 'string')) {
    return NextResponse.json({ error: 'order must be a list of photo URLs.' }, { status: 400 })
  }

  try {
    // overrideAccess: true — caller's own clinic (linkedClinic from JWT), read to check the order
    const clinic = await payload.findByID({ collection: 'clinics', id: linkedClinic, depth: 1, overrideAccess: true })
    const current = Array.from(
      new Set(
        [
          ...(((clinic as any).clinicPhotoUrls ?? []) as any[]).map((p) => p?.url),
          ...(((clinic as any).photos ?? []) as any[]).map((p) => (p && typeof p === 'object' ? p.url : undefined)),
        ].filter(Boolean),
      ),
    ) as string[]
    // Only a rearrangement of exactly the photos the clinic has now.
    const urls = order as string[]
    const sameSet = urls.length === current.length && new Set(urls).size === urls.length && urls.every((u) => current.includes(u))
    if (!sameSet) {
      return NextResponse.json({ error: 'Your photos changed. Reload the page and try again.' }, { status: 409 })
    }

    // overrideAccess: true — clinic role cannot update clinics collection; caller owns this clinic (linkedClinic from JWT)
    await payload.update({
      collection: 'clinics',
      id: linkedClinic,
      data: { clinicPhotoUrls: urls.map((url) => ({ url })) },
      overrideAccess: true,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[dashboard/upload] reorder failed:', err)
    return NextResponse.json({ error: 'Could not save the new order. Please retry.' }, { status: 500 })
  }
}

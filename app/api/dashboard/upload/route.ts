import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { limits, type Tier } from '@/lib/entitlements'
import { checkOrigin } from '@/lib/rate-limit'

/**
 * Self-service photo upload for claimed providers and clinic owners.
 *
 * POST   multipart/form-data: file=<image>, target='provider'|'clinic'
 *   - provider: uploads to Media (R2) and sets the caller's linked provider
 *     `profilePhoto` (+ denormalized profilePhotoUrl).
 *   - clinic: appends to the caller's linked clinic `photos` gallery.
 * DELETE json: { target, mediaId? }
 *   - provider: clears the headshot.
 *   - clinic: removes one photo (mediaId required).
 *
 * Auth: a claimed owner is a `provider`-role user. The Media create runs with
 * overrideAccess (Media create is staff-only), but only AFTER we confirm the
 * caller owns the target record, and the file is only ever attached to that
 * owned record. No other record can be touched.
 */

const MAX_BYTES = 8 * 1024 * 1024 // 8 MB
const ALLOWED = /^image\/(jpeg|png|webp|gif|avif)$/

// In-memory per-IP limiter (mirrors the other API routes). 20 uploads/hour/IP.
const hits = new Map<string, { count: number; reset: number }>()
function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const rec = hits.get(ip)
  if (!rec || now > rec.reset) {
    hits.set(ip, { count: 1, reset: now + 60 * 60 * 1000 })
    return true
  }
  if (rec.count >= 20) return false
  rec.count++
  return true
}

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
  if ((user as any).role !== 'provider') {
    return NextResponse.json({ error: 'Provider or clinic-owner account required.' }, { status: 403 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!checkRateLimit(ip)) {
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

  if (target !== 'provider' && target !== 'clinic') {
    return NextResponse.json({ error: 'Invalid target.' }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
  }
  if (!ALLOWED.test(file.type)) {
    return NextResponse.json({ error: 'Only JPG, PNG, WebP, GIF, or AVIF images are allowed.' }, { status: 415 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image is too large (max 8 MB).' }, { status: 413 })
  }

  // Confirm ownership of the target record BEFORE creating any Media.
  const linkedProvider = relId((user as any).linkedProvider)
  const linkedClinic = relId((user as any).linkedClinic)

  if (target === 'provider' && !linkedProvider) {
    return NextResponse.json({ error: 'No provider profile linked to this account.' }, { status: 403 })
  }
  if (target === 'clinic' && !linkedClinic) {
    return NextResponse.json({ error: 'No clinic linked to this account.' }, { status: 403 })
  }

  // Create the Media doc (lands on R2 via the storage adapter).
  const buffer = Buffer.from(await file.arrayBuffer())
  let media: any
  try {
    media = await payload.create({
      collection: 'media',
      data: {
        alt:
          target === 'provider'
            ? `${(user as any).name || 'Provider'} headshot`
            : 'Clinic photo',
      },
      file: { data: buffer, mimetype: file.type, name: file.name || `upload-${Date.now()}`, size: file.size },
      overrideAccess: true,
    })
  } catch (err) {
    console.error('[dashboard/upload] media create failed:', err)
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })
  }

  try {
    if (target === 'provider') {
      await payload.update({
        collection: 'providers',
        id: linkedProvider!,
        data: { profilePhoto: media.id, profilePhotoUrl: media.url },
        overrideAccess: true,
      })
      return NextResponse.json({ url: media.url as string })
    }

    // clinic: enforce photo tier limit before creating Media
    const clinic = await payload.findByID({ collection: 'clinics', id: linkedClinic!, depth: 1, overrideAccess: true })
    const existing = Array.isArray((clinic as any).photos) ? (clinic as any).photos : []

    // Derive limit from the linked provider's tier (provider-level entitlement)
    if (linkedProvider) {
      const prov = await payload.findByID({ collection: 'providers', id: linkedProvider, depth: 0, overrideAccess: true })
      const tier = ((prov as any).subscriptionTier as Tier) || 'free'
      const maxPhotos = limits(tier).maxPhotos
      if (isFinite(maxPhotos) && existing.length >= maxPhotos) {
        return NextResponse.json(
          { error: `Your plan allows up to ${maxPhotos} clinic photos. Upgrade to add more.` },
          { status: 403 },
        )
      }
    }

    const existingIds = existing.map(relId).filter((n: number | undefined): n is number => !!n)
    const existingUrls = existing
      .map((p: any) => (p && typeof p === 'object' ? p.url : undefined))
      .filter((u: unknown): u is string => !!u)

    const photoIds = [...existingIds, Number(media.id)]
    const urls = [...existingUrls, media.url as string]

    await payload.update({
      collection: 'clinics',
      id: linkedClinic!,
      data: { photos: photoIds, clinicPhotoUrls: urls.map((url) => ({ url })) },
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
  if ((user as any).role !== 'provider') {
    return NextResponse.json({ error: 'Provider or clinic-owner account required.' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const target = String(body?.target || '')

  const linkedProvider = relId((user as any).linkedProvider)
  const linkedClinic = relId((user as any).linkedClinic)

  try {
    if (target === 'provider') {
      if (!linkedProvider) {
        return NextResponse.json({ error: 'No provider profile linked.' }, { status: 403 })
      }
      const provider = await payload.findByID({ collection: 'providers', id: linkedProvider, depth: 0, overrideAccess: true })
      const photoId = relId((provider as any).profilePhoto)
      await payload.update({
        collection: 'providers',
        id: linkedProvider,
        data: { profilePhoto: null, profilePhotoUrl: null },
        overrideAccess: true,
      })
      if (photoId) await payload.delete({ collection: 'media', id: photoId, overrideAccess: true }).catch(() => {})
      return NextResponse.json({ success: true })
    }

    if (target === 'clinic') {
      const mediaId = Number(body?.mediaId)
      if (!linkedClinic) return NextResponse.json({ error: 'No clinic linked.' }, { status: 403 })
      if (!mediaId) return NextResponse.json({ error: 'mediaId required.' }, { status: 400 })

      const clinic = await payload.findByID({ collection: 'clinics', id: linkedClinic, depth: 1, overrideAccess: true })
      const existing = Array.isArray((clinic as any).photos) ? (clinic as any).photos : []

      // Verify the requested mediaId actually belongs to this clinic before deleting (IDOR guard).
      const isOwned = existing.some((p: any) => relId(p) === mediaId)
      if (!isOwned) {
        return NextResponse.json({ error: 'Photo not found in your clinic.' }, { status: 404 })
      }

      const remaining = existing.filter((p: any) => relId(p) !== mediaId)
      const photoIds = remaining.map(relId).filter((n: any): n is number => !!n)
      const urls = remaining
        .map((p: any) => (p && typeof p === 'object' ? p.url : undefined))
        .filter((u: unknown): u is string => !!u)

      await payload.update({
        collection: 'clinics',
        id: linkedClinic,
        data: { photos: photoIds, clinicPhotoUrls: urls.map((url: string) => ({ url })) },
        overrideAccess: true,
      })
      await payload.delete({ collection: 'media', id: mediaId, overrideAccess: true }).catch(() => {})
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid target.' }, { status: 400 })
  } catch (err) {
    console.error('[dashboard/upload] delete failed:', err)
    return NextResponse.json({ error: 'Could not remove the photo. Please retry.' }, { status: 500 })
  }
}

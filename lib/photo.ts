import type { CollectionBeforeChangeHook } from 'payload'

/**
 * Media denormalization hooks (beforeChange).
 *
 * Providers gained `profilePhoto` (upload -> media) and Clinics gained `photos`
 * (upload -> media, hasMany). The file lives in the Media collection (on R2) and
 * the relationship is the source of truth. But the whole render layer reads the
 * legacy string fields (`profilePhotoUrl`, `clinicPhotoUrls[].url`) at many query
 * depths, several at depth 0 where a relationship is not populated.
 *
 * Instead of bumping depth on a dozen queries, these hooks copy the uploaded
 * file's public URL into the legacy string field IN THE SAME WRITE. So an upload
 * (from the dashboard OR the admin panel) renders everywhere with zero changes to
 * the read layer.
 *
 * Why beforeChange, not afterChange: writing the legacy field must NOT be a second
 * update of the same row. Updating a doc from within its own afterChange while the
 * first write's transaction is still open deadlocks on the row lock (the dashboard
 * upload would hang). beforeChange mutates `data` before the single write, so there
 * is no nested update and no deadlock. The media lookup here is a read, which is safe.
 *
 * Safe by design:
 *  - Fires only when the relationship field is part of THIS change (`data.profilePhoto`
 *    / `data.photos`). A normal profile save (bio, pricing, etc.) does not include it,
 *    so the legacy URL is left untouched. Imports set the legacy string directly (never
 *    the relationship), so existing data and the import pipeline are unaffected.
 */

async function mediaUrlById(req: any, id: number | string): Promise<string | undefined> {
  try {
    const m = await req.payload.findByID({ collection: 'media', id, depth: 0 })
    const url = (m as { url?: string } | null)?.url
    return url || undefined
  } catch {
    return undefined
  }
}

function relId(rel: unknown): number | string | undefined {
  if (rel == null) return undefined
  if (typeof rel === 'object') return (rel as { id?: number | string }).id
  return rel as number | string
}

/** Provider: when `profilePhoto` is set in this change, mirror its URL into `profilePhotoUrl`. */
export const denormalizeProviderPhoto: CollectionBeforeChangeHook = async ({ data, req }) => {
  if (!data || !('profilePhoto' in data)) return data
  const id = relId(data.profilePhoto)
  if (!id) return data // photo cleared elsewhere; leave the legacy URL as the caller set it
  const url = await mediaUrlById(req, id)
  if (url) data.profilePhotoUrl = url
  return data
}

/** Clinic: when `photos` is set in this change, mirror the URLs into `clinicPhotoUrls`. */
export const denormalizeClinicPhotos: CollectionBeforeChangeHook = async ({ data, req }) => {
  if (!data || !('photos' in data)) return data
  const rel = Array.isArray(data.photos) ? data.photos : []
  if (!rel.length) return data // gallery cleared elsewhere; leave clinicPhotoUrls as the caller set it
  const urls: string[] = []
  for (const p of rel) {
    const id = relId(p)
    if (!id) continue
    const url = await mediaUrlById(req, id)
    if (url) urls.push(url)
  }
  if (urls.length) data.clinicPhotoUrls = urls.map((url) => ({ url }))
  return data
}

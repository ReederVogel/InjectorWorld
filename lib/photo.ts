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
 *  - Fires only when the photo fields are part of THIS change (`data.profilePhoto`, or
 *    `data.photos` / `data.clinicPhotoUrls`). A normal profile save (bio, pricing, etc.)
 *    does not include them, so the legacy URLs are left untouched. Imports set the
 *    legacy string directly (never the relationship), so their URLs pass through as-is.
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

async function mediaUrls(req: any, rels: unknown): Promise<string[]> {
  const urls: string[] = []
  for (const p of Array.isArray(rels) ? rels : []) {
    const id = relId(p)
    const url = (p && typeof p === 'object' && (p as { url?: string }).url) || (id ? await mediaUrlById(req, id) : undefined)
    if (url) urls.push(url)
  }
  return urls
}

/**
 * Clinic: keep `clinicPhotoUrls` (the public gallery every page reads) in step
 * with uploaded `photos` WITHOUT losing the imported photos already in it.
 * A removed upload drops out, a new upload joins the end, every other URL stays.
 * It used to overwrite the list with the uploads alone, so an owner's first
 * upload wiped a clinic's imported gallery (2026-11-26).
 * Also keeps `hasPhoto` (listing order) true to the final list.
 */
export const denormalizeClinicPhotos: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  if (!data || !('photos' in data || 'clinicPhotoUrls' in data)) return data
  const source = 'clinicPhotoUrls' in data ? data.clinicPhotoUrls : originalDoc?.clinicPhotoUrls
  let list = (Array.isArray(source) ? source : []).map((p: { url?: string }) => p?.url).filter((u): u is string => !!u)
  if ('photos' in data) {
    const now = await mediaUrls(req, data.photos)
    const before = await mediaUrls(req, originalDoc?.photos)
    list = list.filter((u) => !before.includes(u) || now.includes(u))
    for (const u of now) if (!list.includes(u)) list.push(u)
  }
  data.clinicPhotoUrls = list.map((url) => ({ url }))
  data.hasPhoto = list.length > 0
  return data
}

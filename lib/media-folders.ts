import type { CollectionBeforeOperationHook, CollectionBeforeValidateHook, Payload } from 'payload'

/**
 * Where an uploaded file physically lands in the bucket.
 *
 * The cloud-storage plugin keys every object on the media document's own
 * `prefix` field (adapter passes `docPrefix: data.prefix`, getFileKey joins it
 * with the filename), so writing `prefix` in a beforeValidate hook is all it
 * takes to get one folder per article. See docs/MEDIA-FOLDERS-PLAN-2026-09-18.md.
 */

/** Lowercase, spaces and punctuation to single dashes, extension preserved. */
export function kebabFilename(name: string): string {
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
  const slug =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'file'
  return ext ? `${slug}.${ext}` : slug
}

/** "media/2026/09" for anything not attached to an article. */
function fallbackPrefix(now = new Date()): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `media/${now.getUTCFullYear()}/${month}`
}

type AttachedTo =
  | { relationTo: 'news' | 'guides'; value: number | string | { slug?: string } }
  | null
  | undefined

async function prefixFor(payload: Payload, attachedTo: AttachedTo): Promise<string> {
  if (!attachedTo || (attachedTo.relationTo !== 'news' && attachedTo.relationTo !== 'guides')) {
    return fallbackPrefix()
  }
  const raw = attachedTo.value
  let slug = typeof raw === 'object' && raw ? raw.slug : undefined
  if (!slug && (typeof raw === 'string' || typeof raw === 'number')) {
    try {
      const doc = await payload.findByID({
        collection: attachedTo.relationTo,
        id: raw,
        depth: 0,
        overrideAccess: true,
      })
      slug = (doc as { slug?: string })?.slug
    } catch {
      // Article lookup failed: fall back rather than throw. A file in the
      // wrong folder is recoverable; a failed upload loses the admin's work.
      return fallbackPrefix()
    }
  }
  return slug ? `${attachedTo.relationTo}/${slug}` : fallbackPrefix()
}

/** Cleans the incoming filename before generateFileData derives the size variants from it. */
export const kebabIncomingFilename: CollectionBeforeOperationHook = ({ args, operation }) => {
  if (operation !== 'create' && operation !== 'update') return args
  const file = (args.req as { file?: { name?: string } })?.file
  if (file?.name) file.name = kebabFilename(file.name)
  return args
}

/** Writes the per-document folder. Never changes it for a document that already has one. */
export const setMediaPrefix: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  if (!data) return data
  // HARD RULE 5: an existing file must keep its folder, or its url stops
  // resolving to a real object.
  if (originalDoc?.prefix) {
    data.prefix = originalDoc.prefix
    return data
  }
  data.prefix = await prefixFor(req.payload, data.attachedTo as AttachedTo)
  return data
}

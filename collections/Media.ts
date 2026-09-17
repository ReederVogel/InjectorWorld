import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'
import { kebabIncomingFilename, setMediaPrefix } from '@/lib/media-folders'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Media — the single upload collection for the whole site.
 *
 * Storage is decided in lib/storage.ts: when the R2_* env vars are set, every
 * file (original + each imageSize variant below) is uploaded to the
 * DigitalOcean Spaces bucket (the env vars keep their R2_* names, the adapter
 * is S3-compatible and the provider swap was env-only) and served from the
 * public bucket host, so uploads persist across deploys/restarts. With no keys
 * set it falls back to local disk under /media (gitignored) for development.
 *
 * Files land in one folder per article, chosen by the `attachedTo` field:
 * news/<slug>/ or guides/<slug>/, and media/<year>/<month>/ when nothing is
 * attached. Incoming filenames are kebab-cased first. See
 * docs/MEDIA-FOLDERS-PLAN-2026-09-18.md for the mechanism and the rule that an
 * existing document's prefix must never change.
 *
 * This collection powers:
 *   - Guide cover images (upload field on Guides)
 *   - Inline images inside the rich-text blog body (Lexical upload feature)
 *   - Any future provider / clinic / OG imagery
 */
export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    group: 'More',
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'alt', 'mimeType', 'filesize', 'updatedAt'],
    description: 'Upload images here. Drag and drop, or click to browse.',
  },
  access: {
    read: () => true,
    // Public reads (images are public). Writes are staff-only here; the provider
    // and clinic self-service uploads go through /api/dashboard/upload which
    // creates Media with overrideAccess after verifying the owner. This blocks
    // any other authenticated user (e.g. patients) from creating Media directly.
    create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    delete: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
  },
  upload: {
    staticDir: path.resolve(dirname, '../media'),
    mimeTypes: ['image/*'],
    focalPoint: true,
    adminThumbnail: 'thumbnail',
    // Responsive variants generated on upload. Originals are always kept.
    imageSizes: [
      { name: 'thumbnail', width: 320, height: 240, position: 'centre' },
      { name: 'card', width: 768, height: 512, position: 'centre' },
      { name: 'hero', width: 1600, height: 900, position: 'centre' },
      { name: 'og', width: 1200, height: 630, position: 'centre' },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description: 'Describe the image for screen readers and SEO. Required.',
      },
    },
    {
      name: 'attachedTo',
      type: 'relationship',
      relationTo: ['news', 'guides'],
      admin: {
        position: 'sidebar',
        description:
          'Which article this image belongs to. Sets the folder in storage: news/<slug>/ or guides/<slug>/. Save the article first, then upload its images. Left empty, the file goes to media/<year>/<month>/.',
      },
    },
    {
      name: 'caption',
      type: 'text',
      admin: {
        description: 'Optional caption shown beneath the image in articles.',
      },
    },
    {
      name: 'credit',
      type: 'text',
      admin: {
        description: 'Optional photo credit or source attribution.',
      },
    },
  ],
  hooks: {
    beforeOperation: [kebabIncomingFilename],
    beforeValidate: [setMediaPrefix],
  },
}

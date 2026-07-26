import type { CollectionAfterChangeHook, CollectionConfig } from 'payload'
import { insertInlineLink, removeInlineLink } from '../lib/internal-links/insert-link'
import { withDocLock } from '../lib/internal-links/doc-lock'

function resolveSource(doc: any): { collection: 'guides' | 'news' | null; id: number | null } {
  const rel = doc.source
  if (!rel || typeof rel !== 'object') return { collection: null, id: null }
  const raw = rel.value
  const id = raw == null ? null : typeof raw === 'object' ? raw.id : raw
  return { collection: rel.relationTo ?? null, id: id == null ? null : Number(id) }
}

/**
 * Applies (on approve) or reverts (on un-approve) the inline link in the source
 * Guide/News body.
 *
 * Two things here are load-bearing and easy to break:
 *
 * 1. Every nested Payload call passes `req`. Without it, each call opens its own
 *    transaction -- and a write to THIS suggestion's own row would then block
 *    forever waiting on the row lock held by the outer, still-uncommitted
 *    update that triggered this hook. That is a hard self-deadlock (verified:
 *    the operation never returns). Passing `req` joins the same transaction.
 *
 * 2. Body edits are read-modify-write, so they run inside withDocLock keyed on
 *    the source document, and are verified after writing. The lock releases
 *    when this hook returns, which is marginally before the outer transaction
 *    commits, so a second concurrent approval could still read a body without
 *    our link -- the post-write verification catches that and re-inserts.
 *    insertInlineLink is idempotent per URL, so retrying is always safe.
 *
 * Saving through payload.update bumps the source doc's updatedAt, which is what
 * feeds schema.org dateModified -- so approving a link refreshes the page's
 * "last modified" signal without touching its original publishedAt.
 */
const applyInternalLinkHook: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  const wasApproved = previousDoc?.status === 'approved'
  const isApproved = doc.status === 'approved'
  if (wasApproved === isApproved) return doc

  const { collection: sourceCollection, id: sourceId } = resolveSource(doc)
  if (!sourceCollection || !sourceId) {
    req.payload.logger.warn(`[internal-link-suggestions] missing source relation on suggestion ${doc.id}`)
    return doc
  }

  const setError = async (errorMessage: string | null) => {
    await req.payload.update({
      collection: 'internal-link-suggestions',
      id: doc.id,
      data: { errorMessage } as any,
      overrideAccess: true,
      req,
    })
  }

  const readSource = async () =>
    (await req.payload
      .findByID({ collection: sourceCollection, id: sourceId, depth: 0, overrideAccess: true, req })
      .catch(() => null)) as any

  /** One read-modify-write pass. Returns false if the body needed no change. */
  const applyOnce = async (): Promise<{ changed: boolean; reason?: string }> => {
    const sourceDoc = await readSource()
    if (!sourceDoc) return { changed: false, reason: 'Source document no longer exists.' }

    const existingLinks: any[] = Array.isArray(sourceDoc.internalLinks) ? sourceDoc.internalLinks : []

    if (isApproved) {
      const result = insertInlineLink(sourceDoc.body, {
        anchorText: doc.anchorText,
        url: doc.targetUrl,
        previewTitle: doc.targetTitle || doc.targetUrl,
        previewExcerpt: doc.targetExcerpt || undefined,
        previewType: doc.targetType || undefined,
      })
      if (!result.success) return { changed: false, reason: result.reason }

      await req.payload.update({
        collection: sourceCollection,
        id: sourceId,
        data: {
          body: result.body,
          internalLinks: [
            ...existingLinks.filter((l) => l?.targetPath !== doc.targetUrl),
            {
              anchorText: doc.anchorText,
              targetType: doc.targetType,
              targetSlug: doc.targetSlug,
              targetPath: doc.targetUrl,
              insertedAt: new Date().toISOString(),
            },
          ],
        } as any,
        overrideAccess: true,
        req,
      })
      return { changed: true }
    }

    const result = removeInlineLink(sourceDoc.body, doc.targetUrl)
    if (!result.success) return { changed: false, reason: result.reason }

    await req.payload.update({
      collection: sourceCollection,
      id: sourceId,
      data: {
        body: result.body,
        internalLinks: existingLinks.filter((l) => l?.targetPath !== doc.targetUrl),
      } as any,
      overrideAccess: true,
      req,
    })
    return { changed: true }
  }

  try {
    await withDocLock(`${sourceCollection}:${sourceId}`, async () => {
      const first = await applyOnce()

      if (isApproved) {
        if (!first.changed) {
          // insertInlineLink refuses when this URL is already linked, which is a
          // success state, not a failure. Only a genuine no-match is an error.
          const already = (await readSource())?.internalLinks?.some?.(
            (l: any) => l?.targetPath === doc.targetUrl,
          )
          if (already) {
            await setError(null)
            return
          }
          req.payload.logger.warn(
            `[internal-link-suggestions] insertion failed for suggestion ${doc.id}: ${first.reason}`,
          )
          await setError(first.reason ?? 'Insertion failed.')
          return
        }

        await req.payload.update({
          collection: 'internal-link-suggestions',
          id: doc.id,
          data: { insertedAt: new Date().toISOString(), errorMessage: null } as any,
          overrideAccess: true,
          req,
        })
        return
      }

      // Un-approved: nothing to remove is fine (link was never inserted).
      await req.payload.update({
        collection: 'internal-link-suggestions',
        id: doc.id,
        data: { insertedAt: null, errorMessage: null } as any,
        overrideAccess: true,
        req,
      })
    })
  } catch (err: any) {
    req.payload.logger.error(`[internal-link-suggestions] apply hook error: ${err?.message ?? err}`)
  }

  return doc
}

export const InternalLinkSuggestions: CollectionConfig = {
  slug: 'internal-link-suggestions',
  admin: {
    useAsTitle: 'anchorText',
    defaultColumns: ['source', 'anchorText', 'targetTitle', 'origin', 'status', 'createdAt'],
    group: 'Inbox',
    description:
      'Internal links awaiting review before insertion: editorial-seeded (from handoff content) or AI-discovered (Kimi K3 via OpenRouter). Approving inserts a real inline link into the source Guide/News body with a hover preview card.',
    components: {
      beforeList: ['/components/admin/list-headers/InternalLinkSuggestionsListHeader#InternalLinkSuggestionsListHeader'],
    },
  },
  access: {
    read: ({ req: { user } }) => !!(user && (user.role === 'admin' || user.role === 'editor')),
    // Only created by our own scan/seed scripts (overrideAccess) -- never via the public REST API.
    create: () => false,
    update: ({ req: { user } }) => !!(user && (user.role === 'admin' || user.role === 'editor')),
    delete: ({ req: { user } }) => !!(user && user.role === 'admin'),
  },
  fields: [
    {
      name: 'source',
      type: 'relationship',
      relationTo: ['guides', 'news'],
      required: true,
      admin: { description: 'The Guide or News article this link will be inserted into.' },
    },
    {
      name: 'anchorText',
      type: 'text',
      required: true,
      admin: { description: 'Exact substring that must appear verbatim in the source body -- this is what becomes the clickable link.' },
    },
    {
      name: 'targetType',
      type: 'select',
      options: [
        { label: 'Guide', value: 'guide' },
        { label: 'News', value: 'news' },
        { label: 'Service', value: 'service' },
        { label: 'Brand', value: 'brand' },
      ],
    },
    { name: 'targetSlug', type: 'text', required: true },
    { name: 'targetUrl', type: 'text', required: true },
    { name: 'targetTitle', type: 'text', admin: { description: 'Shown in the hover preview card.' } },
    { name: 'targetExcerpt', type: 'textarea', admin: { description: 'Shown in the hover preview card.' } },
    {
      name: 'reasoning',
      type: 'textarea',
      admin: { description: 'Why the agent (or editorial content) suggested this link -- shown to the admin reviewer for trust.' },
    },
    {
      name: 'origin',
      type: 'select',
      required: true,
      defaultValue: 'ai-discovery',
      options: [
        { label: 'Editorial-seeded (from handoff content)', value: 'editorial-seed' },
        { label: 'AI-discovered', value: 'ai-discovery' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending review', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
      access: {
        create: ({ req }) => !!(req.user?.role === 'admin' || req.user?.role === 'editor'),
        update: ({ req }) => !!(req.user?.role === 'admin' || req.user?.role === 'editor'),
      },
    },
    {
      name: 'insertedAt',
      type: 'date',
      admin: { readOnly: true, description: 'Set automatically once the link is actually inserted into the body.' },
    },
    {
      name: 'errorMessage',
      type: 'text',
      admin: { readOnly: true, description: 'Set if approval succeeded but insertion failed (e.g. anchor text no longer matches the body).' },
    },
  ],
  hooks: {
    afterChange: [applyInternalLinkHook],
  },
  timestamps: true,
}

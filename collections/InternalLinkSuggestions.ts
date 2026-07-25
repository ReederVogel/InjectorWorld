import type { CollectionAfterChangeHook, CollectionConfig } from 'payload'
import { insertInlineLink } from '../lib/internal-links/insert-link'

// Only fires when status transitions to 'approved' for the first time -- inserts
// the link into the source Guide/News's actual body (real inline anchor, not a
// separate block), then saves the source doc via payload.update, which bumps its
// own updatedAt automatically. Also appends a summary entry to the source doc's
// internalLinks field so the Content Report can count/show it without re-parsing body.
const approveInternalLinkHook: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  if (doc.status !== 'approved') return doc
  if (previousDoc?.status === 'approved') return doc

  try {
    const sourceRel = doc.source
    const sourceCollection: 'guides' | 'news' | undefined =
      sourceRel && typeof sourceRel === 'object' ? sourceRel.relationTo : undefined
    const sourceIdRaw = sourceRel && typeof sourceRel === 'object' ? sourceRel.value : undefined
    const sourceId = sourceIdRaw == null ? null : typeof sourceIdRaw === 'object' ? sourceIdRaw.id : sourceIdRaw

    if (!sourceCollection || !sourceId) {
      req.payload.logger.warn(`[internal-link-suggestions] approve: missing source relation on suggestion ${doc.id}`)
      return doc
    }

    const sourceDoc = await req.payload.findByID({
      collection: sourceCollection,
      id: sourceId,
      depth: 0,
      overrideAccess: true,
    }).catch(() => null) as any

    if (!sourceDoc) {
      await req.payload.update({
        collection: 'internal-link-suggestions',
        id: doc.id,
        data: { errorMessage: 'Source document no longer exists.' },
        overrideAccess: true,
      })
      return doc
    }

    const result = insertInlineLink(sourceDoc.body, {
      anchorText: doc.anchorText,
      url: doc.targetUrl,
      previewTitle: doc.targetTitle || doc.targetUrl,
      previewExcerpt: doc.targetExcerpt || undefined,
      previewType: doc.targetType || undefined,
    })

    if (!result.success) {
      req.payload.logger.warn(`[internal-link-suggestions] insertion failed for suggestion ${doc.id}: ${result.reason}`)
      await req.payload.update({
        collection: 'internal-link-suggestions',
        id: doc.id,
        data: { errorMessage: result.reason },
        overrideAccess: true,
      })
      return doc
    }

    const existingLinks = Array.isArray(sourceDoc.internalLinks) ? sourceDoc.internalLinks : []
    await req.payload.update({
      collection: sourceCollection,
      id: sourceId,
      data: {
        body: result.body,
        internalLinks: [
          ...existingLinks,
          {
            anchorText: doc.anchorText,
            targetType: doc.targetType,
            targetSlug: doc.targetSlug,
            targetPath: doc.targetUrl,
            insertedAt: new Date().toISOString(),
          },
        ],
      },
      overrideAccess: true,
    })

    await req.payload.update({
      collection: 'internal-link-suggestions',
      id: doc.id,
      data: { insertedAt: new Date().toISOString(), errorMessage: null },
      overrideAccess: true,
    })
  } catch (err: any) {
    req.payload.logger.error(`[internal-link-suggestions] approve hook error: ${err?.message ?? err}`)
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
    afterChange: [approveInternalLinkHook],
  },
  timestamps: true,
}

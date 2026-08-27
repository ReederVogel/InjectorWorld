import type { CollectionConfig } from 'payload'
import { PAGE_TYPES, PAGE_TYPE_LABELS, thresholdFor, INDEX_THRESHOLDS } from '../lib/markets'

/**
 * One row per URL the site publishes. This is THE registry: meta robots and the
 * sitemap both resolve off `indexed` here, for every page type, so there is a
 * single place to see and control what Google is allowed to index.
 *
 * Two independent gates decide `indexed`:
 *
 *  - `publishable` (HARD, non-overridable, written by the scan). Is there
 *    something real to show? For an entity page that means the source doc is
 *    published/approved; for a computed page it means at least one published
 *    clinic matches. A row can never be indexed while this is false, which is
 *    what stops a draft or emptied page from leaking into the sitemap.
 *  - `indexMode` (SOFT, the admin's decision). `queued` by default: the URL
 *    exists, is crawlable, and is waiting for a human to batch it in. Nothing
 *    indexes itself.
 *
 * `meetsThreshold` is advisory only -- it reports whether the row clears its
 * per-type bar in `INDEX_THRESHOLDS`, which is how the batch tool picks
 * candidates by default. It does NOT block indexing, so a deliberately-chosen
 * thin page can still be batched.
 *
 * Written by `lib/page-index/scan-pages.ts` (the admin "Run page scan" button
 * or `npm run scan:pages`). Read by `lib/page-index/queries.ts`.
 *
 * History: until 2026-08-08 `indexMode` defaulted to `auto` and a page indexed
 * itself once it passed a single sitewide clinic count. Founder reversed that in
 * favour of manual batch rollout -- see docs/DECISIONS.md 2026-08-08.
 */
export const PageIndex: CollectionConfig = {
  slug: 'page-index',
  labels: { singular: 'URL', plural: 'URLs' },
  admin: {
    useAsTitle: 'path',
    defaultColumns: ['path', 'pageType', 'indexMode', 'indexed', 'publishable', 'dataCount', 'meetsThreshold', 'updatedAt'],
    group: 'SEO',
    description:
      'Every URL on the site. Nothing reaches Google until someone submits it from Content indexing or Indexing -- new rows arrive as Not submitted, which means search engines may crawl the page but are told not to list it.',
    listSearchableFields: ['path', 'serviceSlug', 'brandSlug', 'stateSlug', 'citySlug'],
    pagination: { defaultLimit: 50 },
    components: {
      beforeList: ['/components/admin/list-headers/PageIndexListHeader#PageIndexListHeader'],
    },
  },
  access: {
    read: ({ req }) => req.user?.role === 'admin' || req.user?.role === 'editor',
    create: ({ req }) => req.user?.role === 'admin' || req.user?.role === 'editor',
    update: ({ req }) => req.user?.role === 'admin' || req.user?.role === 'editor',
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    {
      name: 'pageKey',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description: 'Stable key set by the scan (computed: type:service:state:city, entity: type:docId). Not hand-editable.',
      },
    },
    {
      name: 'path',
      type: 'text',
      required: true,
      index: true,
      admin: { readOnly: true, description: 'The live URL this row controls.' },
    },
    {
      name: 'pageType',
      type: 'select',
      required: true,
      index: true,
      admin: { readOnly: true },
      // Generated from PAGE_TYPE_LABELS so this list cannot drift from what the
      // Content and Indexing screens call the same page type. It used to be a
      // hand-written copy, which is how one option ended up reading
      // "Service x city (money page)" here and something else everywhere else.
      options: PAGE_TYPES.map((value) => ({ value, label: PAGE_TYPE_LABELS[value] })),
    },

    // ── Indexing decision ────────────────────────────────────────────────────
    {
      name: 'indexMode',
      type: 'select',
      required: true,
      defaultValue: 'queued',
      index: true,
      label: 'In Google',
      admin: {
        description:
          'Not submitted (default): search engines can crawl the page but are told not to list it, and it is waiting for a batch. Submitted: it goes into the sitemap as soon as it is live on the site. Never submit: held back permanently, and the batch tools skip it.',
      },
      options: [
        { label: 'Not submitted yet', value: 'queued' },
        { label: 'Submitted to Google', value: 'indexed' },
        { label: 'Never submit', value: 'excluded' },
      ],
    },
    {
      name: 'indexed',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      label: 'Actually in the sitemap',
      admin: {
        readOnly: true,
        description: 'The answer both the page tag and the sitemap use. Only true when someone submitted it AND it is live on the site.',
      },
    },
    {
      name: 'publishable',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      label: 'Live on site',
      admin: {
        readOnly: true,
        description:
          'Is there anything real to show here? For a clinic, guide or article: the document is published (and approved). For a listing page: at least one published clinic matches it. Written by the scan. When this is false the page stays out of Google no matter what anyone sets above.',
      },
    },
    {
      name: 'meetsThreshold',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      label: 'Enough clinics',
      admin: {
        readOnly: true,
        description: `Does this page have enough behind it to be worth a search result? Bar per page type: ${Object.entries(INDEX_THRESHOLDS)
          .map(([k, v]) => `${k} ${v}`)
          .join(', ')}. Advice only, not a block: a thin page can still be submitted on purpose.`,
      },
    },
    {
      name: 'indexedAt',
      type: 'date',
      admin: { readOnly: true, description: 'When this URL was batched in. Empty while queued or excluded.' },
    },
    {
      name: 'batchLabel',
      type: 'text',
      index: true,
      admin: {
        readOnly: true,
        description: 'Which batch flipped this row to Indexed. Filter on it to review or roll back one batch.',
      },
    },

    // ── Source ───────────────────────────────────────────────────────────────
    {
      name: 'sourceCollection',
      type: 'text',
      index: true,
      admin: { readOnly: true, description: 'For entity pages: the collection the URL comes from. Empty for computed pages.' },
    },
    {
      name: 'sourceId',
      type: 'text',
      index: true,
      admin: { readOnly: true, description: 'For entity pages: the source document id, so this row links back to the doc.' },
    },
    { name: 'serviceSlug', type: 'text', index: true, admin: { readOnly: true } },
    { name: 'brandSlug', type: 'text', index: true, admin: { readOnly: true } },
    { name: 'stateSlug', type: 'text', index: true, admin: { readOnly: true } },
    { name: 'citySlug', type: 'text', index: true, admin: { readOnly: true } },

    // ── Data volume ──────────────────────────────────────────────────────────
    {
      name: 'dataCount',
      type: 'number',
      defaultValue: 0,
      index: true,
      admin: {
        readOnly: true,
        description: 'Published clinics matching this page at the last scan. Entity pages carry 1 (they are gated by publish status, not volume).',
      },
    },
    { name: 'hasData', type: 'checkbox', defaultValue: false, admin: { readOnly: true } },

    // ── Triage ───────────────────────────────────────────────────────────────
    {
      name: 'acknowledged',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: {
        description:
          'Triage flag. Newly discovered URLs land unacknowledged so they show up as "new since you last looked". Batching a row in or excluding it acknowledges it automatically; you can also acknowledge to mean "seen, leaving it queued for now".',
      },
    },
    { name: 'firstSeenWithData', type: 'date', admin: { readOnly: true } },
    { name: 'lastScannedAt', type: 'date', admin: { readOnly: true } },
  ],
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        // Partial updates (an admin flipping just indexMode) arrive with only
        // the changed keys in `data`, so every input has to fall back to the
        // stored doc or the resolution below would read undefined and silently
        // noindex the row.
        const pick = <T,>(key: string): T | undefined =>
          (data?.[key] ?? originalDoc?.[key]) as T | undefined

        const count = Number(pick<number>('dataCount') ?? 0)
        const pageType = String(pick<string>('pageType') ?? '')
        const publishable = pick<boolean>('publishable') === true
        const mode = String(pick<string>('indexMode') ?? 'queued')

        data.hasData = count > 0
        data.meetsThreshold = count >= thresholdFor(pageType)
        data.indexed = mode === 'indexed' && publishable

        // Stamp/clear indexedAt on the transition, not on every write, so the
        // date keeps meaning "when we let Google have this URL".
        const wasIndexedMode = String(originalDoc?.indexMode ?? '') === 'indexed'
        if (mode === 'indexed' && !wasIndexedMode) {
          data.indexedAt = data.indexedAt ?? new Date().toISOString()
        } else if (mode !== 'indexed') {
          data.indexedAt = null
          data.batchLabel = null
        }

        // Deciding either way is triage.
        if (mode !== 'queued' && data.indexMode !== undefined) data.acknowledged = true

        return data
      },
    ],
  },
  timestamps: true,
}

// Re-exported so the scan and the batch API cannot drift from the collection's
// own idea of what a valid page type is.
export const PAGE_INDEX_TYPES = PAGE_TYPES

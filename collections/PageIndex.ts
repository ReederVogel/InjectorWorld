import type { CollectionConfig } from 'payload'
import { PAGE_TYPES, thresholdFor, INDEX_THRESHOLDS } from '../lib/markets'

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
      'Every URL on the site. Nothing is indexed until it is batched in from the Indexing screen -- new rows land as Queued and stay noindex (but crawlable).',
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
      options: [
        { label: 'Service pillar', value: 'service-pillar' },
        { label: 'Service × state', value: 'service-state' },
        { label: 'Service × city (money page)', value: 'service-city' },
        { label: 'State hub', value: 'state-hub' },
        { label: 'City hub', value: 'city-hub' },
        { label: 'Brand pillar', value: 'brand-pillar' },
        { label: 'Brand × state', value: 'brand-state' },
        { label: 'Brand × city', value: 'brand-city-directory' },
        { label: 'Clinic profile', value: 'clinic' },
        { label: 'Guide', value: 'guide' },
        { label: 'News article', value: 'news' },
        { label: 'Static page', value: 'static' },
        { label: 'Provider profile', value: 'provider' },
        { label: 'Question', value: 'question' },
      ],
    },

    // ── Indexing decision ────────────────────────────────────────────────────
    {
      name: 'indexMode',
      type: 'select',
      required: true,
      defaultValue: 'queued',
      index: true,
      admin: {
        description:
          'Queued (default) = crawlable but noindex, waiting for a batch. Indexed = batched in, and indexes as soon as it is publishable. Excluded = never index, and the batch tool skips it.',
      },
      options: [
        { label: 'Queued (noindex, awaiting batch)', value: 'queued' },
        { label: 'Indexed (batched in)', value: 'indexed' },
        { label: 'Excluded (never index)', value: 'excluded' },
      ],
    },
    {
      name: 'indexed',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: {
        readOnly: true,
        description: 'Resolved decision used by the page meta tag and the sitemap. True only when indexMode is Indexed AND publishable.',
      },
    },
    {
      name: 'publishable',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: {
        readOnly: true,
        description:
          'Hard gate, written by the scan. Entity pages: source doc is published/approved. Computed pages: at least one published clinic matches. False here forces noindex no matter what indexMode says.',
      },
    },
    {
      name: 'meetsThreshold',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: {
        readOnly: true,
        description: `Advisory only: does dataCount clear this page type's bar? Thresholds: ${Object.entries(INDEX_THRESHOLDS)
          .map(([k, v]) => `${k} ${v}`)
          .join(', ')}. Below-threshold rows can still be batched deliberately.`,
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

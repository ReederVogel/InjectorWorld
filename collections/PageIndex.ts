import type { CollectionConfig } from 'payload'

/**
 * One row per auto-generated service/location page that has (or had) real data.
 *
 * The page scan (`lib/page-index/scan-pages.ts`, run by the admin button or
 * `npm run scan:pages`) walks the clinic data and upserts a row here whenever a
 * service+location combination has at least one published clinic. Empty pages
 * get NO row, so they are noindex by default.
 *
 * - `dataCount` / `hasData` are written by the scan (read-only in admin).
 * - `indexMode` is the admin override: 'auto' follows the data, or force on/off.
 * - `indexed` is the resolved decision (computed in beforeChange) read by
 *   generateMetadata and the sitemap.
 * - `acknowledged=false` rows are the "new page" notification feed on the dashboard.
 *
 * Rows are only created for LIVE markets, so coming-soon states never get indexed
 * here even if a clinic exists there.
 */
export const PageIndex: CollectionConfig = {
  slug: 'page-index',
  admin: {
    useAsTitle: 'path',
    defaultColumns: ['path', 'pageType', 'dataCount', 'indexed', 'indexMode', 'acknowledged', 'updatedAt'],
    group: 'Site Settings',
    description: 'Every service/location page that has data. A page is indexed when it has data; flip indexMode to override per page.',
    listSearchableFields: ['path', 'serviceSlug', 'stateSlug', 'citySlug'],
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
      admin: { readOnly: true, description: 'Stable key set by the scan (type:service:state:city). Not hand-editable.' },
    },
    { name: 'path', type: 'text', required: true, index: true, admin: { readOnly: true, description: 'The live URL this row controls.' } },
    {
      name: 'pageType',
      type: 'select',
      required: true,
      admin: { readOnly: true },
      options: [
        { label: 'Service pillar', value: 'service-pillar' },
        { label: 'Service × state', value: 'service-state' },
        { label: 'Service × city (money page)', value: 'service-city' },
        { label: 'State hub', value: 'state-hub' },
        { label: 'City hub', value: 'city-hub' },
      ],
    },
    { name: 'serviceSlug', type: 'text', admin: { readOnly: true } },
    { name: 'stateSlug', type: 'text', admin: { readOnly: true } },
    { name: 'citySlug', type: 'text', admin: { readOnly: true } },
    { name: 'dataCount', type: 'number', defaultValue: 0, admin: { readOnly: true, description: 'Published clinics matching this page at the last scan.' } },
    { name: 'hasData', type: 'checkbox', defaultValue: false, admin: { readOnly: true } },
    {
      name: 'indexMode',
      type: 'select',
      required: true,
      defaultValue: 'auto',
      admin: { description: 'Auto = index when it has data. Force index / Force noindex override that.' },
      options: [
        { label: 'Auto (index if it has data)', value: 'auto' },
        { label: 'Force index', value: 'force-index' },
        { label: 'Force noindex', value: 'force-noindex' },
      ],
    },
    { name: 'indexed', type: 'checkbox', defaultValue: false, admin: { readOnly: true, description: 'Resolved decision used by the page + sitemap.' } },
    {
      name: 'acknowledged',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'New pages start unacknowledged and appear in the dashboard notification. Acknowledge to clear it.' },
    },
    { name: 'firstSeenWithData', type: 'date', admin: { readOnly: true } },
    { name: 'lastScannedAt', type: 'date', admin: { readOnly: true } },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        const count = Number(data?.dataCount ?? 0)
        data.hasData = count > 0
        data.indexed =
          data.indexMode === 'force-index'
            ? true
            : data.indexMode === 'force-noindex'
              ? false
              : data.hasData
        return data
      },
    ],
  },
  timestamps: true,
}

import type { CollectionConfig } from 'payload'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-hook'

export const Locations: CollectionConfig = {
  slug: 'locations',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'kind', 'state', 'isLive', 'noindex', 'providerCount'],
    listSearchableFields: ['name', 'state'],
    group: 'More',
    description: 'States, metros, cities, and neighborhoods. "Market is live" is computed automatically by the page scan. Use the "Hide from search engines" sidebar toggle to control indexing manually.',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    { name: 'name', type: 'text', required: true, index: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: [
        { label: 'Country', value: 'country' },
        { label: 'State', value: 'state' },
        { label: 'Metro', value: 'metro' },
        { label: 'City', value: 'city' },
        { label: 'Neighborhood', value: 'neighborhood' },
      ],
    },
    { name: 'state', type: 'text', maxLength: 2, admin: { description: '2-letter state code.' } },
    { name: 'parent', type: 'relationship', relationTo: 'locations' },
    { name: 'latitude', type: 'number' },
    { name: 'longitude', type: 'number' },
    { name: 'imageUrl', type: 'text' },
    { name: 'providerCount', type: 'number', defaultValue: 0 },
    { name: 'sortRank', type: 'number', defaultValue: 999 },
    { name: 'featured', type: 'checkbox', defaultValue: false },
    {
      name: 'isLive',
      label: 'Market is live',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description:
          'Computed automatically by `npm run scan:pages` based on whether this market has >=1 published clinic. Not editable here -- any manual change would be overwritten on the next scan.',
      },
    },
    {
      name: 'noindex',
      label: 'Skip build pre-render',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description:
          'BUILD BUDGET ONLY -- the name is historical. When checked, this market\'s hub page is left out of the pages pre-rendered at build time (it still renders on demand). The old description claimed it also excluded the page from sitemap.xml; that was never true -- state and city hub urls come from the url registry. Indexing is controlled entirely in SEO > URLs.',
      },
    },
  ],
  hooks: {
    afterChange: [revalidateAfterChange],
    afterDelete: [revalidateAfterDelete],
  },
  timestamps: true,
}

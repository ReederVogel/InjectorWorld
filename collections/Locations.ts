import type { CollectionConfig } from 'payload'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-hook'

export const Locations: CollectionConfig = {
  slug: 'locations',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'kind', 'state', 'isLive', 'noindex', 'providerCount'],
    group: 'Catalog',
  },
  access: { read: () => true },
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
        description:
          'ON = this state/city is a launched market (normal directory). OFF = renders as "coming soon" with a waitlist. Default OFF.',
      },
    },
    {
      name: 'noindex',
      label: 'Hide from search engines (noindex)',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description:
          'ON = search engines do not index this page (and it is excluded from sitemap.xml). Default ON so thin "coming soon" pages avoid an SEO penalty. Turn OFF for live markets.',
      },
    },
  ],
  hooks: {
    afterChange: [revalidateAfterChange],
    afterDelete: [revalidateAfterDelete],
  },
  timestamps: true,
}

import type { CollectionConfig } from 'payload'

export const Promotions: CollectionConfig = {
  slug: 'promotions',
  admin: {
    useAsTitle: 'notes',
    defaultColumns: ['provider', 'scopeType', 'rank', 'active', 'endDate'],
    group: 'Commercial',
  },
  access: { read: () => true },
  fields: [
    {
      name: 'provider',
      type: 'relationship',
      relationTo: 'providers',
      required: true,
      admin: { description: 'The provider this paid slot promotes.' },
    },
    {
      name: 'scopeType',
      type: 'select',
      required: true,
      options: [
        { label: 'Treatment (sitewide)', value: 'treatment' },
        { label: 'State', value: 'state' },
        { label: 'City', value: 'city' },
        { label: 'Treatment + State', value: 'treatment+state' },
        { label: 'Treatment + City (most targeted)', value: 'treatment+city' },
        { label: 'Body Area', value: 'body-area' },
      ],
      admin: { description: 'Where this sponsored slot appears.' },
    },
    {
      name: 'treatmentScope',
      type: 'relationship',
      relationTo: 'treatments',
      admin: {
        description: 'Required when scope includes a treatment.',
        condition: (data) =>
          ['treatment', 'treatment+state', 'treatment+city'].includes(data.scopeType),
      },
    },
    {
      name: 'locationScope',
      type: 'relationship',
      relationTo: 'locations',
      admin: {
        description: 'Required when scope includes a state or city.',
        condition: (data) =>
          ['state', 'city', 'treatment+state', 'treatment+city'].includes(data.scopeType),
      },
    },
    {
      name: 'bodyAreaScope',
      type: 'text',
      admin: {
        description: 'Body area slug (e.g. "forehead"). Required when scope = body-area.',
        condition: (data) => data.scopeType === 'body-area',
      },
    },
    {
      name: 'rank',
      type: 'number',
      defaultValue: 1,
      min: 1,
      max: 3,
      admin: { description: 'Slot position 1, 2, or 3. Max 3 sponsored per page.' },
    },
    { name: 'startDate', type: 'date' },
    {
      name: 'endDate',
      type: 'date',
      admin: { description: 'Auto-expires after this date. Leave blank for no expiry.' },
    },
    { name: 'active', type: 'checkbox', defaultValue: true },
    {
      name: 'notes',
      type: 'text',
      admin: { description: 'Internal label. E.g. "Botox NYC — Q3 2026 campaign".' },
    },
  ],
  timestamps: true,
}

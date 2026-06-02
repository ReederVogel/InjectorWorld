import type { CollectionConfig } from 'payload'

export const Treatments: CollectionConfig = {
  slug: 'treatments',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'category', 'updatedAt'],
    group: 'Catalog',
  },
  access: { read: () => true },
  fields: [
    { name: 'name', type: 'text', required: true, index: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    {
      name: 'category',
      type: 'select',
      required: true,
      options: [
        { label: 'Neurotoxin', value: 'neurotoxin' },
        { label: 'Filler', value: 'filler' },
        { label: 'Biostimulator', value: 'biostimulator' },
        { label: 'Skin', value: 'skin' },
        { label: 'Thread', value: 'thread' },
        { label: 'Body', value: 'body' },
        { label: 'Other', value: 'other' },
      ],
    },
    { name: 'tagline', type: 'text', maxLength: 100 },
    { name: 'shortDescription', type: 'textarea' },
    {
      name: 'bodyAreas',
      type: 'select',
      hasMany: true,
      options: [
        'forehead', 'brow', 'under-eye', 'crows-feet', 'cheeks',
        'lips', 'chin', 'jawline', 'neck', 'decolletage',
      ].map((v) => ({ label: v, value: v })),
    },
    { name: 'avgPriceFromUsd', type: 'number' },
    { name: 'avgPriceToUsd', type: 'number' },
    { name: 'priceUnit', type: 'select', options: [
      { label: 'Per unit', value: 'per_unit' },
      { label: 'Per session', value: 'per_session' },
      { label: 'Per syringe', value: 'per_syringe' },
    ]},
    { name: 'iconSlug', type: 'text', admin: { description: 'Phosphor icon slug.' } },
    {
      name: 'guide',
      type: 'relationship',
      relationTo: 'guides',
      admin: { description: 'Pillar guide for this treatment.' },
    },
  ],
  timestamps: true,
}

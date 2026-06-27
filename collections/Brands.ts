import type { CollectionConfig } from 'payload'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-hook'

export const Brands: CollectionConfig = {
  slug: 'brands',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'category', 'manufacturer', 'updatedAt'],
    group: 'Content',
    description:
      'Aesthetic product brands (e.g., Botox, Juvederm, Dysport, Daxxify). Clinics list which brands they carry via brandsOffered. Each brand gets its own /brands/[slug] path.',
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
      name: 'manufacturer',
      type: 'text',
      admin: { description: 'e.g. Allergan Aesthetics, Galderma, Merz, Revance' },
    },
    {
      name: 'category',
      type: 'select',
      required: true,
      options: [
        { label: 'Neurotoxin',    value: 'neurotoxin' },
        { label: 'Filler',        value: 'filler' },
        { label: 'Biostimulator', value: 'biostimulator' },
        { label: 'Skin',          value: 'skin' },
        { label: 'Body',          value: 'body' },
        { label: 'Other',         value: 'other' },
      ],
    },
    { name: 'tagline', type: 'text', maxLength: 100 },
    { name: 'shortDescription', type: 'textarea' },
    {
      name: 'guide',
      type: 'relationship',
      relationTo: 'guides',
      admin: { description: 'Pillar guide for this brand.' },
    },
    { name: 'avgPriceFromUsd', type: 'number' },
    { name: 'avgPriceToUsd', type: 'number' },
    {
      name: 'priceUnit',
      type: 'select',
      options: [
        { label: 'Per unit',    value: 'per_unit' },
        { label: 'Per session', value: 'per_session' },
        { label: 'Per syringe', value: 'per_syringe' },
      ],
    },
    { name: 'iconSlug', type: 'text', admin: { description: 'Phosphor icon slug.' } },
    { name: 'longevityLabel', type: 'text', admin: { description: 'e.g. "3 to 4 months"' } },
    { name: 'longevityMonthsMin', type: 'number' },
    { name: 'longevityMonthsMax', type: 'number' },
    { name: 'downtimeLabel', type: 'text', admin: { description: 'e.g. "0 to 24 hours"' } },
    { name: 'downtimeHoursMax', type: 'number' },
    { name: 'websiteUrl', type: 'text' },
    { name: 'logoUrl', type: 'text' },
  ],
  hooks: {
    afterChange: [revalidateAfterChange],
    afterDelete: [revalidateAfterDelete],
  },
  timestamps: true,
}

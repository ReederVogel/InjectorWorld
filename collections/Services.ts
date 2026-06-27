import type { CollectionConfig } from 'payload'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-hook'

export const Services: CollectionConfig = {
  slug: 'services',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'category', 'updatedAt'],
    group: 'Content',
    description:
      'Aesthetic service areas (e.g., Lip Filler, Cheek Filler, Masseter Botox). Clinics list which services they offer via servicesOffered. Each service gets its own /services/[slug] path.',
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
      name: 'category',
      type: 'select',
      required: true,
      options: [
        { label: 'Body Area', value: 'body-area' },
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
        { label: 'Forehead',    value: 'forehead' },
        { label: 'Brow',        value: 'brow' },
        { label: 'Under Eye',   value: 'under-eye' },
        { label: "Crow's Feet", value: 'crows-feet' },
        { label: 'Cheeks',      value: 'cheeks' },
        { label: 'Lips',        value: 'lips' },
        { label: 'Chin',        value: 'chin' },
        { label: 'Jawline',     value: 'jawline' },
        { label: 'Neck',        value: 'neck' },
        { label: 'Décolletage', value: 'decolletage' },
      ],
    },
    {
      name: 'relatedBrands',
      type: 'relationship',
      relationTo: 'brands',
      hasMany: true,
      admin: {
        description: 'Product brands commonly used for this service (e.g., Lip Filler → Juvederm, Sculptra).',
      },
    },
    {
      name: 'guide',
      type: 'relationship',
      relationTo: 'guides',
      admin: { description: 'Pillar guide for this service.' },
    },
    { name: 'avgPriceFromUsd', type: 'number' },
    { name: 'avgPriceToUsd', type: 'number' },
    {
      name: 'priceUnit',
      type: 'select',
      options: [
        { label: 'Per unit',     value: 'per_unit' },
        { label: 'Per session',  value: 'per_session' },
        { label: 'Per syringe',  value: 'per_syringe' },
      ],
    },
    { name: 'iconSlug', type: 'text', admin: { description: 'Phosphor icon slug.' } },
    { name: 'painIndex', type: 'number', min: 0, max: 10, admin: { description: '0 (none) to 10 (severe).' } },
    { name: 'longevityLabel', type: 'text', admin: { description: 'e.g. "3 to 4 months"' } },
    { name: 'longevityMonthsMin', type: 'number' },
    { name: 'longevityMonthsMax', type: 'number' },
    { name: 'downtimeLabel', type: 'text', admin: { description: 'e.g. "0 to 24 hours"' } },
    { name: 'downtimeHoursMax', type: 'number' },
  ],
  hooks: {
    afterChange: [revalidateAfterChange],
    afterDelete: [revalidateAfterDelete],
  },
  timestamps: true,
}

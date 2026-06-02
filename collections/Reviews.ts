import type { CollectionConfig } from 'payload'

export const Reviews: CollectionConfig = {
  slug: 'reviews',
  admin: {
    useAsTitle: 'reviewTitle',
    defaultColumns: ['reviewTitle', 'rating', 'treatmentTag', 'reviewDate', 'verified', 'sourcePlatform'],
    group: 'Directory',
  },
  access: { read: () => true },
  fields: [
    { name: 'reviewId', type: 'text', required: true, unique: true, index: true },
    { name: 'provider', type: 'relationship', relationTo: 'providers' },
    { name: 'clinic', type: 'relationship', relationTo: 'clinics', required: true },
    { name: 'reviewerFirstName', type: 'text' },
    { name: 'reviewerInitial', type: 'text', maxLength: 2 },
    { name: 'reviewerAgeRange', type: 'text' },
    { name: 'reviewerCity', type: 'text' },
    { name: 'rating', type: 'number', required: true, min: 1, max: 5 },
    { name: 'reviewTitle', type: 'text' },
    { name: 'reviewText', type: 'textarea', required: true },
    { name: 'treatmentTag', type: 'text' },
    { name: 'reviewDate', type: 'date', required: true },
    {
      name: 'sourcePlatform',
      type: 'select',
      required: true,
      options: ['google', 'yelp', 'healthgrades', 'vitals', 'zocdoc', 'clinic_site', 'injectors_world']
        .map((v) => ({ label: v, value: v })),
    },
    { name: 'sourceUrl', type: 'text', required: true },
    { name: 'responseFromProvider', type: 'textarea' },
    { name: 'responseDate', type: 'date' },
    { name: 'verified', type: 'checkbox', defaultValue: true },
    { name: 'featured', type: 'checkbox', defaultValue: false },
  ],
  timestamps: true,
}

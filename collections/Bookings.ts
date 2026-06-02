import type { CollectionConfig } from 'payload'

export const Bookings: CollectionConfig = {
  slug: 'bookings',
  admin: {
    useAsTitle: 'patientName',
    defaultColumns: ['patientName', 'status', 'provider', 'treatmentTag', 'preferredDate'],
    group: 'Operations',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => true,
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    { name: 'patientName', type: 'text', required: true },
    { name: 'patientEmail', type: 'email', required: true },
    { name: 'patientPhone', type: 'text' },
    { name: 'provider', type: 'relationship', relationTo: 'providers' },
    { name: 'clinic', type: 'relationship', relationTo: 'clinics' },
    { name: 'treatment', type: 'relationship', relationTo: 'treatments' },
    { name: 'treatmentTag', type: 'text' },
    { name: 'preferredDate', type: 'date' },
    { name: 'preferredTime', type: 'text' },
    { name: 'message', type: 'textarea' },
    { name: 'consentToContact', type: 'checkbox', required: true, defaultValue: false },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Confirmed', value: 'confirmed' },
        { label: 'Completed', value: 'completed' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'No-show', value: 'no_show' },
      ],
    },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'website',
      options: [
        { label: 'Website', value: 'website' },
        { label: 'Hero search', value: 'hero_search' },
        { label: 'Provider profile', value: 'provider_profile' },
        { label: 'Guide CTA', value: 'guide_cta' },
        { label: 'Lead form', value: 'lead_form' },
      ],
    },
    { name: 'utm', type: 'json' },
    { name: 'notes', type: 'textarea', admin: { description: 'Internal notes by editors.' } },
  ],
  timestamps: true,
}

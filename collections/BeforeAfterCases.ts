import type { CollectionConfig } from 'payload'

export const BeforeAfterCases: CollectionConfig = {
  slug: 'before-after-cases',
  admin: {
    useAsTitle: 'caseTitle',
    defaultColumns: ['caseTitle', 'treatmentTag', 'weeksPost', 'consentGranted'],
    group: 'Media',
    description: 'Before and after cases. Only cases with consent granted are shown publicly.',
  },
  access: {
    read: () => true,
    // Before/after uploads go through /api/dashboard/upload (overrideAccess + ownership check).
    create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    { name: 'caseTitle', type: 'text', required: true },
    { name: 'beforePhotoUrl', type: 'text', required: true },
    { name: 'afterPhotoUrl', type: 'text', required: true },
    { name: 'treatmentTag', type: 'text', required: true, admin: { description: 'Botox, Lip Filler, etc.' } },
    { name: 'weeksPost', type: 'number', required: true, admin: { description: 'Weeks between before and after.' } },
    { name: 'provider', type: 'relationship', relationTo: 'providers', index: true },
    { name: 'city', type: 'text' },
    { name: 'state', type: 'text', maxLength: 2 },
    { name: 'patientNote', type: 'textarea' },
    { name: 'consentGranted', type: 'checkbox', required: true, defaultValue: false },
    { name: 'featured', type: 'checkbox', defaultValue: false },
    { name: 'sortRank', type: 'number', defaultValue: 999 },
  ],
  timestamps: true,
}

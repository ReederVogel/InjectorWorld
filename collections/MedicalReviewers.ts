import type { CollectionConfig } from 'payload'

export const MedicalReviewers: CollectionConfig = {
  slug: 'medical-reviewers',
  admin: {
    useAsTitle: 'fullName',
    defaultColumns: ['fullName', 'credentials', 'city', 'reviewedCount'],
    group: 'Content',
    description: 'Board-certified reviewers credited on medically reviewed content.',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    { name: 'fullName', type: 'text', required: true, index: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    {
      name: 'credentials',
      type: 'select',
      required: true,
      options: ['MD', 'DO', 'NP', 'PA', 'RN', 'DDS', 'PhD'].map((v) => ({ label: v, value: v })),
    },
    { name: 'title', type: 'text', required: true },
    { name: 'city', type: 'text' },
    { name: 'state', type: 'text', maxLength: 2 },
    { name: 'bio', type: 'textarea' },
    { name: 'photoUrl', type: 'text' },
    { name: 'npiNumber', type: 'text' },
    {
      name: 'boardCertifications',
      type: 'array',
      fields: [{ name: 'name', type: 'text', required: true }],
    },
    {
      name: 'linkedProvider',
      type: 'relationship',
      relationTo: 'providers',
      admin: { description: 'Link to provider record if they also see patients.' },
    },
    { name: 'linkedinUrl', type: 'text' },
    { name: 'reviewedCount', type: 'number', defaultValue: 0 },
  ],
  timestamps: true,
}

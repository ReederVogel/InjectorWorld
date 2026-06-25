import type { CollectionConfig } from 'payload'

export const FAQs: CollectionConfig = {
  slug: 'faqs',
  admin: {
    useAsTitle: 'question',
    defaultColumns: ['question', 'scope', 'treatmentTag'],
    group: 'Content',
    description: 'Reusable FAQ entries that feed FAQ schema on the matching pages.',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    { name: 'question', type: 'text', required: true, index: true },
    { name: 'answer', type: 'textarea', required: true, admin: { description: '40 to 80 words ideal for AEO snippets.' } },
    {
      name: 'scope',
      type: 'select',
      required: true,
      defaultValue: 'homepage',
      options: [
        { label: 'Homepage', value: 'homepage' },
        { label: 'Treatment', value: 'treatment' },
        { label: 'City', value: 'city' },
        { label: 'Clinic type', value: 'clinic' },
        { label: 'Guide', value: 'guide' },
      ],
    },
    { name: 'treatmentTag', type: 'text' },
    { name: 'cityTag', type: 'text' },
    {
      name: 'relatedGuide',
      type: 'relationship',
      relationTo: 'guides',
      admin: { description: '"Read the full guide" link target.' },
    },
    { name: 'sortRank', type: 'number', defaultValue: 999 },
  ],
  timestamps: true,
}

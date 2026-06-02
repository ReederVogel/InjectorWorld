import type { CollectionConfig } from 'payload'

export const QA: CollectionConfig = {
  slug: 'qa',
  labels: {
    singular: 'Q&A',
    plural: 'Q&A',
  },
  admin: {
    useAsTitle: 'questionTitle',
    defaultColumns: ['questionTitle', 'treatmentTag', 'cityTag', 'date'],
    group: 'Content',
  },
  access: { read: () => true },
  fields: [
    { name: 'qaId', type: 'text', required: true, unique: true, index: true },
    { name: 'questionTitle', type: 'text', required: true },
    { name: 'questionText', type: 'textarea' },
    { name: 'answeredByProvider', type: 'relationship', relationTo: 'providers' },
    { name: 'answeredByName', type: 'text', admin: { description: 'Use when provider not in our DB.' } },
    { name: 'answerText', type: 'textarea', required: true },
    { name: 'treatmentTag', type: 'text' },
    { name: 'cityTag', type: 'text' },
    {
      name: 'sourcePlatform',
      type: 'select',
      required: true,
      options: ['clinic_blog', 'forum', 'directory', 'injectors_world']
        .map((v) => ({ label: v, value: v })),
    },
    { name: 'sourceUrl', type: 'text', required: true },
    { name: 'date', type: 'date' },
  ],
  timestamps: true,
}

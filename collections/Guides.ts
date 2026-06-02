import type { CollectionConfig } from 'payload'

export const Guides: CollectionConfig = {
  slug: 'guides',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'author', 'medicalReviewer', 'lastMedicallyReviewed'],
    group: 'Content',
  },
  access: { read: () => true },
  fields: [
    { name: 'title', type: 'text', required: true, index: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'lede', type: 'textarea', required: true, admin: { description: 'Hero subhead, 1 to 2 sentences.' } },
    { name: 'coverImageUrl', type: 'text' },
    {
      name: 'category',
      type: 'select',
      required: true,
      defaultValue: 'treatment-guide',
      options: [
        { label: 'Treatment Guide', value: 'treatment-guide' },
        { label: 'Article', value: 'article' },
        { label: 'Expert Q&A', value: 'expert-qa' },
        { label: 'Cost Report', value: 'cost-report' },
      ],
    },
    {
      name: 'relatedTreatment',
      type: 'relationship',
      relationTo: 'treatments',
    },
    { name: 'readTimeMin', type: 'number' },
    { name: 'sourcesCount', type: 'number' },
    { name: 'author', type: 'relationship', relationTo: 'authors', required: true },
    { name: 'medicalReviewer', type: 'relationship', relationTo: 'medical-reviewers' },
    { name: 'lastMedicallyReviewed', type: 'date' },
    { name: 'body', type: 'richText' },
    {
      name: 'faqs',
      type: 'relationship',
      relationTo: 'faqs',
      hasMany: true,
    },
    { name: 'featured', type: 'checkbox', defaultValue: false },
    { name: 'publishedAt', type: 'date' },
  ],
  timestamps: true,
}

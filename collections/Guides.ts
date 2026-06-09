import type { CollectionConfig } from 'payload'
import { auditAfterChange, auditAfterDelete } from '../lib/audit-hook'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-hook'

export const Guides: CollectionConfig = {
  slug: 'guides',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'author', 'featured', 'publishedAt'],
    group: 'Content',
    description: 'Long-form treatment guides and articles. Search engine title and description are in the Meta tab.',
  },
  access: { read: () => true },
  fields: [
    { name: 'title', type: 'text', required: true, index: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'lede', type: 'textarea', required: true, admin: { description: 'Hero subhead, 1 to 2 sentences.' } },
    {
      name: 'excerpt',
      type: 'textarea',
      maxLength: 200,
      admin: {
        description: 'Short summary for listing cards and search snippets (under 200 characters). Also used as the default meta description.',
      },
    },
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Upload the cover image directly. Drag and drop a file or pick from the media library.',
      },
    },
    {
      name: 'coverImageUrl',
      type: 'text',
      admin: {
        description: 'Legacy / external cover image URL. Used only if no cover image is uploaded above.',
      },
    },
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
  hooks: {
    afterChange: [auditAfterChange, revalidateAfterChange],
    afterDelete: [auditAfterDelete, revalidateAfterDelete],
  },
  timestamps: true,
}

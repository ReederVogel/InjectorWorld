import type { CollectionConfig } from 'payload'
import { auditAfterChange, auditAfterDelete } from '../lib/audit-hook'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-hook'

export const News: CollectionConfig = {
  slug: 'news',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'status', 'author', 'publishedAt'],
    group: 'Content',
    description:
      'Timely news articles: treatment updates, industry news, company announcements. Keep separate from evergreen Guides.',
    listSearchableFields: ['title', 'excerpt'],
  },
  access: { read: () => true },
  fields: [
    { name: 'title', type: 'text', required: true, index: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'URL-safe slug, e.g. fda-approves-new-filler. Auto-generate from title.' },
    },
    {
      name: 'excerpt',
      type: 'textarea',
      required: true,
      maxLength: 300,
      admin: {
        description:
          'Short summary for listing cards, RSS feed, and newsletter sends. Under 300 characters.',
      },
    },
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Upload cover image. 16:9 or wider recommended. Served from R2.',
      },
    },
    {
      name: 'coverImageUrl',
      type: 'text',
      admin: {
        description:
          'Legacy or external cover image URL. Only used when no file is uploaded above.',
      },
    },
    { name: 'body', type: 'richText' },
    {
      name: 'category',
      type: 'select',
      required: true,
      defaultValue: 'industry',
      options: [
        { label: 'Treatment Update', value: 'treatment-update' },
        { label: 'Industry', value: 'industry' },
        { label: 'Company', value: 'company' },
        { label: 'Announcement', value: 'announcement' },
        { label: 'Product Launch', value: 'product-launch' },
        { label: 'Research', value: 'research' },
        { label: 'Regulation', value: 'regulation' },
      ],
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'authors',
      required: true,
    },
    {
      name: 'medicalReviewer',
      type: 'relationship',
      relationTo: 'medical-reviewers',
      admin: { description: 'Optional. Add only when the article covers clinical or safety content.' },
    },
    { name: 'publishedAt', type: 'date' },
    {
      name: 'relatedTreatment',
      type: 'relationship',
      relationTo: 'treatments',
      admin: { description: 'Optional. Links to a treatment pillar page from the article.' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      admin: { position: 'sidebar', description: 'Only Published articles appear on the site.' },
    },
    {
      name: 'featured',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', description: 'Pin this article to the top of the news index.' },
    },
  ],
  hooks: {
    afterChange: [auditAfterChange, revalidateAfterChange],
    afterDelete: [auditAfterDelete, revalidateAfterDelete],
  },
  timestamps: true,
}

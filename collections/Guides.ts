import type { CollectionConfig } from 'payload'
import { auditAfterChange, auditAfterDelete } from '../lib/audit-hook'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-hook'

export const Guides: CollectionConfig = {
  slug: 'guides',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'reviewStatus', 'indexState', 'status', 'author', 'publishedAt'],
    group: 'Content',
    description: 'Long-form treatment guides and articles. Search engine title and description are in the Meta tab.',
    listSearchableFields: ['title', 'importBatch'],
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
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
      name: 'relatedService',
      type: 'relationship',
      relationTo: 'services',
    },
    { name: 'readTimeMin', type: 'number' },
    { name: 'sourcesCount', type: 'number' },
    { name: 'author', type: 'relationship', relationTo: 'authors', required: true },
    { name: 'medicalReviewer', type: 'relationship', relationTo: 'medical-reviewers' },
    { name: 'lastMedicallyReviewed', type: 'date' },
    { name: 'body', type: 'richText' },
    // Structured body fields (populated by content importer; also editable in admin)
    {
      name: 'answerSnippet',
      type: 'textarea',
      admin: {
        description: '40-80 word answer-first summary shown at the top of the guide for featured snippets.',
      },
    },
    {
      name: 'atAGlance',
      type: 'json',
      admin: {
        description: 'Array of short facts, e.g. ["Fact 1", "Fact 2"]. Rendered as a bullet list above the body.',
      },
    },
    {
      name: 'faq',
      type: 'json',
      admin: {
        description: 'Inline array of {question, answer} for imported FAQ content. Shown alongside the existing faqs relationship.',
      },
    },
    {
      name: 'sources',
      type: 'json',
      admin: {
        description: 'Array of {title, publisher, url, publishedDate, sourceType, claimsSupported[]} objects. Rendered as a citations block.',
      },
    },
    {
      name: 'faqs',
      type: 'relationship',
      relationTo: 'faqs',
      hasMany: true,
    },
    { name: 'featured', type: 'checkbox', defaultValue: false },
    { name: 'publishedAt', type: 'date' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Only Published guides can appear publicly, and only after reviewStatus is Approved.',
      },
    },
    // Phase 15: visibility + review workflow
    {
      name: 'reviewStatus',
      type: 'select',
      required: true,
      defaultValue: 'imported',
      options: [
        { label: 'Imported (pending review)', value: 'imported' },
        { label: 'In review', value: 'in-review' },
        { label: 'Approved', value: 'approved' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Gate: only Approved guides are visible to the public. Use the Approve API or admin bulk action to approve.',
      },
    },
    {
      name: 'indexState',
      type: 'select',
      required: true,
      defaultValue: 'noindex',
      options: [
        { label: 'Noindex (approved but hidden from Google)', value: 'noindex' },
        { label: 'Indexed (in sitemap, Google can crawl)', value: 'indexed' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Use "Index next N" in the admin cockpit to drip approved guides into Google gradually.',
      },
    },
    {
      name: 'nofollow',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description: 'When checked, the page emits nofollow in its robots meta tag. Cleared automatically when drip-indexed.',
      },
    },
    {
      name: 'importBatch',
      type: 'text',
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Stamped by the content importer. Use to identify which batch this item came from.',
      },
    },
    {
      name: 'approvedAt',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true, description: 'Set automatically when approved.' },
    },
    {
      name: 'approvedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { position: 'sidebar', readOnly: true, description: 'Set automatically when approved.' },
    },
  ],
  hooks: {
    afterChange: [auditAfterChange, revalidateAfterChange],
    afterDelete: [auditAfterDelete, revalidateAfterDelete],
  },
  timestamps: true,
}

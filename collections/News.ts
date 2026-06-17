import type { CollectionConfig } from 'payload'
import { auditAfterChange, auditAfterDelete } from '../lib/audit-hook'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-hook'

export const News: CollectionConfig = {
  slug: 'news',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'reviewStatus', 'indexState', 'status', 'publishedAt'],
    group: 'Content',
    description:
      'Timely news articles: treatment updates, industry news, company announcements. Keep separate from evergreen Guides.',
    listSearchableFields: ['title', 'excerpt', 'importBatch'],
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
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
    // Structured body fields (populated by content importer; also editable in admin)
    {
      name: 'answerSnippet',
      type: 'textarea',
      admin: {
        description: '40-80 word answer-first summary shown at the top of the article for featured snippets.',
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
        description: 'Array of {question, answer} objects for the FAQ accordion and FAQPage JSON-LD.',
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
      admin: { position: 'sidebar', description: 'Only Published articles appear on the site. Kept in sync with Review Status: approving sets this to Published.' },
    },
    {
      name: 'featured',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', description: 'Pin this article to the top of the news index.' },
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
        description: 'Gate: only Approved articles are visible to the public. Use the Approve API or admin bulk action to approve.',
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
        description: 'Use "Index next N" in the admin cockpit to drip approved articles into Google gradually.',
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

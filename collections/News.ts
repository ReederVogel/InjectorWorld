import type { CollectionConfig } from 'payload'
import {
  FIND_IN_DOCUMENT,
  JSON_FORM_FIELDS,
  LENGTH_COUNTER_COMPONENT,
  LIVE_STATUS_COMPONENT,
  NEWS_FIND_FIELDS,
} from '../components/admin/find/find-fields'
import { BODY_STATS_COMPONENT, articleBodyEditor } from '../components/admin/lexical/article-body-editor'
import { auditAfterChange, auditAfterDelete } from '../lib/audit-hook'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-hook'

/*
 * Edit screen layout (2026-11-24): tabs Content | Summary | FAQ & Sources |
 * SEO (appended by @payloadcms/plugin-seo because the first field is a `tabs`
 * field), and a real sidebar for publishing and system fields. Tabs and the
 * collapsible are presentational, so every field keeps its column and form
 * path: the database and the API are unchanged.
 */
export const News: CollectionConfig = {
  slug: 'news',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'reviewStatus', 'status', 'updatedAt', 'publishedAt'],
    group: 'Content',
    description:
      'Timely news articles: treatment updates, industry news, company announcements. Keep separate from evergreen Guides.',
    listSearchableFields: ['title', 'excerpt', 'importBatch'],
    components: {
      beforeList: ['/components/admin/list-headers/NewsListHeader#NewsListHeader'],
      // "Find in this article" box in the Save bar.
      edit: {
        beforeDocumentControls: [{ path: FIND_IN_DOCUMENT, clientProps: { fields: NEWS_FIND_FIELDS } }],
      },
    },
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    delete: ({ req: { user } }) => user?.role === 'admin',
    // Payload's default lets ANY logged-in user (patients, providers) read versions.
    readVersions: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
  },
  // Version history (no drafts: a save still goes live exactly as before).
  // Every save keeps a copy; the Versions tab compares and restores them.
  // Adds the _news_v tables only. See docs/DECISIONS.md 2026-11-24.
  versions: { maxPerDoc: 30 },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
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
            { name: 'author', type: 'relationship', relationTo: 'authors', required: true },
            {
              name: 'medicalReviewer',
              type: 'relationship',
              relationTo: 'medical-reviewers',
              admin: { description: 'Optional. Add only when the article covers clinical or safety content.' },
            },
            {
              name: 'relatedService',
              type: 'relationship',
              relationTo: 'services',
              admin: { description: 'Optional. Links to a service pillar page from the article.' },
            },
            // Toolbar always visible + a "find in body" button. UI only: same nodes, same stored JSON.
            { name: 'body', type: 'richText', editor: articleBodyEditor },
            {
              // Word count and read time under the body. No column: `ui` fields are not stored.
              name: 'bodyStats',
              type: 'ui',
              admin: { components: { Field: { path: BODY_STATS_COMPONENT, clientProps: { bodyPath: 'body' } } } },
            },
          ],
        },
        {
          label: 'Summary',
          description: 'What readers see first, and what listing cards, the RSS feed and search results show.',
          fields: [
            {
              name: 'excerpt',
              type: 'textarea',
              required: true,
              maxLength: 300,
              admin: {
                description: 'Short summary for listing cards, the RSS feed and newsletter sends.',
                components: { afterInput: [{ path: LENGTH_COUNTER_COMPONENT, clientProps: { max: 300 } }] },
              },
            },
            // Structured body fields (populated by content importer; also editable in admin)
            {
              name: 'answerSnippet',
              type: 'textarea',
              admin: {
                description: 'Answer-first summary shown at the top of the article, for featured snippets.',
                components: {
                  afterInput: [{ path: LENGTH_COUNTER_COMPONENT, clientProps: { unit: 'words', min: 40, max: 80 } }],
                },
              },
            },
            // At a glance, FAQ and Sources stay JSON columns (same stored shape the
            // site renders); only their admin editor is a form. See
            // components/admin/json-forms/json-form-kit.tsx.
            {
              name: 'atAGlance',
              label: 'At a glance',
              type: 'json',
              admin: {
                description: 'Short facts shown as a bullet list above the article. One fact per row.',
                components: { Field: JSON_FORM_FIELDS.glance },
              },
            },
            {
              name: 'coverImage',
              type: 'upload',
              relationTo: 'media',
              admin: { description: 'Upload cover image. 16:9 or wider recommended.' },
            },
            {
              name: 'coverImageUrl',
              type: 'text',
              admin: {
                description: 'Legacy or external cover image URL. Only used when no file is uploaded above.',
                // Only in the way when an image is uploaded and this is empty.
                condition: (data) => !data?.coverImage || !!data?.coverImageUrl,
              },
            },
          ],
        },
        {
          label: 'FAQ & Sources',
          fields: [
            {
              name: 'faq',
              label: 'FAQ',
              type: 'json',
              admin: {
                description: "Questions and answers shown in the article's FAQ and sent to Google as FAQ schema.",
                components: { Field: JSON_FORM_FIELDS.faq },
              },
            },
            {
              name: 'sources',
              label: 'Sources',
              type: 'json',
              admin: {
                description: 'Citations listed at the end of the article.',
                components: { Field: JSON_FORM_FIELDS.sources },
              },
            },
          ],
        },
      ],
    },

    /* ── Sidebar ───────────────────────────────────────────────────────── */
    {
      name: 'liveStatus',
      type: 'ui',
      admin: { position: 'sidebar', components: { Field: { path: LIVE_STATUS_COMPONENT, clientProps: { basePath: '/news' } } } },
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
        components: { Cell: '/components/admin/cells/ReviewStatusCell#ReviewStatusCell' },
        description: 'Approved puts the article on the site. Bulk edit in the list view changes many at once.',
      },
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
      admin: {
        position: 'sidebar',
        description: 'Used by the list filters and exports. It does not decide what is on the site: Review Status does.',
      },
    },
    {
      name: 'featured',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', description: 'Pin this article to the top of the news index.' },
    },
    { name: 'publishedAt', type: 'date', admin: { position: 'sidebar', description: 'Shown on the article as its date.' } },
    {
      name: 'focusKeyword',
      type: 'text',
      admin: {
        position: 'sidebar',
        description: 'Primary target keyword for this page, shown in the admin Content Report SEO table.',
      },
    },
    {
      type: 'collapsible',
      label: 'System info',
      admin: {
        position: 'sidebar',
        initCollapsed: true,
        description: 'Set by importers and older tools. Rarely needs a change.',
      },
      fields: [
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
            readOnly: true,
            description:
              'DEPRECATED (2026-08-08). Indexing for every url lives in SEO > URLs and the Indexing screen; this field no longer affects the sitemap or the robots tag. Kept so historical values are not lost.',
          },
        },
        {
          name: 'nofollow',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description:
              'Not read by the article page any more (its robots tag comes from the indexing registry). Kept so historical values are not lost.',
          },
        },
        {
          name: 'importBatch',
          type: 'text',
          index: true,
          admin: {
            readOnly: true,
            description: 'Stamped by the content importer. Use to identify which batch this item came from.',
          },
        },
        {
          name: 'approvedAt',
          type: 'date',
          admin: { readOnly: true, description: 'Set automatically when approved.' },
        },
        {
          name: 'approvedBy',
          type: 'relationship',
          relationTo: 'users',
          admin: { readOnly: true, description: 'Set automatically when approved.' },
        },
        {
          name: 'linkDiscoveryScannedAt',
          type: 'date',
          admin: {
            readOnly: true,
            description:
              'Set once the internal-linking agent has scanned this page, so repeat scans skip it. Clear it to force a re-scan.',
          },
        },
        {
          name: 'internalLinks',
          label: 'Internal links (old record)',
          type: 'json',
          admin: {
            description:
              'Links the internal-linking agent inserted. The site does not read this list: the links live in the body.',
            components: { Field: JSON_FORM_FIELDS.internalLinks },
          },
        },
      ],
    },
  ],
  hooks: {
    afterChange: [auditAfterChange, revalidateAfterChange],
    afterDelete: [auditAfterDelete, revalidateAfterDelete],
  },
  timestamps: true,
}

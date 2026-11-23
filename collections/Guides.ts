import type { CollectionConfig } from 'payload'
import {
  FIND_IN_DOCUMENT,
  GUIDE_FIND_FIELDS,
  JSON_FORM_FIELDS,
  LENGTH_COUNTER_COMPONENT,
  LIVE_STATUS_COMPONENT,
} from '../components/admin/find/find-fields'
import { BODY_STATS_COMPONENT, articleBodyEditor } from '../components/admin/lexical/article-body-editor'
import { auditAfterChange, auditAfterDelete } from '../lib/audit-hook'
import { guideDatesBeforeChange } from '../lib/guide-dates'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-hook'

/*
 * Edit screen layout (2026-11-24): tabs Content | Summary | FAQ & Sources |
 * SEO (the SEO tab is appended by @payloadcms/plugin-seo because the first
 * field is a `tabs` field), and a real sidebar for publishing and system
 * fields. Tabs and the collapsible are unnamed/presentational, so every field
 * keeps its column and its form path: the database and the API are unchanged.
 */
export const Guides: CollectionConfig = {
  slug: 'guides',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'reviewStatus', 'status', 'contentUpdatedAt', 'author', 'publishedAt'],
    group: 'Content',
    description: 'Long-form treatment guides and articles. The search engine title and description are in the SEO tab.',
    listSearchableFields: ['title', 'importBatch'],
    components: {
      beforeList: ['/components/admin/list-headers/GuidesListHeader#GuidesListHeader'],
      // "Find in this article" box in the Save bar.
      edit: {
        beforeDocumentControls: [{ path: FIND_IN_DOCUMENT, clientProps: { fields: GUIDE_FIND_FIELDS } }],
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
  // Adds the _guides_v tables only. See docs/DECISIONS.md 2026-11-24.
  versions: { maxPerDoc: 30 },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            { name: 'title', type: 'text', required: true, index: true },
            { name: 'slug', type: 'text', required: true, unique: true, index: true },
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
            { name: 'relatedService', type: 'relationship', relationTo: 'services' },
            { name: 'author', type: 'relationship', relationTo: 'authors', required: true },
            { name: 'medicalReviewer', type: 'relationship', relationTo: 'medical-reviewers' },
            // Toolbar always visible + a "find in body" button. UI only: same nodes, same stored JSON.
            { name: 'body', type: 'richText', editor: articleBodyEditor },
            {
              // Word count and read-time suggestion under the body. No column: `ui` fields are not stored.
              name: 'bodyStats',
              type: 'ui',
              admin: {
                components: {
                  Field: { path: BODY_STATS_COMPONENT, clientProps: { bodyPath: 'body', readTimePath: 'readTimeMin' } },
                },
              },
            },
            {
              name: 'readTimeMin',
              label: 'Read time (minutes)',
              type: 'number',
              admin: {
                description:
                  'Shown on the guide as "N min read". Empty shows none. The line under Body suggests a value from the word count.',
              },
            },
          ],
        },
        {
          label: 'Summary',
          description: 'What readers see first, and what listing cards and search results show.',
          fields: [
            { name: 'lede', type: 'textarea', required: true, admin: { description: 'Hero subhead, 1 to 2 sentences.' } },
            {
              name: 'excerpt',
              type: 'textarea',
              maxLength: 200,
              admin: {
                description:
                  'Short summary for listing cards and search snippets. Also the default SEO description.',
                components: { afterInput: [{ path: LENGTH_COUNTER_COMPONENT, clientProps: { max: 200 } }] },
              },
            },
            {
              name: 'answerSnippet',
              type: 'textarea',
              admin: {
                description: 'Answer-first summary shown at the top of the guide, for featured snippets.',
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
              admin: {
                description: 'Upload the cover image directly. Drag and drop a file or pick from the media library.',
              },
            },
            {
              name: 'coverImageUrl',
              type: 'text',
              admin: {
                description: 'Legacy / external cover image URL. Used only if no cover image is uploaded above.',
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
                description: "Questions and answers shown in the guide's FAQ and sent to Google as FAQ schema.",
                components: { Field: JSON_FORM_FIELDS.faq },
              },
            },
            {
              name: 'sources',
              label: 'Sources',
              type: 'json',
              admin: {
                description: 'Citations listed at the end of the guide.',
                components: { Field: JSON_FORM_FIELDS.sources },
              },
            },
            {
              name: 'sourcesCount',
              label: 'Sources count',
              type: 'number',
              admin: { description: 'Shown as "N sources" only when the Sources list above is empty.' },
            },
          ],
        },
      ],
    },

    /* ── Sidebar ───────────────────────────────────────────────────────── */
    {
      name: 'liveStatus',
      type: 'ui',
      admin: { position: 'sidebar', components: { Field: { path: LIVE_STATUS_COMPONENT, clientProps: { basePath: '/guides' } } } },
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
        description: 'Approved puts the guide on the site. Bulk edit in the list view changes many at once.',
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
    { name: 'featured', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' } },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        description:
          'Shown on the guide as "Published" and sent to Google as datePublished. Set automatically the first time the guide is approved, if empty. Never changed by the system after that.',
      },
    },
    {
      name: 'contentUpdatedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description:
          'Shown on the guide as "Updated" and sent to Google as dateModified. Set automatically only when the content changes (title, lede, body, FAQs, sources, cover, author, reviewer), including when an internal link is inserted or removed. Status edits and link scans do not change it.',
      },
    },
    {
      name: 'lastMedicallyReviewed',
      type: 'date',
      admin: {
        position: 'sidebar',
        description: 'Not shown on the guide. Used as the Published date on listing cards only when Published At is empty.',
      },
    },
    // /guides filter chips. Admin-only distinction: the site treats both alike.
    {
      name: 'primaryCategory',
      type: 'relationship',
      relationTo: 'guide-categories',
      admin: { position: 'sidebar', description: 'Main category. Shows as a filter chip on /guides.' },
    },
    {
      name: 'secondaryCategories',
      type: 'relationship',
      relationTo: 'guide-categories',
      hasMany: true,
      admin: { position: 'sidebar', description: 'Other categories this guide also appears under on /guides.' },
    },
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
            readOnly: true,
            description:
              'DEPRECATED (2026-08-08). It duplicated the index gate and could emit a robots tag contradicting the registry. Queued urls already emit noindex,follow so internal links stay discoverable.',
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
    {
      // Retired 2026-09-13: nothing reads it (0 rows used it). Which FAQs show on
      // a guide is now set on the FAQ category (FAQs screen). Hidden rather than
      // removed so db-push does not have to drop guides_rels.faqs_id.
      name: 'faqs',
      type: 'relationship',
      relationTo: 'faqs',
      hasMany: true,
      admin: { hidden: true },
    },
  ],
  hooks: {
    beforeChange: [guideDatesBeforeChange],
    afterChange: [auditAfterChange, revalidateAfterChange],
    afterDelete: [auditAfterDelete, revalidateAfterDelete],
  },
  timestamps: true,
}

import type { CollectionConfig } from 'payload'
import { auditAfterChange, auditAfterDelete } from '../lib/audit-hook'
import { faqKebab } from '../lib/faqs/slug'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-hook'

/**
 * Filter chips on /guides (2026-10-28). A guide has one primary and any number
 * of secondary categories; the site shows both the same way and never prints
 * the words "primary" or "secondary". Chips run in `sortOrder`, each with a
 * live count of the guides tagged with it either way. First loaded from the
 * founder's sheet by scripts/seed-guide-categories.sql.
 */
export const GuideCategories: CollectionConfig = {
  slug: 'guide-categories',
  labels: { singular: 'Guide category', plural: 'Guide categories' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'sortOrder'],
    group: 'Content',
    description: 'Filter chips on /guides. Lower sort order shows first. A category with no guides is hidden.',
  },
  defaultSort: 'sortOrder',
  access: {
    read: () => true,
    create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Filled from the name when left empty.' },
    },
    { name: 'sortOrder', type: 'number', defaultValue: 100 },
  ],
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (data && !data.slug && data.name) data.slug = faqKebab(String(data.name))
        return data
      },
    ],
    afterChange: [auditAfterChange, revalidateAfterChange],
    afterDelete: [auditAfterDelete, revalidateAfterDelete],
  },
  timestamps: true,
}

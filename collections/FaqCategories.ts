import type { CollectionConfig } from 'payload'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-hook'
import { faqKebab } from '../lib/faqs/slug'

/**
 * The home of every FAQ: one category = one public page, /faq/<slug>.
 *
 * Hidden from the admin nav on purpose. Founder instruction (2026-09-13): every
 * FAQ control lives on the FAQs screen, so categories are created, edited and
 * deleted from the "Categories" panel at the top of /admin/collections/faqs
 * (components/admin/list-headers/FaqCategoriesPanel.tsx), which talks to this
 * collection's REST API. See docs/FAQ-SYSTEM-2026-09-13.md.
 */
export const FaqCategories: CollectionConfig = {
  slug: 'faq-categories',
  labels: { singular: 'FAQ category', plural: 'FAQ categories' },
  admin: {
    hidden: true,
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'type', 'enabled'],
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc }) => {
        if (!data) return data
        if (typeof data.slug === 'string') data.slug = faqKebab(data.slug)
        if (!data.slug && data.name && operation === 'create') data.slug = faqKebab(String(data.name))
        // An emptied slug on update would fail the unique/required check with an
        // unhelpful error, so keep the existing one instead.
        if (operation === 'update' && 'slug' in data && !data.slug) data.slug = originalDoc?.slug
        return data
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        // Deleting a category that still owns FAQs would leave them homeless and
        // silently drop them from /faq. Move them first.
        const res = await req.payload.count({
          collection: 'faqs',
          where: { category: { equals: id } },
          overrideAccess: true,
          req,
        })
        if (res.totalDocs > 0) {
          throw new Error(`This category still has ${res.totalDocs} FAQ(s). Move them to another category first.`)
        }
      },
    ],
    afterChange: [revalidateAfterChange],
    afterDelete: [revalidateAfterDelete],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Public url: /faq/<slug>. Lowercase letters, numbers and hyphens.' },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'topic',
      options: [
        { label: 'Treatment', value: 'treatment' },
        { label: 'Brand', value: 'brand' },
        { label: 'Topic', value: 'topic' },
        { label: 'Place', value: 'location' },
        { label: 'General', value: 'general' },
      ],
      admin: { description: 'Only decides which group the category sits in on /faq.' },
    },
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Off hides the /faq page and every preview of this category.' },
    },
    { name: 'intro', type: 'textarea', admin: { description: 'Shown under the heading on /faq/<slug>.' } },
    { name: 'metaTitle', type: 'text' },
    { name: 'metaDescription', type: 'textarea' },
    { name: 'sortRank', type: 'number', defaultValue: 100, admin: { description: 'Lower shows first.' } },
    {
      name: 'services',
      type: 'relationship',
      relationTo: 'services',
      hasMany: true,
      admin: { description: 'These treatment pages show a preview of this category.' },
    },
    {
      name: 'brands',
      type: 'relationship',
      relationTo: 'brands',
      hasMany: true,
      admin: { description: 'These brand pages show a preview of this category.' },
    },
    {
      name: 'guides',
      type: 'relationship',
      relationTo: 'guides',
      hasMany: true,
      admin: { description: 'These guides show a preview of this category.' },
    },
    {
      name: 'locations',
      type: 'relationship',
      relationTo: 'locations',
      hasMany: true,
      admin: { description: 'The "See all" link on these state and city pages points here.' },
    },
  ],
  timestamps: true,
}

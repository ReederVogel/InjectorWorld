import type { CollectionConfig } from 'payload'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-hook'
import { FAQ_SECTIONS, guessFaqSection, isFaqSection } from '../lib/faqs/sections'
import { relId, resolveFaqCategory } from '../lib/faqs/assign'

export const FAQs: CollectionConfig = {
  slug: 'faqs',
  admin: {
    useAsTitle: 'question',
    defaultColumns: ['question', 'category', 'section', 'location', 'reviewStatus', 'sortRank'],
    group: 'Content',
    description:
      'Every FAQ lives on one category page (/faq/<category>) and previews on the pages that category is linked to. Categories and FAQ settings are managed from the panels above the list.',
    components: {
      beforeList: ['/components/admin/list-headers/FaqsListHeader#FaqsListHeader'],
    },
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    { name: 'question', type: 'text', required: true, index: true },
    { name: 'answer', type: 'textarea', required: true, admin: { description: '40 to 80 words ideal for AEO snippets.' } },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'faq-categories',
      // Categories are managed from the panel on the FAQs list, not from a drawer.
      admin: {
        allowCreate: false,
        allowEdit: false,
        position: 'sidebar',
        description: 'The page this FAQ lives on: /faq/<category>. Leave empty and it is picked on save (place, then treatment, then brand, then guide, else General).',
      },
    },
    {
      name: 'section',
      type: 'select',
      options: FAQ_SECTIONS.map((s) => ({ label: s.label, value: s.value })),
      admin: {
        position: 'sidebar',
        description: 'Group on the category page. Leave empty and it is guessed from the question on save.',
      },
    },
    {
      name: 'showInPreview',
      label: 'Show in previews',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description: 'Off keeps this FAQ on its category page only, never in the short preview on treatment, brand, guide or place pages.',
      },
    },
    {
      name: 'answerDetail',
      type: 'textarea',
      admin: {
        description: 'Optional 90-140 word long-form detail shown below the short answer. Included alongside the short answer in the FAQPage acceptedAnswer.text.',
      },
    },
    {
      name: 'scope',
      type: 'select',
      required: true,
      defaultValue: 'homepage',
      options: [
        { label: 'Homepage', value: 'homepage' },
        { label: 'Service', value: 'service' },
        { label: 'Brand', value: 'brand' },
        { label: 'Guide', value: 'guide' },
        { label: 'Location (state or city)', value: 'location' },
        { label: 'Clinic type', value: 'clinic-type' },
      ],
      admin: {
        description: 'What this FAQ is about. Only used to pick a category automatically when Category is empty.',
      },
    },
    {
      name: 'service',
      type: 'relationship',
      relationTo: 'services',
      admin: { description: 'Set when scope is Service, or to narrow a Location-scoped FAQ to one treatment.' },
    },
    {
      name: 'brand',
      type: 'relationship',
      relationTo: 'brands',
      admin: { description: 'Set when scope is Brand, or to narrow a Location-scoped FAQ to one brand.' },
    },
    {
      name: 'guide',
      type: 'relationship',
      relationTo: 'guides',
      admin: {
        description:
          'Set when scope is Guide -- this FAQ appears directly on that guide page (via getGuideOwnFaqs), for topics that have no matching Service or Brand page (e.g. Jowls, Hyaluronidase). Distinct from "relatedGuide" below, which is a "read the full guide" link on a Service/Brand-scoped FAQ, not the FAQ\'s own page.',
      },
    },
    {
      name: 'location',
      type: 'relationship',
      relationTo: 'locations',
      admin: {
        description: 'Set to show this FAQ on one state or city page. With a treatment or brand also set, it shows on that treatment or brand page for this place. A city page never borrows its state FAQs.',
      },
    },
    {
      name: 'clinicType',
      type: 'select',
      options: [
        { label: 'Plastic surgery', value: 'plastic-surgery' },
        { label: 'Dermatology', value: 'dermatology' },
        { label: 'Dental aesthetics', value: 'dental-aesthetics' },
        { label: 'Med spa', value: 'medspa' },
        { label: 'Other', value: 'other' },
      ],
      admin: { description: 'Set when scope is Clinic type.' },
    },
    {
      name: 'relatedGuide',
      type: 'relationship',
      relationTo: 'guides',
      admin: { description: '"Read the full guide" link target.' },
    },
    {
      name: 'offLabel',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Check if this FAQ discusses an off-label use of a treatment or product. Renders an inline notice on the page.',
      },
    },
    {
      name: 'safetyFlag',
      type: 'select',
      defaultValue: 'none',
      options: [
        { label: 'None', value: 'none' },
        { label: 'Serious risk', value: 'serious-risk' },
        { label: 'Non-FDA-approved product', value: 'non-fda-approved' },
      ],
      admin: {
        description: 'Flags medical safety context that must render as an inline notice per brand voice rules (§4.1).',
      },
    },
    { name: 'sortRank', type: 'number', defaultValue: 999 },
    {
      name: 'stableId',
      type: 'text',
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Stable id used by the bulk uploader to match this FAQ on re-upload. Auto-generated from the question if left blank.',
      },
    },
    {
      name: 'reviewStatus',
      type: 'select',
      required: true,
      defaultValue: 'approved',
      options: [
        { label: 'Imported (pending review)', value: 'imported' },
        { label: 'Approved', value: 'approved' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Gate: only Approved FAQs appear on the live site. Bulk-uploaded FAQs start as Imported until approved.',
      },
    },
    {
      name: 'importBatch',
      type: 'text',
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Stamped by the bulk uploader. Identifies which upload batch this FAQ came from.',
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, req, context }) => {
        if (!data) return data
        // Merged so a partial update (only reviewStatus, say) still sees the
        // service, brand, location and category the FAQ already has. Undefined
        // keys are skipped: the bulk uploader sends `category: undefined` when a
        // row names no category, and that must not wipe an admin's choice.
        const merged: Record<string, any> = { ...(originalDoc ?? {}) }
        for (const [k, v] of Object.entries(data)) if (v !== undefined) merged[k] = v
        if (!relId(merged.category)) {
          const r = await resolveFaqCategory(req.payload, merged, { create: true, req, context })
          if (r.id) data.category = r.id
        }
        if (!isFaqSection(merged.section)) data.section = guessFaqSection(merged.question)
        return data
      },
    ],
    afterChange: [revalidateAfterChange],
    afterDelete: [revalidateAfterDelete],
  },
  timestamps: true,
}

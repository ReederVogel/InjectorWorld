import type { CollectionConfig } from 'payload'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-hook'

export const FAQs: CollectionConfig = {
  slug: 'faqs',
  admin: {
    useAsTitle: 'question',
    defaultColumns: ['question', 'scope', 'service', 'brand', 'guide', 'location', 'reviewStatus'],
    group: 'Content',
    description: 'Reusable FAQ entries that feed FAQ schema on the matching pages.',
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
        description: 'Which page type this FAQ primarily belongs to. Service and Location can both be set on the same FAQ to narrow it further (e.g. a Botox FAQ specific to New York).',
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
      admin: { description: 'Set when scope is Location. Works for both a state and a metro/city, since Locations already models that hierarchy.' },
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
    afterChange: [revalidateAfterChange],
    afterDelete: [revalidateAfterDelete],
  },
  timestamps: true,
}

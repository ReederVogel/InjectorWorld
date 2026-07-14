import type { CollectionConfig } from 'payload'

export const FAQs: CollectionConfig = {
  slug: 'faqs',
  admin: {
    useAsTitle: 'question',
    defaultColumns: ['question', 'scope', 'service', 'brand', 'location', 'reviewStatus'],
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
      name: 'scope',
      type: 'select',
      required: true,
      defaultValue: 'homepage',
      options: [
        { label: 'Homepage', value: 'homepage' },
        { label: 'Service', value: 'service' },
        { label: 'Brand', value: 'brand' },
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
  timestamps: true,
}

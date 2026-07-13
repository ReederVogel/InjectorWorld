import type { CollectionConfig } from 'payload'

export const FAQs: CollectionConfig = {
  slug: 'faqs',
  admin: {
    useAsTitle: 'question',
    defaultColumns: ['question', 'scope', 'serviceTag', 'reviewStatus'],
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
        { label: 'City', value: 'city' },
        { label: 'Clinic type', value: 'clinic' },
        { label: 'Guide', value: 'guide' },
      ],
    },
    { name: 'serviceTag', type: 'text' },
    { name: 'cityTag', type: 'text' },
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

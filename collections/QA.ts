import type { CollectionConfig } from 'payload'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-hook'

export const QA: CollectionConfig = {
  slug: 'qa',
  labels: {
    singular: 'Q&A',
    plural: 'Q&A',
  },
  admin: {
    useAsTitle: 'questionTitle',
    defaultColumns: ['questionTitle', 'status', 'treatmentTag', 'cityTag', 'date'],
    group: 'Content',
    description: 'Reader questions. Set status to Answered and add an answer to publish it to /questions.',
  },
  access: {
    read: ({ req }) => {
      // Public can only read answered questions; admins/editors see all
      if (req.user?.role === 'admin' || req.user?.role === 'editor') return true
      return { status: { equals: 'answered' } }
    },
    create: () => false,
    update: ({ req }) => req.user?.role === 'admin' || req.user?.role === 'editor' || req.user?.role === 'provider',
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    { name: 'qaId', type: 'text', required: true, unique: true, index: true },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: { description: 'URL slug. Auto-generated on submission.' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      options: [
        { label: 'New (pending moderation)', value: 'new' },
        { label: 'Answered', value: 'answered' },
        { label: 'Rejected', value: 'rejected' },
      ],
    },
    { name: 'questionTitle', type: 'text', required: true },
    { name: 'questionText', type: 'textarea' },
    { name: 'answeredByProvider', type: 'relationship', relationTo: 'providers' },
    { name: 'answeredByName', type: 'text', admin: { description: 'Use when provider not in our DB.' } },
    {
      name: 'answerText',
      type: 'textarea',
      admin: { description: 'The answer. Required before publishing.' },
    },
    { name: 'treatmentTag', type: 'text', index: true },
    { name: 'cityTag', type: 'text', index: true },
    {
      name: 'sourcePlatform',
      type: 'select',
      defaultValue: 'injectors_world',
      options: ['clinic_blog', 'forum', 'directory', 'injectors_world', 'user_submission']
        .map((v) => ({ label: v, value: v })),
    },
    { name: 'sourceUrl', type: 'text' },
    { name: 'date', type: 'date' },
    {
      name: 'submitterEmail',
      type: 'email',
      admin: {
        description: 'Email from public submission (not displayed publicly).',
        position: 'sidebar',
      },
    },
    {
      name: 'importBatch',
      type: 'text',
      index: true,
      admin: {
        readOnly: true,
        description: 'Set by the data importer to group a batch (for scoped re-import / wipe). Not hand-editable.',
        position: 'sidebar',
      },
    },
  ],
  // Revalidate /questions immediately when a question is answered/published or
  // deleted, instead of waiting for the 5-min ISR window.
  hooks: {
    afterChange: [revalidateAfterChange],
    afterDelete: [revalidateAfterDelete],
  },
  timestamps: true,
}

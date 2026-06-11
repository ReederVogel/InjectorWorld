import type { CollectionConfig } from 'payload'

/**
 * Subscribers-lite (Phase 8). A minimal email-capture store so the coming-soon
 * waitlist ("notify me") and the quiz "email me my result" actually persist.
 *
 * Phase 10 (Newsletter) extends this into full double opt-in + CAN-SPAM
 * (unsubscribe, physical address, consent log, Resend broadcast). For now this
 * just records the address + where it came from. NO PHI: store only email +
 * source context (city/state/treatment interest), never health information.
 */
export const Subscribers: CollectionConfig = {
  slug: 'subscribers',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'source', 'cityTag', 'stateCode', 'confirmed', 'createdAt'],
    listSearchableFields: ['email', 'cityTag', 'stateCode'],
    group: 'Operations',
    description:
      'Email captures from the coming-soon waitlist and the quiz. Phase 10 turns this into the full newsletter list (double opt-in, unsubscribe). No health information is stored here.',
  },
  access: {
    // Writes go through the rate-limited API routes (overrideAccess); the raw
    // API / GraphQL cannot create or read subscriber emails.
    create: () => false,
    read: ({ req }) => req.user?.role === 'admin' || req.user?.role === 'editor',
    update: ({ req }) => req.user?.role === 'admin' || req.user?.role === 'editor',
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    { name: 'email', type: 'email', required: true, index: true },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'waitlist',
      options: [
        { label: 'Coming-soon waitlist', value: 'waitlist' },
        { label: 'Quiz result', value: 'quiz' },
        { label: 'Footer signup', value: 'footer' },
        { label: 'Other', value: 'other' },
      ],
    },
    { name: 'cityTag', type: 'text', index: true, admin: { description: 'City the visitor asked about (waitlist).' } },
    { name: 'stateCode', type: 'text', index: true, admin: { description: 'Two-letter state code, if known.' } },
    { name: 'treatmentTag', type: 'text', admin: { description: 'Treatment of interest (quiz / waitlist).' } },
    {
      name: 'confirmed',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Double opt-in confirmation. Wired in Phase 10; false for now.' },
    },
    {
      name: 'notified',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Set once we have emailed this person that their market went live.' },
    },
    {
      name: 'linkedUser',
      type: 'relationship',
      relationTo: 'users',
      admin: { description: 'Set when a logged-in patient saved their quiz result or joined a waitlist.' },
    },
  ],
  timestamps: true,
}

import type { CollectionConfig } from 'payload'

/**
 * Email subscribers: double opt-in newsletter list + city waitlist.
 * Phase 8 created a lite version; Phase 10 extends it with full double opt-in,
 * CAN-SPAM consent log, and unsubscribe support.
 *
 * LEGAL:
 * - status must be 'confirmed' before any newsletter is sent.
 * - confirmToken is used for both the confirm link and the unsubscribe link.
 * - optInAt, confirmedAt, ipAtSignup form the consent audit trail.
 * - No PHI: only email, optional name, and interest context.
 */
export const Subscribers: CollectionConfig = {
  slug: 'subscribers',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'status', 'source', 'interestType', 'cityTag', 'optInAt'],
    listSearchableFields: ['email', 'name', 'cityTag', 'stateCode'],
    group: 'Operations',
    description:
      'Newsletter and waitlist subscribers. Only confirmed subscribers receive emails. No health information is stored here.',
  },
  access: {
    // All writes go through rate-limited API routes (overrideAccess).
    create: () => false,
    read: ({ req }) => req.user?.role === 'admin' || req.user?.role === 'editor',
    update: ({ req }) => req.user?.role === 'admin' || req.user?.role === 'editor',
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    { name: 'email', type: 'email', required: true, index: true, unique: true },
    { name: 'name', type: 'text', admin: { description: 'Optional display name (first name or full).' } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Pending (not yet confirmed)', value: 'pending' },
        { label: 'Confirmed', value: 'confirmed' },
        { label: 'Unsubscribed', value: 'unsubscribed' },
      ],
      admin: { description: 'Double opt-in flow. Only confirmed subscribers receive newsletters.' },
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'footer',
      options: [
        { label: 'Coming-soon waitlist', value: 'waitlist' },
        { label: 'Quiz result', value: 'quiz' },
        { label: 'Footer signup', value: 'footer' },
        { label: 'Guide page', value: 'guide' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'interestType',
      type: 'select',
      required: true,
      defaultValue: 'general',
      options: [
        { label: 'General newsletter', value: 'general' },
        { label: 'City waitlist', value: 'city-waitlist' },
      ],
      admin: { description: 'Determines which emails this subscriber receives.' },
    },
    {
      name: 'cityTag',
      type: 'text',
      index: true,
      admin: { description: 'City the visitor asked about (city-waitlist only, e.g. "Houston").' },
    },
    {
      name: 'stateCode',
      type: 'text',
      index: true,
      admin: { description: 'Two-letter state code for the city-waitlist interest.' },
    },
    {
      name: 'treatmentTag',
      type: 'text',
      admin: { description: 'Treatment of interest, if any.' },
    },
    {
      name: 'confirmToken',
      type: 'text',
      index: true,
      admin: {
        readOnly: true,
        description: 'UUID used in confirm and unsubscribe links. Never share externally.',
      },
    },
    {
      name: 'optInAt',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'When the visitor submitted the signup form.',
        date: { displayFormat: 'MMM d, yyyy h:mm a' },
      },
    },
    {
      name: 'confirmedAt',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'When the visitor clicked the confirmation link.',
        date: { displayFormat: 'MMM d, yyyy h:mm a' },
      },
    },
    {
      name: 'unsubscribedAt',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'When the subscriber clicked the unsubscribe link.',
        date: { displayFormat: 'MMM d, yyyy h:mm a' },
      },
    },
    {
      name: 'ipAtSignup',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'IP address at signup time. Consent audit log only. Not shared.',
      },
    },
    {
      name: 'notified',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Set once a go-live email has been sent to this subscriber.' },
    },
    {
      name: 'linkedUser',
      type: 'relationship',
      relationTo: 'users',
      admin: { description: 'Set when a logged-in patient subscribes.' },
    },
  ],
  timestamps: true,
}

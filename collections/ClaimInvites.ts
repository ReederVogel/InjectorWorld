import type { CollectionConfig } from 'payload'
import { auditAfterChange, auditAfterDelete } from '../lib/audit-hook'

/**
 * Outreach tracking for "claim your profile" invite emails sent from the
 * admin Claims Control Center. One record per clinic + email pair.
 *
 * Lifecycle: sent (admin sends invite) → claimed (a claim for the target
 * clinic is approved) or unsubscribed (recipient opted out — suppression:
 * no further invites are ever sent to this email).
 */
export const ClaimInvites: CollectionConfig = {
  slug: 'claim-invites',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'targetClinic', 'status', 'sendCount', 'lastSentAt'],
    group: 'Inbox',
    description: 'Claim-invite emails sent to clinic owners. Sent from the Claims page control center. Unsubscribed emails are never contacted again.',
  },
  access: {
    // Writes go through /api/admin/claims/outreach (overrideAccess) and the
    // claim-approval hook. Blocking raw REST create keeps counts honest.
    create: () => false,
    read: ({ req: { user } }) => !!(user && (user.role === 'admin' || user.role === 'editor')),
    update: ({ req: { user } }) => !!(user && (user.role === 'admin' || user.role === 'editor')),
    delete: ({ req: { user } }) => !!(user && user.role === 'admin'),
  },
  fields: [
    {
      name: 'targetClinic',
      type: 'relationship',
      relationTo: 'clinics',
      required: true,
      index: true,
      admin: { description: 'The clinic this invite points at.' },
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      index: true,
      admin: { description: 'Recipient address (from the clinic record at send time).' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'sent',
      index: true,
      options: [
        { label: 'Sent', value: 'sent' },
        { label: 'Claimed', value: 'claimed' },
        { label: 'Unsubscribed', value: 'unsubscribed' },
      ],
    },
    {
      name: 'sendCount',
      type: 'number',
      defaultValue: 1,
      admin: { description: 'How many times the invite has been sent (initial + resends).' },
    },
    {
      name: 'lastSentAt',
      type: 'date',
      admin: { description: 'When the most recent invite email went out.' },
    },
    {
      name: 'sentBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { description: 'Admin who sent the most recent invite.' },
    },
  ],
  hooks: {
    afterChange: [auditAfterChange],
    afterDelete: [auditAfterDelete],
  },
  timestamps: true,
}

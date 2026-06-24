import type { CollectionConfig } from 'payload'
import { auditAfterChange, auditAfterDelete } from '../lib/audit-hook'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-hook'

export const Reviews: CollectionConfig = {
  slug: 'reviews',
  admin: {
    useAsTitle: 'reviewTitle',
    defaultColumns: ['reviewTitle', 'rating', 'treatmentTag', 'reviewDate', 'verified', 'sourcePlatform'],
    group: 'Users & Ops',
    description: 'Imported and submitted reviews. Provider and clinic ratings are computed from these, so deleting reviews changes the displayed ratings.',
  },
  access: {
    read: () => true,
    // Reviews are imported via the pipeline (overrideAccess). Blocking REST prevents fake review injection.
    create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    { name: 'reviewId', type: 'text', required: true, unique: true, index: true },
    { name: 'provider', type: 'relationship', relationTo: 'providers', index: true },
    { name: 'clinic', type: 'relationship', relationTo: 'clinics', required: true },
    { name: 'reviewerFirstName', type: 'text' },
    { name: 'reviewerInitial', type: 'text', maxLength: 2 },
    { name: 'reviewerAgeRange', type: 'text' },
    { name: 'reviewerCity', type: 'text' },
    { name: 'rating', type: 'number', required: true, min: 1, max: 5 },
    { name: 'reviewTitle', type: 'text' },
    { name: 'reviewText', type: 'textarea', required: true },
    { name: 'treatmentTag', type: 'text' },
    { name: 'reviewDate', type: 'date' },
    {
      name: 'sourcePlatform',
      type: 'select',
      required: true,
      options: ['google', 'yelp', 'healthgrades', 'vitals', 'zocdoc', 'clinic_site', 'injectors_world']
        .map((v) => ({ label: v, value: v })),
    },
    { name: 'sourceUrl', type: 'text', required: true },
    { name: 'responseFromProvider', type: 'textarea' },
    { name: 'responseDate', type: 'date' },
    {
      name: 'verified',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Only check when a real provenance trail exists: the source URL has been confirmed against the platform, or the patient submitted the review directly through the account flow. Imported reviews with a sourceUrl are typically verified; all other new records start unverified. Showing a "Verified" badge without provenance is a launch-blocker (FTC / consumer-protection risk).',
      },
    },
    { name: 'featured', type: 'checkbox', defaultValue: false },
    {
      name: 'moderationStatus',
      type: 'select',
      defaultValue: 'approved',
      index: true,
      admin: {
        description:
          'Approved reviews render publicly. Reviews submitted by logged-in patients land as Pending and are hidden until a moderator approves them. Imported and seeded reviews default to Approved.',
        position: 'sidebar',
      },
      options: [
        { label: 'Approved (public)', value: 'approved' },
        { label: 'Pending moderation', value: 'pending' },
        { label: 'Rejected', value: 'rejected' },
      ],
    },
    {
      name: 'submittedByUser',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: {
        description: 'Set when a logged-in patient submitted this review through the account flow.',
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
      },
    },
  ],
  hooks: {
    afterChange: [auditAfterChange, revalidateAfterChange],
    afterDelete: [auditAfterDelete, revalidateAfterDelete],
  },
  timestamps: true,
}

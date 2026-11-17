import type { CollectionConfig } from 'payload'
import { auditAfterChange, auditAfterDelete } from '../lib/audit-hook'
import { LISTING_REPORT_REASONS } from '../lib/listing-report-reasons'

/**
 * "Report an issue with this listing" submissions from clinic profile pages.
 * Written only by POST /api/listing-reports (overrideAccess); staff read them
 * here and move the status along.
 */
export const ListingReports: CollectionConfig = {
  slug: 'listing-reports',
  admin: {
    useAsTitle: 'clinicName',
    defaultColumns: ['clinicName', 'reason', 'status', 'reporterEmail', 'createdAt'],
    listSearchableFields: ['clinicName', 'reporterEmail', 'details'],
    group: 'Inbox',
    description: 'Visitor reports of wrong info on a clinic page. Check the listing, fix it, then set the status.',
  },
  access: {
    // Reporter email is PII: staff only, and no raw REST create.
    create: () => false,
    read: ({ req }) => req.user?.role === 'admin' || req.user?.role === 'editor',
    update: ({ req }) => req.user?.role === 'admin' || req.user?.role === 'editor',
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics',
      // Not required on purpose: NOT NULL + ON DELETE SET NULL blocks clinic
      // deletes (see ClaimInvites.targetClinic). clinicName/pageUrl survive it.
      required: false,
      index: true,
    },
    { name: 'clinicName', type: 'text', required: true, admin: { description: 'Clinic name at the time of the report.' } },
    { name: 'pageUrl', type: 'text', admin: { description: 'Page the report was sent from.' } },
    {
      name: 'reason',
      type: 'select',
      required: true,
      options: LISTING_REPORT_REASONS.map(({ label, value }) => ({ label, value })),
    },
    { name: 'details', type: 'textarea' },
    { name: 'reporterName', type: 'text' },
    { name: 'reporterEmail', type: 'email' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      index: true,
      options: [
        { label: 'New', value: 'new' },
        { label: 'In review', value: 'in_review' },
        { label: 'Fixed', value: 'fixed' },
        { label: 'Dismissed', value: 'dismissed' },
      ],
    },
    { name: 'notes', type: 'textarea', admin: { description: 'Internal notes by editors.' } },
  ],
  hooks: {
    afterChange: [auditAfterChange],
    afterDelete: [auditAfterDelete],
  },
  timestamps: true,
}

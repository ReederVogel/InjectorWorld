import type { CollectionConfig } from 'payload'
import { auditAfterChange, auditAfterDelete } from '../lib/audit-hook'
import { LISTING_REPORT_REASONS } from '../lib/listing-report-reasons'

const CELLS = '/components/admin/cells/ListingReportCells'

/**
 * "Report an issue with this listing" submissions from clinic profile pages.
 * Written only by POST /api/report-listing (overrideAccess); staff read them
 * here and move the status along. The visitor's fields are read-only in the
 * admin so their words are never edited by accident.
 */
export const ListingReports: CollectionConfig = {
  slug: 'listing-reports',
  admin: {
    useAsTitle: 'clinicName',
    defaultColumns: ['clinicName', 'reason', 'details', 'status', 'clinic', 'createdAt'],
    listSearchableFields: ['clinicName', 'reporterEmail', 'details'],
    group: 'Inbox',
    description: 'Visitor reports of wrong info on a clinic page. Check the listing, fix it, then set the status.',
    components: {
      beforeList: ['/components/admin/list-headers/ListingReportsListHeader#ListingReportsListHeader'],
    },
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
      name: 'reportPanel',
      type: 'ui',
      admin: {
        disableListColumn: true,
        components: { Field: '/components/admin/fields/ListingReportPanel#ListingReportPanel' },
      },
    },
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics',
      // Not required on purpose: NOT NULL + ON DELETE SET NULL blocks clinic
      // deletes (see ClaimInvites.targetClinic). clinicName/pageUrl survive it.
      required: false,
      index: true,
      admin: { readOnly: true, components: { Cell: `${CELLS}#ListingReportClinicCell` } },
    },
    { name: 'clinicName', type: 'text', required: true, admin: { readOnly: true, description: 'Clinic name at the time of the report.' } },
    { name: 'pageUrl', type: 'text', admin: { readOnly: true, description: 'Page the report was sent from.' } },
    {
      name: 'reason',
      type: 'select',
      required: true,
      options: LISTING_REPORT_REASONS.map(({ label, value }) => ({ label, value })),
      admin: { readOnly: true, components: { Cell: `${CELLS}#ListingReportReasonCell` } },
    },
    { name: 'details', type: 'textarea', admin: { readOnly: true, components: { Cell: `${CELLS}#ListingReportDetailsCell` } } },
    {
      type: 'row',
      fields: [
        { name: 'reporterName', type: 'text', admin: { readOnly: true } },
        { name: 'reporterEmail', type: 'email', admin: { readOnly: true } },
      ],
    },
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
      admin: { position: 'sidebar', components: { Cell: `${CELLS}#ListingReportStatusCell` } },
    },
    { name: 'notes', type: 'textarea', admin: { position: 'sidebar', description: 'Internal notes by editors.' } },
  ],
  hooks: {
    afterChange: [auditAfterChange],
    afterDelete: [auditAfterDelete],
  },
  timestamps: true,
}

import type { CollectionConfig } from 'payload'
import { auditAfterChange, auditAfterDelete } from '../lib/audit-hook'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-hook'

export const Reviews: CollectionConfig = {
  slug: 'reviews',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['clinic', 'rating', 'moderationStatus', 'sourcePlatform', 'reviewDate'],
    listSearchableFields: ['reviewId', 'sourceReviewId', 'title', 'excerpt', 'text', 'treatmentTag'],
    group: 'Directory',
    description: 'Clinic reviews imported from source platforms. Reviews attach to clinics only.',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    { name: 'reviewId', type: 'text', required: true, unique: true, index: true },
    { name: 'clinic', type: 'relationship', relationTo: 'clinics', required: true, index: true },
    { name: 'rating', type: 'number', required: true, min: 1, max: 5 },
    { name: 'title', type: 'text' },
    { name: 'excerpt', type: 'textarea' },
    { name: 'text', type: 'textarea' },
    {
      name: 'publishStatus',
      type: 'select',
      defaultValue: 'excerpt_only',
      index: true,
      options: [
        { label: 'Full text', value: 'full' },
        { label: 'Excerpt only', value: 'excerpt_only' },
        { label: 'Hidden text', value: 'hidden' },
      ],
    },
    { name: 'treatmentTag', type: 'text' },
    { name: 'reviewDate', type: 'date' },
    { name: 'sourcePlatform', type: 'text' },
    { name: 'sourceReviewId', type: 'text', index: true },
    { name: 'sourceUrl', type: 'text' },
    { name: 'attributionRequired', type: 'checkbox', defaultValue: false },
    { name: 'responseFromProvider', type: 'textarea' },
    { name: 'responseDate', type: 'date' },
    { name: 'matchConfidence', type: 'number' },
    { name: 'needsManualReview', type: 'checkbox', defaultValue: false },
    {
      name: 'importBatch',
      type: 'text',
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Stamped by the bulk uploader/importer so a staged upload can be approved together.',
      },
    },
    {
      name: 'moderationStatus',
      type: 'select',
      defaultValue: 'pending',
      index: true,
      admin: { position: 'sidebar' },
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
    },
  ],
  hooks: {
    afterChange: [auditAfterChange, revalidateAfterChange],
    afterDelete: [auditAfterDelete, revalidateAfterDelete],
  },
  timestamps: true,
}
